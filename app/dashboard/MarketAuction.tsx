// app/dashboard/MarketAuction.tsx
// Erstellt:     01.06.2026
// Aktualisiert: 01.06.2026
// Version:      0.1.0
//
// M.U.L.E.-Echtzeit-Auktion als eigenes Markt-Overlay.
// Öffnet sich per Klick auf "Handelszentrale (Live)" im Übersicht-Tab.
//
// Mechanik (wie klassisches M.U.L.E.):
//   - Käufer nähern sich von unten (niedriger Preis steigt langsam hoch)
//   - Verkäufer nähern sich von oben (hoher Preis sinkt langsam runter)
//   - Verkäufer hat einen RESERVATIONSPREIS (Boden): sinkt der Kurs darunter,
//     verkauft er nicht mehr → sein Cursor stoppt.
//     Boden = sell_price, steigt bei knappem Lager (stock < 50).
//   - Käufer hat eine DECKE: über buy_price kauft er nicht mehr.
//   - Deal bei Treffen der Kurse. Wer zuerst trifft, bekommt seine Menge zugeteilt,
//     der Rest der Order läuft weiter an die nächsten Bieter.
//   - Spieler kann KAUFEN oder VERKAUFEN (Umschalter), NPCs sind jeweils die Gegenseite
//     + Konkurrenz auf der eigenen Seite.
//
// WICHTIG: Der gesamte Auktions-Loop läuft CLIENT-SEITIG (kein Ably, kein Server-State).
// Nur das Ergebnis eines Deals wird über /api/game/trade?action=buy|sell gebucht
// (1t pro Call, Loop wie im bestehenden DashboardClient.handleBuy/handleSell).
//
// Loop liegt in useEffect mit sauberem clearInterval beim Schließen/Tab-Wechsel.

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ResourceType, LocationSlug } from '@/lib/store/gameStore'

// ─── Konstanten (aus lib/game/config.ts gespiegelt) ──────────────────────────
const PRICE_MIN = 10
const PRICE_MAX = 500
const STOCK_LOW_THRESHOLD = 50

const RESOURCE_LABEL: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }
const RESOURCE_ICON:  Record<string, string> = { water: '💧', energy: '⚡', metal: '⛏️' }

// Loop-Takt und Schrittweite → ~3,5 Sek pro Annäherung, langsam & lesbar
const TICK_MS = 120
const STEP_BASE = 1.4   // Cr pro Tick Grundtempo

type Mode = 'buy' | 'sell'

// Ein NPC-Bieter auf der Konkurrenzseite des Spielers
interface Bidder {
  id: string
  name: string
  color: string
  price: number      // aktueller Gebotspreis
  want: number       // wie viele Tonnen er will
  aggr: number       // 0..1 Annäherungstempo
  done: boolean      // hat seine Menge bekommen
}

// Marktdaten einer Ressource am aktuellen Standort
interface MarketRow {
  resource: ResourceType
  buy_price: number   // Preis zu dem der Spieler kauft / NPC-Käufer-Decke
  sell_price: number  // Preis zu dem der Spieler verkauft / NPC-Verkäufer-Boden
  stock: number
}

// ─── Reservationspreis-Berechnung ────────────────────────────────────────────
// Verkäufer-Boden: sell_price, erhöht bei knappem Lager (will dann mehr Geld).
// Bei stock = 0 bis zu +40%, bei stock >= 50 kein Aufschlag.
function sellerFloor(row: MarketRow): number {
  const scarcity = Math.max(0, (STOCK_LOW_THRESHOLD - row.stock) / STOCK_LOW_THRESHOLD)
  return Math.round(row.sell_price * (1 + 0.4 * scarcity))
}
// Käufer-Decke: buy_price, gesenkt bei Überschuss (will dann weniger zahlen).
function buyerCeiling(row: MarketRow): number {
  const glut = Math.max(0, (row.stock - 400) / 400)
  return Math.round(row.buy_price * (1 - 0.2 * Math.min(1, glut)))
}

function clampPrice(p: number) {
  return Math.max(PRICE_MIN, Math.min(PRICE_MAX, p))
}

function pct(price: number) {
  return clampPrice(price) / PRICE_MAX * 100 // 0..100 entlang der Skala
}

// ─── NPC-Generator ───────────────────────────────────────────────────────────
const NPC_POOL = [
  { name: 'Frachter Vesta',     color: '#378add' },
  { name: 'Phobos-Konsortium',  color: '#d4537e' },
  { name: 'Tharsis Logistik',   color: '#97c459' },
  { name: 'Shackleton Bergbau', color: '#c9a961' },
]

function spawnBidders(mode: Mode, row: MarketRow): Bidder[] {
  // 2-3 Konkurrenz-Bieter auf der gleichen Seite wie der Spieler
  const n = 2 + Math.floor(Math.random() * 2)
  const start = mode === 'buy' ? sellerFloor(row) : buyerCeiling(row)
  return NPC_POOL.slice(0, n).map((npc, i) => ({
    id: 'npc' + i,
    name: npc.name,
    color: npc.color,
    // Konkurrenten starten leicht versetzt nahe der Gegenseite
    price: mode === 'buy'
      ? clampPrice(start - 20 - Math.random() * 25)   // Käufer starten niedrig
      : clampPrice(start + 20 + Math.random() * 25),  // Verkäufer starten hoch
    want: 5 + Math.floor(Math.random() * 15),
    aggr: 0.5 + Math.random() * 0.5,
    done: false,
  }))
}

// ─── Komponente ──────────────────────────────────────────────────────────────
export default function MarketAuction({
  open,
  onClose,
  location,
  locationName,
  rows,           // Marktdaten der aktuellen Kolonie (aus prices + location_resources)
  credits,
  cargo,
  cargoMax,
  onTrade,        // (resource, mode, amount, price) => Promise<boolean> — bucht über /api/game/trade
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
  const [orderQty, setOrderQty] = useState(5)        // wie viel der Spieler will
  const [running, setRunning] = useState(true)
  const [log, setLog] = useState<{ text: string; ok: boolean } | null>(null)

  // Live-Auktionszustand in Refs (ändert sich pro Tick, kein Re-Render-Spam)
  const oppRef = useRef(0)            // Preis der Gegenseite (nähert sich an)
  const oppStoppedRef = useRef(false) // Gegenseite hat Reservation erreicht
  const biddersRef = useRef<Bidder[]>([])
  const filledRef = useRef(0)         // wie viele Tonnen der Order schon weg sind
  const roundDoneRef = useRef(false)

  // Für die Anzeige spiegeln wir die Refs in State (nur ~8x/Sek statt jeden Tick)
  const [view, setView] = useState({ opp: 0, oppStopped: false, bidders: [] as Bidder[], filled: 0 })

  const row = rows.find(r => r.resource === resource)

  // ── Eine Runde initialisieren ──────────────────────────────────────────────
  const initRound = useCallback(() => {
    if (!row) return
    roundDoneRef.current = false
    filledRef.current = 0
    oppStoppedRef.current = false
    biddersRef.current = spawnBidders(mode, row)
    // Gegenseite startet am für den Spieler ungünstigen Ende und nähert sich an
    oppRef.current = mode === 'buy'
      ? clampPrice(buyerCeiling(row))     // Spieler kauft → Verkäufer startet hoch (= buy_price-Bereich)
      : clampPrice(sellerFloor(row))      // Spieler verkauft → Käufer startet niedrig
    setLog(null)
  }, [mode, row])

  useEffect(() => {
    if (open) initRound()
  }, [open, mode, resource, initRound])

  // ── Auktions-Loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !running || !row) return
    const iv = setInterval(() => {
      if (roundDoneRef.current) return

      const floor = sellerFloor(row)
      const ceil = buyerCeiling(row)

      // Gegenseite nähert sich dem Spieler an, bis zur Reservationsschwelle
      if (mode === 'buy') {
        // Verkäufer (Gegenseite) senkt Preis Richtung Käufer, stoppt am Boden
        const next = oppRef.current - STEP_BASE
        if (next <= floor) { oppRef.current = floor; oppStoppedRef.current = true }
        else oppRef.current = next
      } else {
        // Käufer (Gegenseite) hebt Preis Richtung Verkäufer, stoppt an Decke
        const next = oppRef.current + STEP_BASE
        if (next >= ceil) { oppRef.current = ceil; oppStoppedRef.current = true }
        else oppRef.current = next
      }

      // Konkurrenz-Bieter nähern sich ebenfalls der Gegenseite
      for (const b of biddersRef.current) {
        if (b.done) continue
        const target = oppRef.current
        b.price += (target - b.price) * 0.06 * b.aggr
        // Trifft ein NPC die Gegenseite, schnappt er sich seine Menge
        const hit = mode === 'buy' ? b.price >= oppRef.current - 0.5 : b.price <= oppRef.current + 0.5
        const remaining = orderQty - filledRef.current
        if (hit && remaining > 0 && Math.random() < 0.04) {
          const take = Math.min(b.want, remaining)
          filledRef.current += take
          b.done = true
          setLog({ text: `${b.name} schnappt sich ${take}t zu ${Math.round(oppRef.current)} Cr — noch ${orderQty - filledRef.current}t offen.`, ok: false })
          if (filledRef.current >= orderQty) {
            roundDoneRef.current = true
            setLog({ text: `Order vergeben. Die NPCs waren schneller — neue Runde…`, ok: false })
            setTimeout(initRound, 1600)
          }
        }
      }

      setView({
        opp: oppRef.current,
        oppStopped: oppStoppedRef.current,
        bidders: biddersRef.current.map(b => ({ ...b })),
        filled: filledRef.current,
      })
    }, TICK_MS)
    return () => clearInterval(iv)
  }, [open, running, mode, row, orderQty, initRound])

  if (!open || !row) return null

  const floor = sellerFloor(row)
  const ceil = buyerCeiling(row)
  const oppPrice = Math.round(view.opp)
  const remaining = orderQty - view.filled

  // ── Spieler schlägt zu ──────────────────────────────────────────────────────
  async function playerStrike() {
    if (roundDoneRef.current || !row) return
    const price = Math.round(oppRef.current)
    const want = Math.min(orderQty - filledRef.current, orderQty)

    // Prüfungen analog DashboardClient
    if (mode === 'buy') {
      if (oppStoppedRef.current && price > buyerCeiling(row) + 1) {
        setLog({ text: 'Verkäufer geht nicht tiefer — Reservationspreis erreicht.', ok: false }); return
      }
      const free = cargoMax - (cargo.water + cargo.energy + cargo.metal)
      const affordable = Math.floor(credits / price)
      const qty = Math.min(want, free, affordable)
      if (qty <= 0) { setLog({ text: free <= 0 ? 'Laderaum voll.' : 'Nicht genug Credits.', ok: false }); return }
      roundDoneRef.current = true
      const ok = await onTrade(resource, 'buy', qty, price)
      setLog({ text: ok ? `✓ Gekauft: ${qty}t ${RESOURCE_LABEL[resource]} zu ${price} Cr.` : 'Kauf fehlgeschlagen.', ok })
    } else {
      const have = cargo[resource]
      const qty = Math.min(want, have)
      if (qty <= 0) { setLog({ text: `Keine Ladung ${RESOURCE_LABEL[resource]} an Bord.`, ok: false }); return }
      roundDoneRef.current = true
      const ok = await onTrade(resource, 'sell', qty, price)
      setLog({ text: ok ? `✓ Verkauft: ${qty}t ${RESOURCE_LABEL[resource]} zu ${price} Cr.` : 'Verkauf fehlgeschlagen.', ok })
    }
    setTimeout(initRound, 1400)
  }

  // ── Styles (Noxia Dark-UI) ───────────────────────────────────────────────
  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(2,4,8,0.92)', zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
  }
  const panel: React.CSSProperties = {
    background: '#020408', border: '1px solid rgba(201,169,97,0.35)', borderRadius: '12px',
    width: '100%', maxWidth: '760px', padding: '1.5rem', color: '#e8e6df', fontFamily: 'system-ui, sans-serif',
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

        <div style={{ display: 'flex', gap: '18px' }}>
          {/* Preisbalken */}
          <div style={{ flex: '0 0 90px', textAlign: 'center' }}>
            <div style={{ position: 'relative', width: '46px', height: '320px', margin: '0 auto', background: '#06101c', border: '0.5px solid #1f3650', borderRadius: '6px' }}>
              {/* Deal-Zone */}
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${pct(floor)}%`, height: `${pct(ceil) - pct(floor)}%`, background: 'rgba(29,158,117,0.22)', borderTop: '1px solid #1d9e75', borderBottom: '1px solid #1d9e75' }} />
              {/* Reservations-Linie */}
              <div style={{ position: 'absolute', left: '-4px', right: '-4px', bottom: `${pct(mode === 'buy' ? floor : ceil)}%`, borderTop: '1px dotted #e0846a' }} />
              {/* Gegenseite (annähernder Cursor) */}
              <div style={{ position: 'absolute', left: '-6px', right: '-6px', bottom: `${pct(view.opp)}%`, borderTop: `2px solid ${view.oppStopped ? '#e0846a' : '#c9a961'}`, transition: 'bottom 0.12s linear' }}>
                <span style={{ position: 'absolute', right: '-54px', top: '-9px', fontSize: '0.65rem', color: view.oppStopped ? '#e0846a' : '#c9a961', background: '#15233a', border: `0.5px solid ${view.oppStopped ? '#e0846a' : '#c9a961'}`, borderRadius: '4px', padding: '1px 5px', fontFamily: 'monospace' }}>{oppPrice}</span>
              </div>
              {/* Konkurrenz-Bieter */}
              {view.bidders.map(b => (
                <div key={b.id} style={{ position: 'absolute', left: '-5px', right: '-5px', bottom: `${pct(b.price)}%`, borderTop: `2px dashed ${b.color}`, opacity: b.done ? 0.2 : 1, transition: 'bottom 0.12s linear' }} />
              ))}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#5f7596', marginTop: '6px' }}>{PRICE_MIN}–{PRICE_MAX} Cr</div>
          </div>

          {/* Rechte Spalte */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Statuszeile */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                ['Lager', `${row.stock}t`],
                [mode === 'buy' ? 'Verkäufer-Boden' : 'Käufer-Decke', `${mode === 'buy' ? floor : ceil} Cr`],
                ['Order offen', `${remaining}t`],
                ['Guthaben', `${credits.toLocaleString('de')} Cr`],
              ].map(([l, v], i) => (
                <div key={i} style={{ flex: 1, background: '#0a1420', border: '0.5px solid #1f3650', borderRadius: '8px', padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', color: '#7d93b0' }}>{l}</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cfe0f5', marginTop: '2px' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Order-Menge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0a1420', border: '0.5px solid #1f3650', borderRadius: '8px', padding: '8px 10px' }}>
              <span style={{ fontSize: '0.72rem', color: '#7d93b0', flex: 1 }}>Gewünschte Menge</span>
              <button onClick={() => setOrderQty(q => Math.max(1, q - 1))} style={{ ...tagBtn(false), padding: '2px 9px' }}>−</button>
              <span style={{ minWidth: '40px', textAlign: 'center', fontWeight: 600 }}>{orderQty}t</span>
              <button onClick={() => setOrderQty(q => Math.min(cargoMax, q + 1))} style={{ ...tagBtn(false), padding: '2px 9px' }}>+</button>
            </div>

            {/* Konkurrenz */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {view.bidders.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', background: '#0a1420', border: '0.5px solid #1f3650', borderRadius: '7px', padding: '5px 9px', opacity: b.done ? 0.5 : 1 }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: b.color, flex: '0 0 9px' }} />
                  <span style={{ flex: '0 0 130px', color: '#cfe0f5' }}>{b.name}</span>
                  <span style={{ flex: '0 0 60px', fontFamily: 'monospace', color: '#9fb4cf' }}>{Math.round(b.price)} Cr</span>
                  <span style={{ flex: 1, textAlign: 'right', color: '#7d93b0', fontSize: '0.68rem' }}>{b.done ? 'bedient' : `will ${b.want}t`}</span>
                </div>
              ))}
            </div>

            {/* Aktionen */}
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
              <button onClick={playerStrike} style={{ flex: 1, padding: '12px 0', fontSize: '0.95rem', borderRadius: '9px', border: '1px solid #c9a961', background: '#15233a', color: '#c9a961', cursor: 'pointer', fontWeight: 600 }}>
                {mode === 'buy' ? 'Kaufen' : 'Verkaufen'} zu {oppPrice} Cr
              </button>
              <button onClick={() => setRunning(r => !r)} style={{ padding: '12px 16px', borderRadius: '9px', border: '0.5px solid #2a4e7a', background: 'transparent', color: '#cfe0f5', cursor: 'pointer' }}>
                {running ? 'Pause' : 'Weiter'}
              </button>
            </div>
          </div>
        </div>

        {/* Log */}
        <div style={{ marginTop: '12px', fontSize: '0.72rem', minHeight: '20px', fontFamily: 'monospace', color: log ? (log.ok ? '#5dcaa5' : '#e0846a') : '#9fb4cf' }}>
          {log ? log.text : mode === 'buy' ? 'Der Verkäufer nähert sich von oben — schlag zu, bevor die NPCs die Menge wegschnappen.' : 'Der Käufer nähert sich von unten.'}
        </div>
      </div>
    </div>
  )
}
