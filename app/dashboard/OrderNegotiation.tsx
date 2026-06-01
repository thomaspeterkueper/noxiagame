// app/dashboard/OrderNegotiation.tsx
// Erstellt:     01.06.2026
// Aktualisiert: 01.06.2026
// Version:      0.1.0
//
// Auftrags-Verhandlung als Overlay. Öffnet sich per Klick auf einen Auftrag
// im Übersicht-Tab ("Verhandeln" statt sofortigem "Erfüllen").
//
// Mechanik:
//   - Die Kolonie macht ein Gegengebot, das mit der DRINGLICHKEIT steigt:
//     je weniger Restlaufzeit und je knapper das Lager, desto höher die Belohnung.
//   - Ein Gebots-Cursor steigt langsam vom Basiswert (reward) Richtung Maximum.
//   - Der Spieler kann jederzeit "Annehmen" — je länger er wartet, desto mehr
//     bietet die Kolonie, aber das Risiko: ein Tick lässt die Dringlichkeit fallen
//     (simuliert: andere Piloten könnten zuerst liefern → Gebot sinkt wieder).
//   - Abschluss läuft über das bestehende /api/game/orders?action=fulfill.
//     Der ausgehandelte Bonus wird hier nur als Anzeige berechnet; der echte
//     Reward bleibt serverseitig (fulfill), bis ihr einen Bonus-Parameter ergänzt.
//
// WICHTIG: Loop client-seitig, useEffect mit clearInterval. Kein Server-State.
// Voraussetzung Cargo/Standort wird wie bisher serverseitig in fulfill geprüft.

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const RESOURCE_LABEL: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }
const RESOURCE_ICON:  Record<string, string> = { water: '💧', energy: '⚡', metal: '⛏️' }
const LOC_ICON:       Record<string, string> = { moon: '🌙', mars: '🔴', phobos: '🪨' }

const TICK_MS = 140
const STEP_BASE = 0.012   // Anteil pro Tick, mit dem das Gebot Richtung Max wandert

interface OrderData {
  id: string
  resource: string
  amount: number
  reward: number          // Basis-Belohnung (reward aus trade_orders)
  expires_at?: string     // ISO; für Dringlichkeit
  locations?: { slug?: string; name?: string }
  stock?: number          // optional: Lagerstand der Kolonie für Dringlichkeit
}

// Maximaler Verhandlungsbonus: bis +50% über Basis, je nach Dringlichkeit.
function maxBonus(order: OrderData): number {
  let urgency = 0.25 // Grunddringlichkeit
  // Restlaufzeit < 6h → dringender
  if (order.expires_at) {
    const hoursLeft = (new Date(order.expires_at).getTime() - Date.now()) / 3.6e6
    if (hoursLeft < 6) urgency += 0.15
    if (hoursLeft < 2) urgency += 0.10
  }
  // Lager sehr knapp → dringender
  if (order.stock != null && order.stock < 30) urgency += 0.15
  return Math.round(order.reward * (1 + Math.min(0.5, urgency)))
}

export default function OrderNegotiation({
  order,
  onClose,
  onAccept,        // (orderId) => Promise<boolean> — ruft fulfill auf
  canFulfill,      // bool: ist Spieler am Ort + hat genug Cargo (Vorabprüfung im Parent)
  fulfillHint,     // string: Hinweis falls nicht erfüllbar (z.B. "Falscher Standort")
}: {
  order: OrderData | null
  onClose: () => void
  onAccept: (orderId: string) => Promise<boolean>
  canFulfill: boolean
  fulfillHint?: string
}) {
  const [offer, setOffer] = useState(0)
  const [running, setRunning] = useState(true)
  const [log, setLog] = useState<{ text: string; ok: boolean } | null>(null)
  const offerRef = useRef(0)
  const dirRef = useRef(1)
  const doneRef = useRef(false)

  const init = useCallback(() => {
    if (!order) return
    offerRef.current = order.reward
    dirRef.current = 1
    doneRef.current = false
    setOffer(order.reward)
    setLog(null)
  }, [order])

  useEffect(() => { if (order) init() }, [order, init])

  useEffect(() => {
    if (!order || !running) return
    const max = maxBonus(order)
    const iv = setInterval(() => {
      if (doneRef.current) return
      // Gebot pendelt langsam Richtung Max, fällt gelegentlich zurück
      // (simuliert konkurrierende Piloten, die das Angebot drücken)
      const dip = Math.random() < 0.08
      if (dip) dirRef.current = -1
      else if (offerRef.current >= max) dirRef.current = -1
      else if (offerRef.current <= order.reward) dirRef.current = 1

      const span = max - order.reward
      offerRef.current = Math.max(order.reward, Math.min(max, offerRef.current + dirRef.current * span * STEP_BASE))
      setOffer(Math.round(offerRef.current))
    }, TICK_MS)
    return () => clearInterval(iv)
  }, [order, running])

  if (!order) return null

  const max = maxBonus(order)
  const slug = order.locations?.slug ?? 'moon'
  const fillPct = max > order.reward ? ((offer - order.reward) / (max - order.reward)) * 100 : 0

  async function accept() {
    if (doneRef.current || !order) return
    if (!canFulfill) { setLog({ text: fulfillHint ?? 'Auftrag aktuell nicht erfüllbar.', ok: false }); return }
    doneRef.current = true
    setRunning(false)
    const ok = await onAccept(order.id)
    setLog({ text: ok ? `✓ Auftrag erfüllt · +${offer.toLocaleString('de')} Cr` : 'Erfüllung fehlgeschlagen.', ok })
    if (ok) setTimeout(onClose, 1400)
    else doneRef.current = false
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(2,4,8,0.92)', zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
  }
  const panel: React.CSSProperties = {
    background: '#020408', border: '1px solid rgba(201,169,97,0.35)', borderRadius: '12px',
    width: '100%', maxWidth: '480px', padding: '1.5rem', color: '#e8e6df', fontFamily: 'system-ui, sans-serif',
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid rgba(201,169,97,0.3)', paddingBottom: '12px', marginBottom: '14px' }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.2rem', color: '#c9a961' }}>Verhandlung</div>
            <div style={{ fontSize: '0.72rem', color: '#7d93b0' }}>{LOC_ICON[slug]} {order.locations?.name ?? slug}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '0.5px solid #2a4e7a', color: '#cfe0f5', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '0.85rem', color: '#cfe0f5' }}>{RESOURCE_ICON[order.resource]} {order.amount}t {RESOURCE_LABEL[order.resource]}</div>
          <div style={{ fontSize: '0.68rem', color: '#7d93b0', marginTop: '3px' }}>Basis {order.reward.toLocaleString('de')} Cr · Maximum {max.toLocaleString('de')} Cr</div>
        </div>

        {/* Gebots-Anzeige */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#c9a961', fontFamily: 'monospace' }}>+{offer.toLocaleString('de')} Cr</div>
        </div>
        {/* Fortschrittsbalken Basis→Max */}
        <div style={{ height: '8px', background: '#06101c', border: '0.5px solid #1f3650', borderRadius: '4px', overflow: 'hidden', marginBottom: '14px' }}>
          <div style={{ width: `${Math.round(fillPct)}%`, height: '100%', background: '#c9a961', transition: 'width 0.14s linear' }} />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={accept} style={{ flex: 1, padding: '12px 0', fontSize: '0.95rem', borderRadius: '9px', border: '1px solid #1d9e75', background: '#15233a', color: '#5dcaa5', cursor: 'pointer', fontWeight: 600, opacity: canFulfill ? 1 : 0.5 }}>
            Annehmen
          </button>
          <button onClick={() => setRunning(r => !r)} style={{ padding: '12px 16px', borderRadius: '9px', border: '0.5px solid #2a4e7a', background: 'transparent', color: '#cfe0f5', cursor: 'pointer' }}>
            {running ? 'Pause' : 'Weiter'}
          </button>
        </div>

        <div style={{ marginTop: '12px', fontSize: '0.72rem', minHeight: '18px', fontFamily: 'monospace', textAlign: 'center', color: log ? (log.ok ? '#5dcaa5' : '#e0846a') : '#9fb4cf' }}>
          {log ? log.text : canFulfill ? 'Warte auf ein höheres Gebot — oder nimm an, bevor es fällt.' : (fulfillHint ?? 'Nicht erfüllbar.')}
        </div>
      </div>
    </div>
  )
}
