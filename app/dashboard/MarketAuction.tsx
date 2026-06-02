// app/dashboard/MarketAuction.tsx
// Erstellt:     01.06.2026
// Aktualisiert: 01.06.2026
// Version:      0.2.0
//
// M.U.L.E.-Echtzeit-Auktion als Markt-Overlay – HORIZONTALES MEHRBALKEN-LAYOUT.
//
// Aufbau (v0.2.0, kompletter Umbau gegenüber dem alten vertikalen Einzelbalken):
//   - Mehrere horizontale Balken, einer pro KÄUFER. Links = niedriger Preis,
//     rechts = hoher Preis. Käufer-Cursor sitzt links und steigt nach rechts;
//     der GEMEINSAME Verkäufer-Cursor sitzt rechts und sinkt nach links.
//     Beide Seiten kommen sich entgegen.
//   - Es gibt EINEN Verkäufer (Kolonieverwalter) mit einem Gesamtvorrat.
//     Sein Cursor ist auf jedem Balken an derselben Preisposition.
//   - Treffen sich Käufer- und Verkäufer-Cursor auf einem Balken, kommt der
//     Deal automatisch zustande – über die MENGE, die dieser Käufer wollte,
//     begrenzt durch den Restvorrat des Verkäufers. Rest läuft an andere Käufer.
//
// Rolle des Spielers (bestimmt durch Kauf/Verkauf-Wahl beim Öffnen):
//   - KAUFEN  → Spieler ist EINER der Käufer (eigener, hervorgehobener Balken).
//               Verkäufer = Kolonieverwalter, Vorrat = stock der Kolonie.
//   - VERKAUFEN → Spieler ist DER Verkäufer rechts, NPC-Käufer buhlen um seine
//               Ware. Vorrat = vom Spieler vorab festgelegte Verkaufsmenge
//               (max. = sein Cargo dieser Ressource).
//
// Mengen-Zuteilung: Käufer X will qty_X. Trifft er den Verkäufer, bekommt er
// min(qty_X, Restvorrat). Ist der Spieler dieser Käufer, endet die Auktion für
// ihn. Ist der Vorrat erschöpft, endet die Auktion ganz.
//
// WICHTIG: Loop CLIENT-SEITIG (kein Ably). Nur das Ergebnis des Spieler-Deals
// wird über onTrade(...) → /api/game/trade gebucht (1t pro Call im Parent-Loop).
// Loop in useEffect mit sauberem clearInterval.

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ResourceType, LocationSlug } from '@/lib/store/gameStore'
import { PRICE_MIN, PRICE_MAX, STOCK_LOW_THRESHOLD } from '@/lib/game/config'

const RESOURCE_LABEL: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }
const RESOURCE_ICON:  Record<string, string> = { water: '💧', energy: '⚡', metal: '⛏️' }

// Loop-Takt und Schrittweite → langsam & lesbar
const TICK_MS = 120
const STEP_BASE = 1.2   // Cr pro Tick Grund-Annäherungstempo

type Mode = 'buy' | 'sell'

// Ein Käufer auf der Auktion (NPC oder der Spieler).
interface Buyer {
  id: string
  name: string
  color: string
  isPlayer: boolean
  price: number       // aktueller Gebotspreis (steigt Richtung Verkäufer)
  aggr: number        // 0..1 Annäherungstempo – sorgt für sichtbar unterschiedliche Dynamik
  want: number        // gewünschte Menge in t
  got: number         // bereits erhaltene Menge
  done: boolean       // fertig (Menge erhalten oder Auktion für ihn beendet)
}

interface MarketRow {
  resource: ResourceType
  buy_price: number
  sell_price: number
  stock: number
}

// ─── Preis-Anker ─────────────────────────────────────────────────────────────
// Verkäufer-Boden (Reservationspreis): sell_price, erhöht bei knappem Lager.
function sellerFloor(row: MarketRow): number {
  const scarcity = Math.max(0, (STOCK_LOW_THRESHOLD - row.stock) / STOCK_LOW_THRESHOLD)
  return Math.round(row.sell_price * (1 + 0.4 * scarcity))
}
// Käufer-Decke: buy_price (darüber kauft niemand).
function buyerCeiling(row: MarketRow): number {
  return row.buy_price
}

function clampPrice(p: number) { return Math.max(PRICE_MIN, Math.min(PRICE_MAX, p)) }
// Preis → Prozentposition entlang des horizontalen Balkens (0 = links, 100 = rechts).
function xpct(price: number) { return clampPrice(price) / PRICE_MAX * 100 }
function fmt(n: number) { return Math.round(n).toLocaleString('de-DE') }

// ─── NPC-Pool ────────────────────────────────────────────────────────────────
const NPC_POOL = [
  { name: 'Frachter Vesta',     color: '#378add' },
  { name: 'Phobos-Konsortium',  color: '#d4537e' },
  { name: 'Tharsis Logistik',   color: '#97c459' },
  { name: 'Shackleton Bergbau', color: '#e0844f' },
  { name: 'Ceres-Allianz',      color: '#9b7ed0' },
]

export default function MarketAuction({
  open,
  onClose,
  location,
  locationName,
  rows,
  credits,
  cargo,
  cargoMax,
  onTrade,
}: {
  open: boolean
  onClose: () => void
  location: LocationSlug
  locationName: string
  rows: MarketRow[]
  credits: number
  cargo: Record<ResourceType, number>
  cargoMax: number
  onTrade: (resource: ResourceType, mode: Mode, amount: number, price: number) => Promise<boolean>
}) {
  const [mode, setMode] = useState<Mode>('buy')
  const [resource, setResource] = useState<ResourceType>('water')
  const [playerQty, setPlayerQty] = useState(20)   // Wunschmenge des Spielers
  const [started, setStarted] = useState(false)    // Auktion läuft (nach "Auktion starten")
  const [running, setRunning] = useState(true)
  const [log, setLog] = useState<{ text: string; ok: boolean } | null>(null)

  // Live-Zustand in Refs
  const sellerPriceRef = useRef(0)     // gemeinsamer Verkäufer-Cursor
  const sellerStockRef = useRef(0)     // Restvorrat des Verkäufers
  const buyersRef = useRef<Buyer[]>([])
  const endedRef = useRef(false)
  const playerDoneRef = useRef(false)

  // Anzeige-Spiegel
  const [view, setView] = useState({ sellerPrice: 0, sellerStock: 0, buyers: [] as Buyer[] })

  const row = rows.find(r => r.resource === resource)

  // Maximale Spielermenge je nach Rolle
  const playerMaxQty = (() => {
    if (!row) return 0
    if (mode === 'buy') return Math.min(cargoMax, row.stock)            // begrenzt durch Laderaum & Vorrat
    return cargo[resource] ?? 0                                        // beim Verkauf: was an Bord ist
  })()

  // ── Auktion initialisieren ───────────────────────────────────────────────
  const startAuction = useCallback(() => {
    if (!row) return
    endedRef.current = false
    playerDoneRef.current = false
    setLog(null)

    const floor = sellerFloor(row)
    const ceil = buyerCeiling(row)

    // Verkäufer startet hoch (am ungünstigen Ende für Käufer) und sinkt Richtung floor.
    sellerPriceRef.current = clampPrice(ceil + 10)

    // Vorrat des Verkäufers
    if (mode === 'buy') {
      sellerStockRef.current = row.stock           // Kolonieverwalter verkauft aus stock
    } else {
      sellerStockRef.current = Math.min(playerQty, playerMaxQty)  // Spieler bietet seine Menge an
    }

    // Käufer aufbauen
    const buyers: Buyer[] = []
    if (mode === 'buy') {
      // Spieler ist Käufer + 2-4 NPC-Käufer
      const nNpc = 2 + Math.floor(Math.random() * 3)
      buyers.push({
        id: 'player', name: 'Du', color: '#c9a961', isPlayer: true,
        price: clampPrice(floor - 10), aggr: 0, // Spieler-Cursor steuert der Spieler selbst nicht – steigt automatisch, Deal autom.
        want: Math.min(playerQty, playerMaxQty), got: 0, done: false,
      })
      for (let i = 0; i < nNpc; i++) {
        buyers.push({
          id: 'npc' + i, name: NPC_POOL[i].name, color: NPC_POOL[i].color, isPlayer: false,
          price: clampPrice(floor - 8 - Math.random() * 20),
          aggr: 0.4 + Math.random() * 0.6,
          want: 10 + Math.floor(Math.random() * 25), got: 0, done: false,
        })
      }
    } else {
      // Spieler ist Verkäufer rechts → alle Käufer sind NPCs
      const nNpc = 3 + Math.floor(Math.random() * 3)
      for (let i = 0; i < nNpc; i++) {
        buyers.push({
          id: 'npc' + i, name: NPC_POOL[i].name, color: NPC_POOL[i].color, isPlayer: false,
          price: clampPrice(floor - 8 - Math.random() * 20),
          aggr: 0.4 + Math.random() * 0.6,
          want: 10 + Math.floor(Math.random() * 25), got: 0, done: false,
        })
      }
    }
    buyersRef.current = buyers
    setView({ sellerPrice: sellerPriceRef.current, sellerStock: sellerStockRef.current, buyers: buyers.map(b => ({ ...b })) })
    setStarted(true)
    setRunning(true)
  }, [row, mode, playerQty, playerMaxQty])

  // Bei Wechsel von Ressource/Modus zurück in den Vorbereitungs-Screen
  useEffect(() => { setStarted(false); endedRef.current = true }, [mode, resource, open])

  // ── Auktions-Loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !started || !running || !row) return
    const floor = sellerFloor(row)

    const iv = setInterval(() => {
      if (endedRef.current) return

      // Verkäufer sinkt langsam Richtung Reservationspreis (floor), stoppt dort.
      if (sellerPriceRef.current > floor) {
        sellerPriceRef.current = Math.max(floor, sellerPriceRef.current - STEP_BASE)
      }
      const sp = sellerPriceRef.current

      // Käufer steigen Richtung Verkäufer (unterschiedlich schnell → Dynamik).
      for (const b of buyersRef.current) {
        if (b.done) continue
        // Spieler-Käufer steigt mit mittlerem Tempo automatisch mit.
        const speed = (b.isPlayer ? 0.5 : b.aggr) * (STEP_BASE + 0.6)
        b.price = Math.min(sp, b.price + speed)

        // Treffen? (Käuferpreis erreicht Verkäuferpreis)
        if (b.price >= sp - 0.5 && sellerStockRef.current > 0) {
          const take = Math.min(b.want - b.got, sellerStockRef.current)
          if (take > 0) {
            b.got += take
            sellerStockRef.current -= take
          }
          b.done = true

          if (b.isPlayer) {
            // Deal des Spielers → über onTrade buchen
            playerDoneRef.current = true
            const dealPrice = Math.round(sp)
            const dealQty = b.got
            settlePlayer(dealQty, dealPrice)
          } else {
            setLog({ text: `${b.name} kauft ${take}t zu ${Math.round(sp)} Cr · Rest ${sellerStockRef.current}t`, ok: false })
          }
        }
      }

      // Auktion endet, wenn Vorrat leer oder alle fertig.
      const allDone = buyersRef.current.every(b => b.done)
      if (sellerStockRef.current <= 0 || allDone) {
        endedRef.current = true
        if (mode === 'sell' && playerDoneRef.current === false) {
          // Spieler war Verkäufer: abrechnen, was verkauft wurde
          settleSellerPlayer()
        }
      }

      setView({
        sellerPrice: sellerPriceRef.current,
        sellerStock: sellerStockRef.current,
        buyers: buyersRef.current.map(b => ({ ...b })),
      })
    }, TICK_MS)

    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, started, running, row, mode])

  // Spieler war KÄUFER und hat einen Deal getroffen
  async function settlePlayer(qty: number, price: number) {
    if (!row) return
    if (qty <= 0) { setLog({ text: 'Kein Zuschlag – Vorrat war erschöpft.', ok: false }); return }
    const free = cargoMax - (cargo.water + cargo.energy + cargo.metal)
    const affordable = Math.floor(credits / price)
    const finalQty = Math.min(qty, free, affordable)
    if (finalQty <= 0) { setLog({ text: free <= 0 ? 'Laderaum voll.' : 'Nicht genug Credits.', ok: false }); return }
    const ok = await onTrade(resource, 'buy', finalQty, price)
    setLog({ text: ok ? `✓ Gekauft: ${finalQty}t ${RESOURCE_LABEL[resource]} zu ${price} Cr.` : 'Kauf fehlgeschlagen.', ok })
  }

  // Spieler war VERKÄUFER → verkaufte Menge = ursprünglicher Vorrat minus Rest
  async function settleSellerPlayer() {
    if (!row) return
    const offered = Math.min(playerQty, playerMaxQty)
    const soldQty = offered - sellerStockRef.current
    const price = Math.round(sellerPriceRef.current)
    if (soldQty <= 0) { setLog({ text: 'Niemand hat zu deinem Preis gekauft.', ok: false }); return }
    const ok = await onTrade(resource, 'sell', soldQty, price)
    setLog({ text: ok ? `✓ Verkauft: ${soldQty}t ${RESOURCE_LABEL[resource]} zu ${price} Cr.` : 'Verkauf fehlgeschlagen.', ok })
  }

  if (!open || !row) return null

  const floor = sellerFloor(row)
  const ceil = buyerCeiling(row)

  // ─── Styles ─────────────────────────────────────────────────────────────
  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(2,4,8,0.92)', zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
  }
  const panel: React.CSSProperties = {
    background: '#020408', border: '1px solid rgba(201,169,97,0.35)', borderRadius: '12px',
    width: '100%', maxWidth: '820px', padding: '1.5rem', color: '#e8e6df', fontFamily: 'system-ui, sans-serif',
  }
  const tagBtn = (active: boolean): React.CSSProperties => ({
    background: active ? '#15233a' : '#0a1420', border: `0.5px solid ${active ? '#c9a961' : '#1f3650'}`,
    color: active ? '#c9a961' : '#9fb4cf', borderRadius: '7px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.75rem',
  })

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>

        {/* Kopf */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid rgba(201,169,97,0.3)', paddingBottom: '12px', marginBottom: '14px' }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.25rem', color: '#c9a961' }}>Handelszentrale · Live-Auktion</div>
            <div style={{ fontSize: '0.72rem', color: '#7d93b0' }}>{locationName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '0.5px solid #2a4e7a', color: '#cfe0f5', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem' }}>Schließen ✕</button>
        </div>

        {/* Steuerung */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: '#7d93b0' }}>Ressource:</span>
          {(['water', 'energy', 'metal'] as ResourceType[]).map(r => (
            <button key={r} style={tagBtn(resource === r)} onClick={() => setResource(r)}>{RESOURCE_ICON[r]} {RESOURCE_LABEL[r]}</button>
          ))}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: '0.72rem', color: '#7d93b0' }}>Modus:</span>
          <button
            style={{ ...tagBtn(true), borderColor: mode === 'buy' ? '#1d9e75' : '#c9a961', color: mode === 'buy' ? '#5dcaa5' : '#e0c486' }}
            onClick={() => setMode(m => m === 'buy' ? 'sell' : 'buy')}
          >{mode === 'buy' ? 'Kaufen' : 'Verkaufen'}</button>
        </div>

        {/* Vorbereitung ODER Auktion */}
        {!started ? (
          <div style={{ background: '#0a1420', border: '0.5px solid #1f3650', borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: '#cfe0f5', marginBottom: '4px' }}>
              {mode === 'buy'
                ? `Du bietest als Käufer auf ${RESOURCE_LABEL[resource]} mit.`
                : `Du verkaufst ${RESOURCE_LABEL[resource]} an die Bieter.`}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#7d93b0', marginBottom: '16px' }}>
              {mode === 'buy'
                ? `Verkäufer (Kolonie) hat ${row.stock}t vorrätig.`
                : `An Bord: ${cargo[resource] ?? 0}t · Laderaum dieser Ressource bestimmt dein Maximum.`}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '18px' }}>
              <span style={{ fontSize: '0.72rem', color: '#7d93b0' }}>
                {mode === 'buy' ? 'Wunschmenge' : 'Verkaufsmenge'}
              </span>
              <button onClick={() => setPlayerQty(q => Math.max(1, q - 5))} style={{ ...tagBtn(false), padding: '3px 11px' }}>−</button>
              <span style={{ minWidth: '60px', textAlign: 'center', fontWeight: 600, fontSize: '1rem', color: '#c9a961' }}>{Math.min(playerQty, playerMaxQty)}t</span>
              <button onClick={() => setPlayerQty(q => Math.min(playerMaxQty, q + 5))} style={{ ...tagBtn(false), padding: '3px 11px' }}>+</button>
              <span style={{ fontSize: '0.66rem', color: '#5f7596' }}>max {playerMaxQty}t</span>
            </div>

            <button
              onClick={startAuction}
              disabled={playerMaxQty <= 0}
              style={{ padding: '12px 32px', fontSize: '0.95rem', borderRadius: '9px', border: '1px solid #c9a961', background: playerMaxQty > 0 ? '#15233a' : 'transparent', color: playerMaxQty > 0 ? '#c9a961' : '#5f7596', cursor: playerMaxQty > 0 ? 'pointer' : 'default', fontWeight: 600 }}
            >
              {playerMaxQty > 0 ? 'Auktion starten' : (mode === 'sell' ? 'Keine Ware an Bord' : 'Kein Vorrat verfügbar')}
            </button>
          </div>
        ) : (
          <>
            {/* Preis-Skala-Beschriftung */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#5f7596', margin: '0 70px 6px 90px' }}>
              <span>günstig · {PRICE_MIN} Cr</span>
              <span>Verkäufer-Boden {floor} Cr</span>
              <span>teuer · {PRICE_MAX} Cr</span>
            </div>

            {/* Käufer-Balken */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {view.buyers.map(b => {
                const buyerX = xpct(b.price)
                const sellerX = xpct(view.sellerPrice)
                return (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Name links */}
                    <div style={{ flex: '0 0 82px', textAlign: 'right', fontSize: '0.7rem', color: b.isPlayer ? '#c9a961' : '#cfe0f5', fontWeight: b.isPlayer ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {b.name}
                    </div>
                    {/* Balken */}
                    <div style={{ position: 'relative', flex: 1, height: b.isPlayer ? '28px' : '22px', background: b.isPlayer ? 'rgba(201,169,97,0.07)' : '#06101c', border: `0.5px solid ${b.isPlayer ? 'rgba(201,169,97,0.4)' : '#1f3650'}`, borderRadius: '5px', opacity: b.done && !b.isPlayer ? 0.45 : 1 }}>
                      {/* Käuferpreis-Füllung von links */}
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${buyerX}%`, background: `linear-gradient(to right, ${b.color}22, ${b.color}44)`, borderRight: `2px solid ${b.color}`, borderRadius: '5px 0 0 5px', transition: 'width 0.12s linear' }} />
                      {/* Käufer-Cursor-Label */}
                      <div style={{ position: 'absolute', left: `calc(${buyerX}% - 4px)`, top: '50%', transform: 'translateY(-50%)', fontSize: '0.6rem', fontFamily: 'monospace', color: b.color, whiteSpace: 'nowrap', paddingLeft: '6px' }}>
                        {Math.round(b.price)}
                      </div>
                      {/* Gemeinsamer Verkäufer-Cursor (rechts, sinkt nach links) */}
                      <div style={{ position: 'absolute', left: `${sellerX}%`, top: '-2px', bottom: '-2px', width: '2px', background: '#e0846a', transition: 'left 0.12s linear' }} />
                      {/* erhaltene Menge */}
                      {b.got > 0 && (
                        <div style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.62rem', color: '#5dcaa5', fontFamily: 'monospace' }}>
                          ✓ {b.got}t
                        </div>
                      )}
                    </div>
                    {/* Wunschmenge rechts */}
                    <div style={{ flex: '0 0 48px', fontSize: '0.64rem', color: '#7d93b0', fontFamily: 'monospace' }}>
                      {b.done ? `${b.got}/${b.want}t` : `will ${b.want}t`}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Verkäufer-Zeile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', paddingTop: '12px', borderTop: '0.5px solid #1f3650' }}>
              <div style={{ flex: '0 0 82px', textAlign: 'right', fontSize: '0.7rem', color: '#e0846a', fontWeight: mode === 'sell' ? 700 : 400 }}>
                {mode === 'sell' ? 'Du (Verk.)' : 'Verkäufer'}
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#cfe0f5' }}>
                <span>Preis <strong style={{ color: '#e0846a', fontFamily: 'monospace' }}>{Math.round(view.sellerPrice)} Cr</strong></span>
                <span>Restvorrat <strong style={{ color: '#c9a961', fontFamily: 'monospace' }}>{view.sellerStock}t</strong></span>
              </div>
              <div style={{ flex: '0 0 48px' }} />
            </div>

            {/* Steuerung Auktion */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setRunning(r => !r)} style={{ flex: 1, padding: '10px 0', borderRadius: '9px', border: '0.5px solid #2a4e7a', background: 'transparent', color: '#cfe0f5', cursor: 'pointer', fontSize: '0.82rem' }}>
                {running ? 'Pause' : 'Weiter'}
              </button>
              <button onClick={() => { endedRef.current = true; setStarted(false) }} style={{ flex: 1, padding: '10px 0', borderRadius: '9px', border: '0.5px solid #1f3650', background: 'transparent', color: '#9fb4cf', cursor: 'pointer', fontSize: '0.82rem' }}>
                Zurück
              </button>
            </div>
          </>
        )}

        {/* Log */}
        <div style={{ marginTop: '12px', fontSize: '0.72rem', minHeight: '20px', fontFamily: 'monospace', color: log ? (log.ok ? '#5dcaa5' : '#e0846a') : '#9fb4cf' }}>
          {log ? log.text
            : started
              ? (mode === 'buy' ? 'Dein Gebot steigt automatisch. Triffst du den Verkäufer zuerst, bekommst du deine Menge.' : 'Die Käufer steigen Richtung deines Preises. Wer trifft, kauft.')
              : 'Lege deine Menge fest und starte die Auktion.'}
        </div>
      </div>
    </div>
  )
}
