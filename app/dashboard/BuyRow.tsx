// app/dashboard/BuyRow.tsx
// Erstellt:     15.06.2026
// Aktualisiert: 15.06.2026
//
// Handelszeile (Kauf/Verkauf einer Ressource) der Handelszentrale.
// Aus DashboardClient.tsx herausgelöst (Refactor Schritt 2). Bezieht
// Design-Tokens und Display-Maps aus ./ui statt über Props — der frühere
// T-Prop entfällt damit.

'use client'

import { useState } from 'react'
import { T, RESOURCE_ICON, RESOURCE_LABEL } from './ui'

export default function BuyRow({ p, last, cargoFree, owned, costBasis, onBuy, onSell }: {
  p: any
  last: boolean
  cargoFree: number
  owned: number
  costBasis: number
  onBuy: (amt: number, limit: number) => void
  onSell: (amt: number, limit: number) => void
}) {
  const [amount, setAmount] = useState(1)
  // Auktions-Vorbereitung: null = zu, sonst 'buy'/'sell' mit Limit-Eingabe offen.
  const [prep, setPrep] = useState<null | 'buy' | 'sell'>(null)
  const [limit, setLimit] = useState(0)

  const stepBtn: React.CSSProperties = { width: '26px', height: '26px', borderRadius: '7px', border: `1px solid ${T.line}`, background: T.bg, color: T.blue, cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1 }
  const cap = Math.max(1, cargoFree)
  function setFromInput(raw: string) {
    const n = parseInt(raw.replace(/\D/g, ''), 10)
    if (Number.isNaN(n)) { setAmount(1); return }
    setAmount(Math.min(cap, Math.max(1, n)))
  }

  // Limit-Grenzen je Modus: Kauf = bis buy_price (höchstes sinnvolles Gebot),
  // Verkauf = mindestens etwas über 0, höchstens buy_price.
  const limitMin = 10
  const limitMax = p.buy_price
  function openPrep(mode: 'buy' | 'sell') {
    // Default-Limit: Kauf = buy_price (sicher), Verkauf = sell_price (sicher).
    setLimit(mode === 'buy' ? p.buy_price : p.sell_price)
    setPrep(mode)
  }
  function setLimitFromInput(raw: string) {
    const n = parseInt(raw.replace(/\D/g, ''), 10)
    if (Number.isNaN(n)) { setLimit(limitMin); return }
    setLimit(Math.min(limitMax, Math.max(limitMin, n)))
  }
  function confirm() {
    if (prep === 'buy') onBuy(amount, limit)
    else if (prep === 'sell') onSell(amount, limit)
    setPrep(null); setAmount(1)
  }

  return (
    <div style={{ borderBottom: last ? 'none' : `1px solid ${T.lineSoft}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 260px', alignItems: 'center', padding: '0.9rem 1.35rem' }}>
        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{RESOURCE_ICON[p.resource]} {RESOURCE_LABEL[p.resource]}</span>
        <span style={{ fontSize: '0.78rem', color: T.inkSoft }}>Kauf <strong style={{ color: T.red }}>{p.buy_price}</strong></span>
        <span style={{ fontSize: '0.78rem', color: T.inkSoft }}>Verk <strong style={{ color: T.green }}>{p.sell_price}</strong></span>
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button style={stepBtn} onClick={() => setAmount((a: number) => Math.max(1, a - 1))}>−</button>
          <input
            type="text" inputMode="numeric" value={amount}
            onChange={e => setFromInput(e.target.value)}
            onFocus={e => e.target.select()}
            style={{ width: '44px', height: '26px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, border: `1px solid ${T.line}`, borderRadius: '7px', color: T.ink, background: '#fff' }}
          />
          <button style={stepBtn} onClick={() => setAmount((a: number) => Math.min(cap, a + 1))}>+</button>
          <button style={{ background: T.blue, color: '#fff', border: 'none', padding: '0.4rem 0.8rem', fontSize: '0.74rem', fontWeight: 600, borderRadius: '7px', cursor: 'pointer' }} onClick={() => openPrep('buy')}>Kaufen</button>
          <button style={{ background: 'transparent', color: T.blue, border: `1px solid ${T.line}`, padding: '0.4rem 0.8rem', fontSize: '0.74rem', fontWeight: 600, borderRadius: '7px', cursor: 'pointer', opacity: owned > 0 ? 1 : 0.4 }} onClick={() => openPrep('sell')}>Verk.</button>
        </div>
      </div>

      {/* Auktions-Vorbereitung: Limit setzen, bevor die Auktion öffnet */}
      {prep && (
        <div style={{ padding: '0.9rem 1.35rem', background: T.bg, borderTop: `1px solid ${T.lineSoft}`, display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: T.blueDeep }}>
              {prep === 'buy' ? 'Maximalgebot' : 'Mindestpreis'} für {amount}t {RESOURCE_LABEL[p.resource]}
            </span>
            {prep === 'sell' && (
              <span style={{ fontSize: '0.7rem', color: T.inkSoft }}>
                dein Einstand: <strong style={{ color: costBasis > 0 ? T.ink : T.inkFaint }}>{costBasis > 0 ? `${costBasis} Cr/t` : '–'}</strong>
                {costBasis > 0 && limit < costBasis && (
                  <span style={{ color: T.red, marginLeft: '6px' }}>unter Einstand!</span>
                )}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <input
              type="range" min={limitMin} max={limitMax} value={limit}
              onChange={e => setLimit(parseInt(e.target.value, 10))}
              style={{ flex: 1, accentColor: T.blue }}
            />
            <input
              type="text" inputMode="numeric" value={limit}
              onChange={e => setLimitFromInput(e.target.value)}
              onFocus={e => e.target.select()}
              style={{ width: '60px', height: '28px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, border: `1px solid ${T.line}`, borderRadius: '7px', color: T.ink, background: '#fff' }}
            />
            <span style={{ fontSize: '0.72rem', color: T.inkFaint }}>Cr/t</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={{ flex: 1, background: prep === 'buy' ? T.blue : T.green, color: '#fff', border: 'none', padding: '0.5rem', fontSize: '0.78rem', fontWeight: 600, borderRadius: '7px', cursor: 'pointer' }} onClick={confirm}>
              Auktion starten ({prep === 'buy' ? 'Kauf' : 'Verkauf'})
            </button>
            <button style={{ background: 'transparent', color: T.inkSoft, border: `1px solid ${T.line}`, padding: '0.5rem 1rem', fontSize: '0.78rem', borderRadius: '7px', cursor: 'pointer' }} onClick={() => setPrep(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
