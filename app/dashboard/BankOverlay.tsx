// app/dashboard/BankOverlay.tsx
// Erstellt:     22.06.2026
// Aktualisiert: 22.06.2026 — Initiale Version: Einlagen, Kredite, Buchungshistorie
// Version:      1.0.0
'use client'

import React, { useState, useEffect } from 'react'

interface BankOverlayProps {
  locationSlug: string
  locationName: string
  credits:      number
  onClose:      () => void
  onCreditsChanged: (newCredits: number) => void
}

const BANK_BG: Record<string, { src: string; label: string }> = {
  moon:        { src: '/images/building-backgrounds/bank-back-moon.png',        label: 'Mond · Shackleton Bank' },
  mars:        { src: '/images/building-backgrounds/bank-back-mars.png',        label: 'Mars · Tharsis Finanz' },
  phobos:      { src: '/images/building-backgrounds/bank-back-phobos.png',      label: 'Phobos · Freihafen Kredit' },
  prometheus:  { src: '/images/building-backgrounds/bank-back-prometheus.png',  label: 'Prometheus Station · SCB Filiale' },
  earth:       { src: '/images/building-backgrounds/bank-back-earth.png',       label: 'Erde · Solar Central Bank' },
}

const MONO = "'Courier Prime', monospace"

const C = {
  bg:          'rgba(248,245,238,0.93)',
  bgAlt:       'rgba(242,237,228,0.95)',
  border:      '#ddd6c8',
  text:        '#1a1a18',
  textMuted:   '#6b6357',
  textFaint:   '#9e9485',
  accent:      '#2a4e7a',
  accentLight: '#e8eef6',
  gold:        '#8a6a00',
  goldLight:   '#faf3e0',
  green:       '#1a7a4a',
  greenLight:  '#e8f7ef',
  red:         '#b52a2a',
  redLight:    '#faeaea',
  white:       '#ffffff',
}

type Tab = 'konto' | 'einlage' | 'kredit'

interface BankStatus {
  credits:       number
  deposit:       number
  loan:          number
  creditLimit:   number
  availableLoan: number
  depositRate:   number
  loanRate:      number
  ledger:        LedgerEntry[]
}

interface LedgerEntry {
  id:            string
  entry_type:    string
  amount:        number
  balance_after: number
  note:          string
  created_at:    string
}

const ENTRY_LABELS: Record<string, { label: string; color: string; sign: string }> = {
  deposit:          { label: 'Einzahlung',    color: C.green,    sign: '→' },
  withdrawal:       { label: 'Auszahlung',    color: C.red,      sign: '←' },
  loan_taken:       { label: 'Kredit',        color: C.accent,   sign: '+' },
  loan_repaid:      { label: 'Tilgung',       color: C.green,    sign: '−' },
  interest_deposit: { label: 'Zinsen',        color: C.gold,     sign: '+' },
  interest_loan:    { label: 'Kreditzinsen',  color: C.red,      sign: '−' },
}

export default function BankOverlay({
  locationSlug, locationName, credits: initialCredits, onClose, onCreditsChanged,
}: BankOverlayProps) {
  const [tab, setTab]           = useState<Tab>('konto')
  const [status, setStatus]     = useState<BankStatus | null>(null)
  const [loading, setLoading]   = useState(true)
  const [amount, setAmount]     = useState('')
  const [busy, setBusy]         = useState(false)
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null)
  const [credits, setCredits]   = useState(initialCredits)

  useEffect(() => { loadStatus() }, [])

  async function getJwt(): Promise<string> {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const { data: { session } } = await createClient().auth.getSession()
      return session?.access_token ?? ''
    } catch { return '' }
  }

  async function loadStatus() {
    setLoading(true)
    try {
      const jwt = await getJwt()
      const r = await fetch(`/api/game/bank?action=status&location=${locationSlug}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      })
      const d = await r.json()
      if (d.error) { setMsg({ text: d.error, ok: false }); return }
      setStatus(d)
      setCredits(d.credits)
    } catch (e: any) {
      setMsg({ text: 'Verbindung zur Bank fehlgeschlagen', ok: false })
    } finally {
      setLoading(false)
    }
  }

  async function doAction(action: 'deposit' | 'withdraw' | 'loan' | 'repay') {
    const amt = parseInt(amount, 10)
    if (!Number.isFinite(amt) || amt <= 0) {
      setMsg({ text: 'Ungültiger Betrag', ok: false }); return
    }
    setBusy(true); setMsg(null)
    try {
      const jwt = await getJwt()
      const r = await fetch(
        `/api/game/bank?action=${action}&location=${locationSlug}&amount=${amt}`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      )
      const d = await r.json()
      if (d.error) { setMsg({ text: d.error, ok: false }); return }
      setMsg({ text: d.msg ?? 'Transaktion erfolgreich', ok: true })
      setAmount('')
      setCredits(d.credits)
      onCreditsChanged(d.credits)
      await loadStatus()
    } catch {
      setMsg({ text: 'Fehler bei der Transaktion', ok: false })
    } finally {
      setBusy(false)
    }
  }

  const bg = BANK_BG[locationSlug]
  const amt = parseInt(amount, 10)
  const amtValid = Number.isFinite(amt) && amt > 0

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', flexDirection: 'column' }}>

      {/* Hintergrundbild */}
      {bg && (
        <img
          src={bg.src}
          alt={bg.label}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,16,28,0.55)' }} />

      {/* Schließen */}
      <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.5rem', zIndex: 10, background: 'rgba(248,245,238,0.92)', border: `1px solid ${C.border}`, borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontSize: '1rem', color: C.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO }}>
        ✕
      </button>

      {/* Ortsbezeichnung */}
      {bg && (
        <div style={{ position: 'absolute', top: '1.25rem', left: '1.5rem', zIndex: 10, fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'rgba(248,245,238,0.85)', fontFamily: MONO, textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
          🏦 {bg.label}
        </div>
      )}

      {/* Panel */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '62%', background: C.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40px', left: 0, right: 0, height: '40px', background: `linear-gradient(to bottom, transparent, ${C.bg})`, pointerEvents: 'none' }} />

        {/* Tabs */}
        <div style={{ padding: '0.9rem 1.5rem 0', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 0, marginBottom: '-1px', alignItems: 'flex-end' }}>
            {(['konto', 'einlage', 'kredit'] as Tab[]).map(t => (
              <button key={t} onClick={() => { setTab(t); setMsg(null); setAmount('') }}
                style={{ padding: '0.5rem 1.2rem', border: `1px solid ${tab === t ? C.border : 'transparent'}`, borderBottom: tab === t ? `1px solid ${C.bg}` : `1px solid ${C.border}`, borderRadius: '6px 6px 0 0', cursor: 'pointer', fontFamily: MONO, fontSize: '0.78rem', fontWeight: 700, background: tab === t ? C.bg : C.bgAlt, color: tab === t ? C.accent : C.textMuted }}>
                {t === 'konto' ? 'Konto' : t === 'einlage' ? 'Einlage' : 'Kredit'}
              </button>
            ))}
            {/* Credits rechts */}
            <div style={{ marginLeft: 'auto', paddingBottom: '0.5rem', fontSize: '0.72rem', color: C.textMuted, fontFamily: MONO }}>
              Guthaben: <span style={{ color: C.gold, fontWeight: 700 }}>{credits.toLocaleString('de')} Cr</span>
            </div>
          </div>
        </div>

        {/* Inhalt */}
        <div style={{ flex: 1, overflowY: 'auto' as const, padding: '1.25rem 1.5rem 1.5rem' }}>

          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: C.textMuted, fontFamily: MONO, fontSize: '0.85rem' }}>
              Verbindung zur Bank …
            </div>
          )}

          {/* Fehlermeldung global */}
          {!loading && msg && (
            <div style={{ marginBottom: '1rem', padding: '0.7rem 1rem', background: msg.ok ? C.greenLight : C.redLight, border: `1px solid ${msg.ok ? '#a0dcb8' : '#f0a0a0'}`, borderRadius: '8px', fontSize: '0.82rem', color: msg.ok ? C.green : C.red, fontFamily: MONO }}>
              {msg.text}
            </div>
          )}

          {/* ── KONTO-ÜBERSICHT ─────────────────────────────────────────── */}
          {!loading && tab === 'konto' && status && (
            <>
              {/* Kennzahlen */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'Einlage', value: `${status.deposit.toLocaleString('de')} Cr`, sub: `+${(status.depositRate * 100).toFixed(1)}%/Tick Zinsen`, color: C.green },
                  { label: 'Kredit', value: `${status.loan.toLocaleString('de')} Cr`, sub: status.loan > 0 ? `−${(status.loanRate * 100).toFixed(1)}%/Tick Zinsen` : 'Kein offener Kredit', color: status.loan > 0 ? C.red : C.textFaint },
                  { label: 'Kreditlimit', value: `${status.creditLimit.toLocaleString('de')} Cr`, sub: 'Wächst mit Handelsvolumen', color: C.accent },
                  { label: 'Verfügbar', value: `${status.availableLoan.toLocaleString('de')} Cr`, sub: 'Sofort abrufbar', color: status.availableLoan > 0 ? C.accent : C.textFaint },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '0.85rem 1rem' }}>
                    <div style={{ fontSize: '0.62rem', color: C.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase' as const, fontFamily: MONO, marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color, fontFamily: MONO }}>{value}</div>
                    <div style={{ fontSize: '0.65rem', color: C.textFaint, marginTop: '3px' }}>{sub}</div>
                  </div>
                ))}
              </div>

              {/* Buchungshistorie */}
              <div style={{ fontSize: '0.62rem', color: C.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase' as const, fontFamily: MONO, marginBottom: '0.6rem' }}>
                Letzte Buchungen
              </div>
              {status.ledger.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: C.textFaint, fontFamily: MONO, padding: '0.5rem 0' }}>Noch keine Transaktionen.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {status.ledger.map(entry => {
                    const meta = ENTRY_LABELS[entry.entry_type] ?? { label: entry.entry_type, color: C.textMuted, sign: '·' }
                    const date = new Date(entry.created_at).toLocaleDateString('de', { day: '2-digit', month: '2-digit' })
                    return (
                      <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: C.white, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '0.78rem' }}>
                        <span style={{ color: meta.color, fontWeight: 700, fontFamily: MONO, fontSize: '0.7rem', width: '80px', flexShrink: 0 }}>{meta.label}</span>
                        <span style={{ color: C.text, flex: 1, fontSize: '0.72rem' }}>{entry.note}</span>
                        <span style={{ color: meta.color, fontWeight: 700, fontFamily: MONO, flexShrink: 0 }}>{meta.sign}{entry.amount.toLocaleString('de')} Cr</span>
                        <span style={{ color: C.textFaint, fontSize: '0.65rem', flexShrink: 0 }}>{date}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── EINLAGE ─────────────────────────────────────────────────── */}
          {!loading && tab === 'einlage' && status && (
            <>
              {/* Info-Box */}
              <div style={{ background: C.greenLight, border: '1px solid #a0dcb8', borderRadius: '8px', padding: '0.85rem 1.1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.green, fontFamily: MONO, marginBottom: '4px' }}>Einlagenkonto</div>
                <div style={{ fontSize: '0.8rem', color: C.text, lineHeight: 1.65 }}>
                  Deine Einlage wächst mit <strong>{(status.depositRate * 100).toFixed(1)}% pro Tick</strong>. Jederzeit auszahlbar.
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontFamily: MONO }}>
                  <span style={{ color: C.textMuted }}>Aktuelle Einlage</span>
                  <span style={{ color: C.green, fontWeight: 700 }}>{status.deposit.toLocaleString('de')} Cr</span>
                </div>
              </div>

              {/* Einzahlen */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: C.textMuted, fontFamily: MONO, marginBottom: '0.4rem' }}>Betrag (Cr)</div>
                <input
                  type="number" min="10" placeholder="z.B. 500"
                  value={amount} onChange={e => setAmount(e.target.value)}
                  style={{ width: '100%', background: C.white, border: `1.5px solid ${C.border}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: C.text, fontSize: '1.05rem', fontFamily: MONO, outline: 'none', boxSizing: 'border-box' as const }}
                />
                <div style={{ fontSize: '0.65rem', color: C.textFaint, marginTop: '4px' }}>
                  Verfügbare Credits: {credits.toLocaleString('de')} Cr
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button onClick={() => doAction('deposit')} disabled={busy || !amtValid || amt > credits}
                  style={{ flex: 1, padding: '0.7rem', background: amtValid && amt <= credits ? C.green : C.border, color: amtValid && amt <= credits ? C.white : C.textFaint, border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: amtValid && amt <= credits ? 'pointer' : 'not-allowed', fontFamily: MONO }}>
                  {busy ? 'Wird gebucht…' : 'Einzahlen →'}
                </button>
                <button onClick={() => doAction('withdraw')} disabled={busy || !amtValid || amt > status.deposit}
                  style={{ flex: 1, padding: '0.7rem', background: amtValid && amt <= status.deposit ? C.bgAlt : C.border, color: amtValid && amt <= status.deposit ? C.text : C.textFaint, border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: amtValid && amt <= status.deposit ? 'pointer' : 'not-allowed', fontFamily: MONO }}>
                  {busy ? '…' : 'Auszahlen ←'}
                </button>
              </div>

              {/* Schnellwahl */}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.7rem' }}>
                {[100, 500, 1000, 5000].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))}
                    style={{ flex: 1, padding: '4px 0', background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '0.68rem', color: C.textMuted, cursor: 'pointer', fontFamily: MONO }}>
                    {v >= 1000 ? `${v/1000}k` : v}
                  </button>
                ))}
                <button onClick={() => setAmount(String(tab === 'einlage' ? Math.min(credits, 99999) : status.deposit))}
                  style={{ flex: 1, padding: '4px 0', background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '0.68rem', color: C.textMuted, cursor: 'pointer', fontFamily: MONO }}>
                  Max
                </button>
              </div>
            </>
          )}

          {/* ── KREDIT ──────────────────────────────────────────────────── */}
          {!loading && tab === 'kredit' && status && (
            <>
              {/* Info-Box */}
              <div style={{ background: status.loan > 0 ? C.redLight : C.accentLight, border: `1px solid ${status.loan > 0 ? '#f0a0a0' : '#b8cce8'}`, borderRadius: '8px', padding: '0.85rem 1.1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: status.loan > 0 ? C.red : C.accent, fontFamily: MONO, marginBottom: '4px' }}>
                  {status.loan > 0 ? `Offener Kredit: ${status.loan.toLocaleString('de')} Cr` : 'Kein offener Kredit'}
                </div>
                <div style={{ fontSize: '0.8rem', color: C.text, lineHeight: 1.65 }}>
                  Zinssatz: <strong>{(status.loanRate * 100).toFixed(1)}% pro Tick</strong> (Zinseszins). Kreditlimit wächst mit deinem Handelsvolumen.
                </div>
                <div style={{ marginTop: '0.6rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontFamily: MONO }}>
                  <span style={{ color: C.textMuted }}>Limit / Verfügbar</span>
                  <span style={{ color: C.accent, fontWeight: 700 }}>{status.creditLimit.toLocaleString('de')} / {status.availableLoan.toLocaleString('de')} Cr</span>
                </div>
              </div>

              {/* Betrag */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: C.textMuted, fontFamily: MONO, marginBottom: '0.4rem' }}>Betrag (Cr)</div>
                <input
                  type="number" min="100" placeholder="z.B. 2000"
                  value={amount} onChange={e => setAmount(e.target.value)}
                  style={{ width: '100%', background: C.white, border: `1.5px solid ${C.border}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: C.text, fontSize: '1.05rem', fontFamily: MONO, outline: 'none', boxSizing: 'border-box' as const }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button onClick={() => doAction('loan')} disabled={busy || !amtValid || amt > status.availableLoan}
                  style={{ flex: 1, padding: '0.7rem', background: amtValid && amt <= status.availableLoan ? C.accent : C.border, color: amtValid && amt <= status.availableLoan ? C.white : C.textFaint, border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: amtValid && amt <= status.availableLoan ? 'pointer' : 'not-allowed', fontFamily: MONO }}>
                  {busy ? 'Wird gebucht…' : 'Kredit aufnehmen →'}
                </button>
                <button onClick={() => doAction('repay')} disabled={busy || !amtValid || status.loan <= 0 || amt > credits}
                  style={{ flex: 1, padding: '0.7rem', background: amtValid && status.loan > 0 && amt <= credits ? C.bgAlt : C.border, color: amtValid && status.loan > 0 && amt <= credits ? C.text : C.textFaint, border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: amtValid && status.loan > 0 && amt <= credits ? 'pointer' : 'not-allowed', fontFamily: MONO }}>
                  {busy ? '…' : 'Tilgen ←'}
                </button>
              </div>

              {/* Schnellwahl */}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.7rem' }}>
                {[500, 1000, 2000, 5000].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))}
                    style={{ flex: 1, padding: '4px 0', background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '0.68rem', color: C.textMuted, cursor: 'pointer', fontFamily: MONO }}>
                    {v >= 1000 ? `${v/1000}k` : v}
                  </button>
                ))}
                <button onClick={() => setAmount(String(Math.min(status.availableLoan, credits)))}
                  style={{ flex: 1, padding: '4px 0', background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '0.68rem', color: C.textMuted, cursor: 'pointer', fontFamily: MONO }}>
                  Max
                </button>
              </div>

              {/* Zinswarnung bei großem Kredit */}
              {amtValid && amt >= 1000 && (
                <div style={{ marginTop: '0.85rem', padding: '0.6rem 0.85rem', background: 'rgba(181,42,42,0.06)', border: '1px solid #f0a0a0', borderRadius: '6px', fontSize: '0.72rem', color: C.red, fontFamily: MONO }}>
                  Zinslast/Tick: −{Math.round(amt * status.loanRate).toLocaleString('de')} Cr
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.5rem 1.5rem', borderTop: `1px solid ${C.border}`, fontSize: '0.62rem', color: C.textFaint, fontFamily: MONO, background: C.bgAlt, flexShrink: 0 }}>
          Solar Central Bank · Einlagen gesichert · Zinsen werden pro Tick automatisch gebucht
        </div>
      </div>
    </div>
  )
}
