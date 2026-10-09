'use client'

// app/dashboard/BuyRow.tsx
// Erstellt:     15.06.2026
// Aktualisiert: 09.10.2026 — Direkthandel zum Marktpreis statt Auktions-Vorbereitung:
//               Bestätigung zeigt Menge × Preis; abgerechnet wird, was der Server bucht.
// Version:      2.0.0
//
// Handelszeile (Kauf/Verkauf einer Ressource) der Handelszentrale.
// Aus DashboardClient.tsx herausgelöst (Refactor Schritt 2). Bezieht
// Design-Tokens und Display-Maps aus ./ui statt über Props — der frühere
// T-Prop entfällt damit.

import React from 'react'

import { useState } from 'react'
import { T, RESOURCE_ICON, RESOURCE_LABEL } from './ui'

export default function BuyRow({ p, last, cargoFree, owned, onBuy, onSell }: {
  key?: string
  p: any
  last: boolean
  cargoFree: number
  owned: number
  /** Nicht mehr verwendet (Einstand wird nicht serverseitig geführt); bleibt für Aufrufer kompatibel. */
  costBasis?: number
  onBuy: (amt: number, price: number) => unknown
  onSell: (amt: number, price: number) => unknown
}) {
  const [amount, setAmount] = useState(1)
  // null = zu, sonst offene Bestätigung für Kauf oder Verkauf.
  const [prep, setPrep] = useState<null | 'buy' | 'sell'>(null)
  const [busy, setBusy] = useState(false)

  const stepBtn: React.CSSProperties = { width: '26px', height: '26px', borderRadius: '7px', border: `1px solid ${T.line}`, background: T.bg, color: T.blue, cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1 }
  // Obergrenze: Verkauf = eigener Bestand, sonst freier Frachtraum.
  const cap = prep === 'sell' ? Math.max(1, owned) : Math.max(1, cargoFree)
  function setFromInput(raw: string) {
    const n = parseInt(raw.replace(/\D/g, ''), 10)
    if (Number.isNaN(n)) { setAmount(1); return }
    setAmount(Math.min(cap, Math.max(1, n)))
  }
  function openPrep(mode: 'buy' | 'sell') {
    const limit = mode === 'sell' ? Math.max(1, owned) : Math.max(1, cargoFree)
    setAmount(a => Math.min(limit, Math.max(1, a)))
    setPrep(mode)
  }
  async function confirm() {
    if (!prep || busy) return
    setBusy(true)
    try {
      if (prep === 'buy') await onBuy(amount, p.buy_price)
      else await onSell(amount, p.sell_price)
    } finally {
      setBusy(false); setPrep(null); setAmount(1)
    }
  }

  const unit = prep === 'sell' ? p.sell_price : p.buy_price
  const canBuy = cargoFree > 0
  const canSell = owned > 0

  return (
    <div style={{ borderBottom: last ? 'none' : `1px solid ${T.lineSoft}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 260px', alignItems: 'center', padding: '0.9rem 1.35rem' }}>
        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{RESOURCE_ICON[p.resource]} {RESOURCE_LABEL[p.resource]}</span>
        <span style={{ fontSize: '0.78rem', color: T.inkSoft }}>Kauf <strong style={{ color: T.red }}>{p.buy_price}</strong></span>
        <span style={{ fontSize: '0.78rem', color: T.inkSoft }}>Verk <strong style={{ color: T.green }}>{p.sell_price}</strong>{owned > 0 && <span style={{ color: T.inkFaint }}> · {owned} t an Bord</span>}</span>
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button aria-label="Menge verringern" style={stepBtn} onClick={() => setAmount((a: number) => Math.max(1, a - 1))}>−</button>
          <input
            type="text" inputMode="numeric" value={amount} aria-label="Menge in Tonnen"
            onChange={e => setFromInput(e.target.value)}
            onFocus={e => e.target.select()}
            style={{ width: '44px', height: '26px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, border: `1px solid ${T.line}`, borderRadius: '7px', color: T.ink, background: '#fff' }}
          />
          <button aria-label="Menge erhöhen" style={stepBtn} onClick={() => setAmount((a: number) => Math.min(cap, a + 1))}>+</button>
          <button disabled={!canBuy} style={{ background: T.blue, color: '#fff', border: 'none', padding: '0.4rem 0.8rem', fontSize: '0.74rem', fontWeight: 600, borderRadius: '7px', cursor: canBuy ? 'pointer' : 'not-allowed', opacity: canBuy ? 1 : 0.4 }} onClick={() => openPrep('buy')}>Kaufen</button>
          <button disabled={!canSell} style={{ background: 'transparent', color: T.blue, border: `1px solid ${T.line}`, padding: '0.4rem 0.8rem', fontSize: '0.74rem', fontWeight: 600, borderRadius: '7px', cursor: canSell ? 'pointer' : 'not-allowed', opacity: canSell ? 1 : 0.4 }} onClick={() => openPrep('sell')}>Verk.</button>
        </div>
      </div>

      {/* Bestätigung: Menge × Marktpreis. Steuern und Spediteurgebühr rechnet der Server ab. */}
      {prep && (
        <div style={{ padding: '0.9rem 1.35rem', background: T.bg, borderTop: `1px solid ${T.lineSoft}`, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontSize: '0.8rem', color: T.blueDeep }}>
            <strong>{amount} t {RESOURCE_LABEL[p.resource]}</strong> {prep === 'buy' ? 'kaufen' : 'verkaufen'} zu {unit} Cr/t = <strong>{(amount * unit).toLocaleString('de')} Cr</strong>
            <span style={{ color: T.inkFaint }}> · {prep === 'buy' ? 'zuzüglich' : 'abzüglich'} Abgaben des Standorts</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button disabled={busy} style={{ flex: 1, background: prep === 'buy' ? T.blue : T.green, color: '#fff', border: 'none', padding: '0.5rem', fontSize: '0.78rem', fontWeight: 600, borderRadius: '7px', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }} onClick={() => void confirm()}>
              {busy ? 'Wird gebucht …' : prep === 'buy' ? 'Jetzt kaufen' : 'Jetzt verkaufen'}
            </button>
            <button disabled={busy} style={{ background: 'transparent', color: T.inkSoft, border: `1px solid ${T.line}`, padding: '0.5rem 1rem', fontSize: '0.78rem', borderRadius: '7px', cursor: 'pointer' }} onClick={() => setPrep(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
