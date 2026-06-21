// app/dashboard/MarketAuction.tsx
// Erstellt:     01.06.2026
// Aktualisiert: 14.06.2026
// Version:      0.3.0
//
// v0.3.0: BUGFIX Endlos-Wiederholung. Die Auktion startete nach jeder Buchung
// neu, weil der Start-useEffect von startAuction → playerMaxQty (Credits/Cargo)
// abhing: jede erfolgreiche Buchung änderte die Credits → startAuction war eine
// neue Funktion → useEffect feuerte → Auktion lief von vorn → kaufte erneut, bis
// kein Geld mehr da war. Fix: startedRef-Guard (eine Sitzung startet genau einmal),
// und nach dem Spieler-Deal wird der Loop hart beendet (running=false, endedRef).
// Außerdem: Buchung läuft als EIN atomarer onTrade-Call (Cargo-Loop-Fix, trade
// v0.4.0) — der alte „1t pro Call"-Kommentar ist überholt.
//
// v0.2.0: Horizontales Mehrbalken-Layout (Käufer vs. gemeinsamer Verkäufer).

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ResourceType, LocationSlug } from '@/lib/store/gameStore'
import { PRICE_MIN, PRICE_MAX, STOCK_LOW_THRESHOLD } from '@/lib/game/config'

const RESOURCE_LABEL: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }
const RESOURCE_ICON:  Record<string, string> = { water: '💧', energy: '⚡', metal: '⛏️' }

const TICK_MS = 120
const STEP_BASE = 1.2

type Mode = 'buy' | 'sell'

interface Buyer {
  id: string
  name: string
  color: string
  isPlayer: boolean
  price: number
  aggr: number
  want: number
  got: number
  done: boolean
}

interface MarketRow {
  resource: ResourceType
  buy_price: number
  sell_price: number
  stock: number
}

function sellerFloor(row: MarketRow): number {
  const scarcity = Math.max(0, (STOCK_LOW_THRESHOLD - row.stock) / STOCK_LOW_THRESHOLD)
  return Math.round(row.sell_price * (1 + 0.4 * scarcity))
}
function buyerCeiling(row: MarketRow): number {
  return row.buy_price
}

function clampPrice(p: number) { return Math.max(PRICE_MIN, Math.min(PRICE_MAX, p)) }
function xpct(price: number) { return clampPrice(price) / PRICE_MAX * 100 }
function fmt(n: number) { return Math.round(n).toLocaleString('de-DE') }

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
  initialResource,
  initialMode,
  initialQty,
  playerLimit,
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
  initialResource: ResourceType
  initialMode: Mode
  initialQty: number
  playerLimit: number
}) {
  const mode = initialMode
  const resource = initialResource
  const playerQty = initialQty
  const limit = playerLimit
  const [running, setRunning] = useState(true)
  const [log, setLog] = useState<{ text: string; ok: boolean } | null>(null)

  const sellerPriceRef = useRef(0)
  const sellerStockRef = useRef(0)
  const buyersRef = useRef<Buyer[]>([])
  const endedRef = useRef(false)
  const playerDoneRef = useRef(false)
  // Guard: eine Auktions-Sitzung startet genau EINMAL. Verhindert den
  // Auto-Neustart durch Credit-/Cargo-Änderungen (→ playerMaxQty → startAuction).
  const startedRef = useRef(false)

  const [view, setView] = useState({ sellerPrice: 0, sellerStock: 0, buyers: [] as Buyer[] })

  const row = rows.find(r => r.resource === resource)

  // playerMaxQty wird in einem Ref eingefroren, sobald die Auktion startet —
  // damit spätere Credit-Änderungen die laufende Sitzung nicht beeinflussen.
  const playerMaxQty = (() => {
    if (!row) return 0
    if (mode === 'buy') {
      const free = cargoMax - (cargo.water + cargo.energy + cargo.metal)
      return Math.max(0, Math.min(free, row.stock))
    }
    return cargo[resource] ?? 0
  })()
  const frozenMaxRef = useRef(0)

  const startAuction = useCallback(() => {
    if (!row) return
    endedRef.current = false
    playerDoneRef.current = false
    frozenMaxRef.current = playerMaxQty   // Menge fix für diese Sitzung
    setLog(null)

    const floor = sellerFloor(row)
    const ceil = buyerCeiling(row)

    sellerPriceRef.current = clampPrice(ceil + 10)

    if (mode === 'buy') {
      sellerStockRef.current = row.stock
    } else {
      sellerStockRef.current = Math.min(playerQty, frozenMaxRef.current)
    }

    const buyers: Buyer[] = []
    if (mode === 'buy') {
      const nNpc = 2 + Math.floor(Math.random() * 3)
      buyers.push({
        id: 'player', name: 'Du', color: '#c9a961', isPlayer: true,
        price: clampPrice(floor - 10), aggr: 0,
        want: Math.min(playerQty, frozenMaxRef.current), got: 0, done: false,
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
    setRunning(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, mode, playerQty])

  // Start GENAU EINMAL pro Öffnen. Beim Schließen Guard zurücksetzen, damit die
  // nächste Auktion wieder startet. Bewusst NICHT von startAuction/playerMaxQty
  // abhängig — das war die Ursache des Endlos-Neustarts.
  useEffect(() => {
    if (open && row && !startedRef.current) {
      startedRef.current = true
      startAuction()
    }
    if (!open) {
      startedRef.current = false
      endedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row])

  useEffect(() => {
    if (!open || !running || !row) return
    const floor = sellerFloor(row)

    const iv = setInterval(() => {
      if (endedRef.current) return

      // Verkäufer sinkt Richtung Reservationspreis. Ist der Spieler der Verkäufer,
      // ist sein Mindestpreis (limit) die Untergrenze — er geht nicht darunter.
      const sellerBottom = mode === 'sell' ? Math.max(floor, limit) : floor
      if (sellerPriceRef.current > sellerBottom) {
        sellerPriceRef.current = Math.max(sellerBottom, sellerPriceRef.current - STEP_BASE)
      }
      const sp = sellerPriceRef.current

      for (const b of buyersRef.current) {
        if (b.done) continue
        const speed = (b.isPlayer ? 0.5 : b.aggr) * (STEP_BASE + 0.6)
        // Spieler-Cursor stoppt an seinem Limit (Max-Gebot beim Kauf), NPCs nicht.
        const ceilingForBuyer = b.isPlayer ? Math.min(sp, limit) : sp
        b.price = Math.min(ceilingForBuyer, b.price + speed)

        // Treffer nur, wenn Käufer den Verkäufer wirklich erreicht. Beim Spieler
        // heißt das: sein (am Limit gedeckelter) Preis muss den Verkäufer treffen.
        // Liegt der Verkäufer-Floor über dem Limit, trifft er nie → leer.
        if (b.price >= sp - 0.5 && sellerStockRef.current > 0) {
          const take = Math.min(b.want - b.got, sellerStockRef.current)
          if (take > 0) {
            b.got += take
            sellerStockRef.current -= take
          }
          b.done = true

          if (b.isPlayer) {
            playerDoneRef.current = true
            endedRef.current = true
            setRunning(false)
            const dealPrice = Math.round(sp)
            const dealQty = b.got
            settlePlayer(dealQty, dealPrice)
          } else {
            setLog({ text: `${b.name} kauft ${take}t zu ${Math.round(sp)} Cr · Rest ${sellerStockRef.current}t`, ok: false })
          }
        }
      }

      // Spieler-Käufer am Limit, aber Verkäufer bleibt darüber → leer ausgegangen.
      if (mode === 'buy') {
        const player = buyersRef.current.find(b => b.isPlayer)
        if (player && !player.done && player.price >= limit - 0.5 && sp > limit + 0.5) {
          player.done = true
          playerDoneRef.current = true
          endedRef.current = true
          setRunning(false)
          setLog({ text: `Dein Limit (${limit} Cr) wurde nicht erreicht – kein Zuschlag.`, ok: false })
        }
      }

      const allDone = buyersRef.current.every(b => b.done)
      if (sellerStockRef.current <= 0 || allDone) {
        endedRef.current = true
        if (mode === 'sell' && playerDoneRef.current === false) {
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
  }, [open, running, row, mode])

  // Spieler war KÄUFER und hat einen Deal getroffen — EIN atomarer Call.
  async function settlePlayer(qty: number, price: number) {
    if (!row) return
    if (qty <= 0) { setLog({ text: 'Kein Zuschlag – Vorrat war erschöpft.', ok: false }); return }
    // Server deckt Credits- und Cargo-Check ab (maxByCredits, maxByCargo in trade/route.ts).
    // Client-seitige affordable-Prüfung führt zu Fehlanzeigen wenn Credits zwischen
    // Auktionsstart und Abschluss verändert wurden. Wir senden qty und lassen den
    // Server die tatsächlich gebuchte Menge bestimmen.
    const ok = await onTrade(resource, 'buy', qty, price)
    setLog({ text: ok ? `✓ Gekauft: ${qty}t ${RESOURCE_LABEL[resource]} zu ${price} Cr.` : 'Kauf fehlgeschlagen – prüfe Credits und Laderaum.', ok })
  }

  async function settleSellerPlayer() {
    if (!row) return
    const offered = Math.min(playerQty, frozenMaxRef.current)
    const soldQty = offered - sellerStockRef.current
    const price = Math.round(sellerPriceRef.current)
    if (soldQty <= 0) { setLog({ text: 'Niemand hat zu deinem Preis gekauft.', ok: false }); return }
    const ok = await onTrade(resource, 'sell', soldQty, price)
    setLog({ text: ok ? `✓ Verkauft: ${soldQty}t ${RESOURCE_LABEL[resource]} zu ${price} Cr.` : 'Verkauf fehlgeschlagen.', ok })
  }

  if (!open || !row) return null

  const floor = sellerFloor(row)
  const ceil = buyerCeiling(row)

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(2,4,8,0.92)', zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
  }
  const panel: React.CSSProperties = {
    background: '#020408', border: '1px solid rgba(201,169,97,0.35)', borderRadius: '12px',
    width: '100%', maxWidth: '820px', padding: '1.5rem', color: '#e8e6df', fontFamily: 'system-ui, sans-serif',
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid rgba(201,169,97,0.3)', paddingBottom: '12px', marginBottom: '14px' }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.25rem', color: '#c9a961' }}>Handelszentrale · Live-Auktion</div>
            <div style={{ fontSize: '0.72rem', color: '#7d93b0' }}>{locationName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '0.5px solid #2a4e7a', color: '#cfe0f5', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem' }}>Schließen ✕</button>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px', fontSize: '0.78rem' }}>
          <span style={{ color: '#cfe0f5', fontWeight: 600 }}>{RESOURCE_ICON[resource]} {RESOURCE_LABEL[resource]}</span>
          <span style={{ background: mode === 'buy' ? 'rgba(29,158,117,0.15)' : 'rgba(201,169,97,0.15)', border: `0.5px solid ${mode === 'buy' ? '#1d9e75' : '#c9a961'}`, color: mode === 'buy' ? '#5dcaa5' : '#e0c486', borderRadius: '6px', padding: '2px 10px', fontSize: '0.72rem' }}>
            {mode === 'buy' ? 'Du kaufst' : 'Du verkaufst'}
          </span>
          <span style={{ color: '#7d93b0', fontSize: '0.72rem' }}>
            Menge: <strong style={{ color: '#c9a961' }}>{Math.min(playerQty, playerMaxQty)}t</strong>
          </span>
        </div>

        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#5f7596', margin: '0 70px 6px 90px' }}>
            <span>günstig · {PRICE_MIN} Cr</span>
            <span>Verkäufer-Boden {floor} Cr</span>
            <span>teuer · {PRICE_MAX} Cr</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {view.buyers.map(b => {
              const buyerX = xpct(b.price)
              const sellerX = xpct(view.sellerPrice)
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: '0 0 82px', textAlign: 'right', fontSize: '0.7rem', color: b.isPlayer ? '#c9a961' : '#cfe0f5', fontWeight: b.isPlayer ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b.name}
                  </div>
                  <div style={{ position: 'relative', flex: 1, height: b.isPlayer ? '28px' : '22px', background: b.isPlayer ? 'rgba(201,169,97,0.07)' : '#06101c', border: `0.5px solid ${b.isPlayer ? 'rgba(201,169,97,0.4)' : '#1f3650'}`, borderRadius: '5px', opacity: b.done && !b.isPlayer ? 0.45 : 1 }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${buyerX}%`, background: `linear-gradient(to right, ${b.color}22, ${b.color}44)`, borderRight: `2px solid ${b.color}`, borderRadius: '5px 0 0 5px', transition: 'width 0.12s linear' }} />
                    <div style={{ position: 'absolute', left: `calc(${buyerX}% - 4px)`, top: '50%', transform: 'translateY(-50%)', fontSize: '0.6rem', fontFamily: 'monospace', color: b.color, whiteSpace: 'nowrap', paddingLeft: '6px' }}>
                      {Math.round(b.price)}
                    </div>
                    <div style={{ position: 'absolute', left: `${sellerX}%`, top: '-2px', bottom: '-2px', width: '2px', background: '#e0846a', transition: 'left 0.12s linear' }} />
                    {b.got > 0 && (
                      <div style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.62rem', color: '#5dcaa5', fontFamily: 'monospace' }}>
                        ✓ {b.got}t
                      </div>
                    )}
                  </div>
                  <div style={{ flex: '0 0 48px', fontSize: '0.64rem', color: '#7d93b0', fontFamily: 'monospace' }}>
                    {b.done ? `${b.got}/${b.want}t` : `will ${b.want}t`}
                  </div>
                </div>
              )
            })}
          </div>

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

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button onClick={() => setRunning(r => !r)} disabled={endedRef.current} style={{ flex: 1, padding: '10px 0', borderRadius: '9px', border: '0.5px solid #2a4e7a', background: 'transparent', color: endedRef.current ? '#4a5a70' : '#cfe0f5', cursor: endedRef.current ? 'default' : 'pointer', fontSize: '0.82rem' }}>
              {running ? 'Pause' : 'Weiter'}
            </button>
            <button onClick={() => { endedRef.current = true; onClose() }} style={{ flex: 1, padding: '10px 0', borderRadius: '9px', border: '0.5px solid #1f3650', background: 'transparent', color: '#9fb4cf', cursor: 'pointer', fontSize: '0.82rem' }}>
              Schließen
            </button>
          </div>
        </>

        <div style={{ marginTop: '12px', fontSize: '0.72rem', minHeight: '20px', fontFamily: 'monospace', color: log ? (log.ok ? '#5dcaa5' : '#e0846a') : '#9fb4cf' }}>
          {log ? log.text
            : (mode === 'buy' ? 'Dein Gebot steigt automatisch. Triffst du den Verkäufer zuerst, bekommst du deine Menge.' : 'Die Käufer steigen Richtung deines Preises. Wer trifft, kauft.')}
        </div>
      </div>
    </div>
  )
}
