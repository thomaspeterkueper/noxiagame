// app/dashboard/BankOverlay.tsx
// Erstellt:     22.06.2026
// Aktualisiert: 15.07.2026 — X-Button im Panel, Sicherheiten-Fallback, Modul-ID fix
// Version:      1.3.0
//
// v1.1.0 – Sicherheiten-Tab, Zinseszins-Chart, Nachweis-Gate für Kredit
// v1.0.0 – Initiale Version: Einlagen, Kredite, Buchungshistorie
'use client'

import React, { useState, useEffect } from 'react'

interface BankOverlayProps {
  locationSlug:     string
  locationName:     string
  credits:          number
  onClose:          () => void
  onCreditsChanged: (newCredits: number) => void
}

const BANK_BG: Record<string, { src: string; label: string }> = {
  moon:       { src: '/images/building-backgrounds/bank-back-moon.png',       label: 'Mond · Shackleton Bank' },
  mars:       { src: '/images/building-backgrounds/bank-back-mars.png',       label: 'Mars · Tharsis Finanz' },
  phobos:     { src: '/images/building-backgrounds/bank-back-phobos.png',     label: 'Phobos · Freihafen Kredit' },
  prometheus: { src: '/images/building-backgrounds/bank-back-prometheus.png', label: 'Prometheus Station · SCB Filiale' },
  earth:      { src: '/images/building-backgrounds/bank-back-earth.png',      label: 'Erde · Solar Central Bank' },
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

type Tab = 'konto' | 'einlage' | 'kredit' | 'sicherheiten'

interface CollateralWarning {
  overLimit:        number
  requiredRepayment?: number
  message:          string
}

interface BankStatus {
  credits:           number
  deposit:           number
  loan:              number
  creditLimit:       number
  availableLoan:     number
  depositRate:       number
  loanRate:          number
  hasModule:         boolean
  moduleId:          string
  collateralTotal:   number
  collateralWarning: CollateralWarning | null
  ledger:            LedgerEntry[]
}

interface LedgerEntry {
  id:            string
  entry_type:    string
  amount:        number
  balance_after: number
  note:          string
  created_at:    string
}

interface CollateralData {
  total:     number
  buildings: { id: string; name: string; locationName: string; ertragswert: number }[]
  ships:     { id: string; name: string; shipTypeId: string; restwert: number }[]
  creditLimit:     number
  collateralRatio: number
  hasModule:       boolean
}

const ENTRY_LABELS: Record<string, { label: string; color: string }> = {
  deposit:          { label: 'Einzahlung',  color: '#1a7a4a' },
  withdrawal:       { label: 'Auszahlung',  color: '#b52a2a' },
  loan_taken:       { label: 'Kredit',      color: '#2a4e7a' },
  loan_repaid:      { label: 'Tilgung',     color: '#1a7a4a' },
  interest_deposit: { label: 'Zinsen',      color: '#8a6a00' },
  interest_loan:    { label: 'Kreditzinsen',color: '#b52a2a' },
}

const BUILDING_NAMES: Record<string, string> = {
  mine: 'Mine', solar: 'Solarfeld', ice_drill: 'Eisbohrung', water_recycler: 'Wasserrecycler',
}

export default function BankOverlay({
  locationSlug, locationName, credits: initialCredits, onClose, onCreditsChanged,
}: BankOverlayProps) {
  const [tab, setTab]               = useState<Tab>('konto')
  const [status, setStatus]         = useState<BankStatus | null>(null)
  const [collateral, setCollateral] = useState<CollateralData | null>(null)
  const [compound, setCompound]     = useState<{ loan: {tick:number;balance:number}[]; deposit: {tick:number;balance:number}[]; loanRate: number; depositRate: number } | null>(null)
  const [loading, setLoading]       = useState(true)
  const [amount, setAmount]         = useState('')
  const [busy, setBusy]             = useState(false)
  const [msg, setMsg]               = useState<{ text: string; ok: boolean } | null>(null)
  const [credits, setCredits]       = useState(initialCredits)
  const [previewTicks, setPreview]  = useState(10)

  useEffect(() => { loadAll() }, [])

  async function getJwt(): Promise<string> {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const { data: { session } } = await createClient().auth.getSession()
      return session?.access_token ?? ''
    } catch { return '' }
  }

  async function loadAll() {
    setLoading(true)
    try {
      const jwt = await getJwt()
      const headers = { Authorization: `Bearer ${jwt}` }
      const [sRes, cRes] = await Promise.all([
        fetch(`/api/game/bank?action=status&location=${locationSlug}`, { headers }),
        fetch(`/api/game/bank?action=collateral&location=${locationSlug}`, { headers }),
      ])
      const [s, c] = await Promise.all([sRes.json(), cRes.json()])
      if (!s.error) { setStatus(s); setCredits(s.credits) }
      if (!c.error) setCollateral(c)
      else if (s.error) setMsg({ text: s.error, ok: false })
    } catch {
      setMsg({ text: 'Verbindung zur Bank fehlgeschlagen', ok: false })
    } finally {
      setLoading(false)
    }
  }

  async function loadCompound(amt: number) {
    try {
      const jwt = await getJwt()
      const r = await fetch(`/api/game/bank?action=compound_preview&location=${locationSlug}&amount=${amt}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      })
      const d = await r.json()
      if (!d.error) setCompound(d)
    } catch {}
  }

  async function doAction(action: 'deposit' | 'withdraw' | 'loan' | 'repay') {
    const amt = parseInt(amount, 10)
    if (!Number.isFinite(amt) || amt <= 0) { setMsg({ text: 'Ungültiger Betrag', ok: false }); return }
    setBusy(true); setMsg(null)
    try {
      const jwt = await getJwt()
      const r = await fetch(`/api/game/bank?action=${action}&location=${locationSlug}&amount=${amt}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      })
      const d = await r.json()
      if (d.error) {
        setMsg({ text: d.error, ok: false })
        // Schulungsnachweis fehlt → Hinweis
        if (d.moduleId) setMsg({ text: `${d.error} — ${d.hint}`, ok: false })
        return
      }
      setMsg({ text: d.msg ?? 'Transaktion erfolgreich', ok: true })
      setAmount('')
      setCredits(d.credits)
      onCreditsChanged(d.credits)
      await loadAll()
    } catch {
      setMsg({ text: 'Fehler bei der Transaktion', ok: false })
    } finally {
      setBusy(false)
    }
  }

  // Zinseszins-Preview bei Betrag-Änderung im Kredit-Tab
  useEffect(() => {
    const amt = parseInt(amount, 10)
    if (tab === 'kredit' && Number.isFinite(amt) && amt >= 100) loadCompound(amt)
    else if (tab === 'kredit' && !compound) loadCompound(1000)
  }, [amount, tab])

  const bg = BANK_BG[locationSlug]
  const amt = parseInt(amount, 10)
  const amtValid = Number.isFinite(amt) && amt > 0

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', flexDirection: 'column' }}>

      {bg && (
        <img src={bg.src} alt={bg.label}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,16,28,0.55)' }} />


      {bg && (
        <div style={{ position: 'absolute', top: '1.25rem', left: '1.5rem', zIndex: 10, fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'rgba(248,245,238,0.85)', fontFamily: MONO, textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
          🏦 {bg.label}
        </div>
      )}

      {/* Panel */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%', background: C.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header mit X-Button — immer sichtbar, innerhalb des Panels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem 0', flexShrink: 0 }}>
          <div style={{ fontSize: '0.6rem', color: C.textFaint, fontFamily: MONO, letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>
            🏦 {bg?.label ?? locationName}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: '0.9rem', color: C.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ position: 'absolute', top: '-40px', left: 0, right: 0, height: '40px', background: `linear-gradient(to bottom, transparent, ${C.bg})`, pointerEvents: 'none' }} />

        {/* Tabs */}
        <div style={{ padding: '0.9rem 1.5rem 0', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 0, marginBottom: '-1px', alignItems: 'flex-end' }}>
            {(['konto', 'einlage', 'kredit', 'sicherheiten'] as Tab[]).map(t => (
              <button key={t} onClick={() => { setTab(t); setMsg(null); setAmount('') }}
                style={{ padding: '0.5rem 1rem', border: `1px solid ${tab === t ? C.border : 'transparent'}`, borderBottom: tab === t ? `1px solid ${C.bg}` : `1px solid ${C.border}`, borderRadius: '6px 6px 0 0', cursor: 'pointer', fontFamily: MONO, fontSize: '0.75rem', fontWeight: 700, background: tab === t ? C.bg : C.bgAlt, color: tab === t ? C.accent : C.textMuted }}>
                {t === 'konto' ? 'Konto' : t === 'einlage' ? 'Einlage' : t === 'kredit' ? 'Kredit' : 'Sicherheiten'}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', paddingBottom: '0.5rem', fontSize: '0.72rem', color: C.textMuted, fontFamily: MONO }}>
              <span style={{ color: C.gold, fontWeight: 700 }}>{credits.toLocaleString('de')} Cr</span>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' as const, padding: '1.25rem 1.5rem 1.5rem' }}>

          {loading && <div style={{ textAlign: 'center', padding: '2rem', color: C.textMuted, fontFamily: MONO, fontSize: '0.85rem' }}>Verbindung zur Bank …</div>}

          {!loading && msg && (
            <div style={{ marginBottom: '1rem', padding: '0.7rem 1rem', background: msg.ok ? C.greenLight : C.redLight, border: `1px solid ${msg.ok ? '#a0dcb8' : '#f0a0a0'}`, borderRadius: '8px', fontSize: '0.8rem', color: msg.ok ? C.green : C.red, fontFamily: MONO, lineHeight: 1.5 }}>
              {msg.text}
            </div>
          )}

          {/* ── KONTO ──────────────────────────────────────────────────────── */}
          {!loading && tab === 'konto' && status && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'Einlage',     value: `${status.deposit.toLocaleString('de')} Cr`,      sub: `+${(status.depositRate*100).toFixed(1)}%/Tick`,      color: C.green },
                  { label: 'Kredit',      value: `${status.loan.toLocaleString('de')} Cr`,          sub: status.loan > 0 ? `−${(status.loanRate*100).toFixed(1)}%/Tick (Zinseszins)` : 'Kein Kredit', color: status.loan > 0 ? C.red : C.textFaint },
                  { label: 'Kreditlimit', value: `${status.creditLimit.toLocaleString('de')} Cr`,   sub: `${(status.collateralTotal).toLocaleString('de')} Cr Sicherheiten × 70%`, color: C.accent },
                  { label: 'Verfügbar',   value: `${status.availableLoan.toLocaleString('de')} Cr`, sub: status.hasModule ? 'Sofort abrufbar' : '⚠ Schulungsnachweis fehlt', color: status.hasModule && status.availableLoan > 0 ? C.accent : C.textFaint },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '0.85rem 1rem' }}>
                    <div style={{ fontSize: '0.62rem', color: C.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase' as const, fontFamily: MONO, marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color, fontFamily: MONO }}>{value}</div>
                    <div style={{ fontSize: '0.62rem', color: C.textFaint, marginTop: '3px', lineHeight: 1.4 }}>{sub}</div>
                  </div>
                ))}
              </div>

              {/* Sicherheiten-Warnung */}
              {status.collateralWarning && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: C.redLight, border: '1px solid #f0a0a0', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.red, fontFamily: MONO, marginBottom: '3px' }}>⚠ Unterdeckung</div>
                  <div style={{ fontSize: '0.78rem', color: C.text, lineHeight: 1.6 }}>{status.collateralWarning.message}</div>
                  {status.collateralWarning.requiredRepayment && (
                    <div style={{ fontSize: '0.68rem', color: C.red, fontFamily: MONO, marginTop: '4px' }}>
                      Sofort tilgen: {status.collateralWarning.requiredRepayment.toLocaleString('de')} Cr
                    </div>
                  )}
                </div>
              )}

              <div style={{ fontSize: '0.62rem', color: C.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase' as const, fontFamily: MONO, marginBottom: '0.6rem' }}>Letzte Buchungen</div>
              {status.ledger.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: C.textFaint, fontFamily: MONO }}>Noch keine Transaktionen.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {status.ledger.map(e => {
                    const meta = ENTRY_LABELS[e.entry_type] ?? { label: e.entry_type, color: C.textMuted }
                    return (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.75rem', background: C.white, border: `1px solid ${C.border}`, borderRadius: '6px' }}>
                        <span style={{ color: meta.color, fontWeight: 700, fontFamily: MONO, fontSize: '0.68rem', width: '80px', flexShrink: 0 }}>{meta.label}</span>
                        <span style={{ color: C.text, flex: 1, fontSize: '0.7rem' }}>{e.note}</span>
                        <span style={{ color: meta.color, fontWeight: 700, fontFamily: MONO, fontSize: '0.72rem', flexShrink: 0 }}>{e.amount.toLocaleString('de')} Cr</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── EINLAGE ────────────────────────────────────────────────────── */}
          {!loading && tab === 'einlage' && status && (
            <>
              <div style={{ background: C.greenLight, border: '1px solid #a0dcb8', borderRadius: '8px', padding: '0.85rem 1.1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.green, fontFamily: MONO, marginBottom: '4px' }}>Einlagenkonto · {(status.depositRate * 100).toFixed(1)}%/Tick</div>
                <div style={{ fontSize: '0.8rem', color: C.text, lineHeight: 1.65 }}>
                  Aktuelle Einlage: <strong style={{ color: C.green }}>{status.deposit.toLocaleString('de')} Cr</strong>. Zinsen werden automatisch pro Tick gutgeschrieben. Jederzeit auszahlbar.
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: C.textMuted, fontFamily: MONO, marginBottom: '0.4rem' }}>Betrag (Cr)</div>
                <input type="number" min="10" placeholder="z.B. 500" value={amount} onChange={e => setAmount(e.target.value)}
                  style={{ width: '100%', background: C.white, border: `1.5px solid ${C.border}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: C.text, fontSize: '1.05rem', fontFamily: MONO, outline: 'none', boxSizing: 'border-box' as const }} />
                <div style={{ fontSize: '0.65rem', color: C.textFaint, marginTop: '4px' }}>Verfügbar: {credits.toLocaleString('de')} Cr</div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button onClick={() => doAction('deposit')} disabled={busy || !amtValid || amt > credits}
                  style={{ flex: 1, padding: '0.7rem', background: amtValid && amt <= credits ? C.green : C.border, color: amtValid && amt <= credits ? C.white : C.textFaint, border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: amtValid && amt <= credits ? 'pointer' : 'not-allowed', fontFamily: MONO }}>
                  {busy ? '…' : 'Einzahlen →'}
                </button>
                <button onClick={() => doAction('withdraw')} disabled={busy || !amtValid || amt > (status?.deposit ?? 0)}
                  style={{ flex: 1, padding: '0.7rem', background: amtValid && amt <= (status?.deposit ?? 0) ? C.bgAlt : C.border, color: amtValid && amt <= (status?.deposit ?? 0) ? C.text : C.textFaint, border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: amtValid && amt <= (status?.deposit ?? 0) ? 'pointer' : 'not-allowed', fontFamily: MONO }}>
                  {busy ? '…' : 'Auszahlen ←'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.7rem' }}>
                {[100, 500, 1000, 5000].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))}
                    style={{ flex: 1, padding: '4px 0', background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '0.68rem', color: C.textMuted, cursor: 'pointer', fontFamily: MONO }}>
                    {v >= 1000 ? `${v/1000}k` : v}
                  </button>
                ))}
                <button onClick={() => setAmount(String(credits))}
                  style={{ flex: 1, padding: '4px 0', background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '0.68rem', color: C.textMuted, cursor: 'pointer', fontFamily: MONO }}>Max</button>
              </div>
            </>
          )}

          {/* ── KREDIT ─────────────────────────────────────────────────────── */}
          {!loading && tab === 'kredit' && status && (
            <>
              {/* Schulungsnachweis-Gate */}
              {!status.hasModule ? (
                <div style={{ background: C.redLight, border: '1px solid #f0a0a0', borderRadius: '10px', padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.red, fontFamily: MONO, marginBottom: '6px' }}>⚠ Schulungsnachweis erforderlich</div>
                  <div style={{ fontSize: '0.8rem', color: C.text, lineHeight: 1.7 }}>
                    Um Kredite aufzunehmen musst du das Modul <strong>„ECO-L0-0001"</strong> in der Akademie abschließen.
                    Dort lernst du wie Zinseszins und Kreditrisiko funktionieren — praktisch, nicht theoretisch.
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: C.textMuted, fontFamily: MONO }}>
                    Akademie → Aufgaben → ECO-L0-0001
                  </div>
                </div>
              ) : (
                <div style={{ background: status.loan > 0 ? C.redLight : C.accentLight, border: `1px solid ${status.loan > 0 ? '#f0a0a0' : '#b8cce8'}`, borderRadius: '8px', padding: '0.85rem 1.1rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: status.loan > 0 ? C.red : C.accent, fontFamily: MONO, marginBottom: '4px' }}>
                    {status.loan > 0 ? `Offener Kredit: ${status.loan.toLocaleString('de')} Cr` : 'Kein offener Kredit'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: C.text }}>
                    Limit: <strong>{status.creditLimit.toLocaleString('de')} Cr</strong> · Verfügbar: <strong style={{ color: C.accent }}>{status.availableLoan.toLocaleString('de')} Cr</strong>
                  </div>
                </div>
              )}

              {status.hasModule && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.72rem', color: C.textMuted, fontFamily: MONO, marginBottom: '0.4rem' }}>Betrag (Cr)</div>
                    <input type="number" min="100" placeholder="z.B. 2000" value={amount} onChange={e => setAmount(e.target.value)}
                      style={{ width: '100%', background: C.white, border: `1.5px solid ${C.border}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: C.text, fontSize: '1.05rem', fontFamily: MONO, outline: 'none', boxSizing: 'border-box' as const }} />
                  </div>

                  <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.7rem' }}>
                    <button onClick={() => doAction('loan')} disabled={busy || !amtValid || amt > status.availableLoan}
                      style={{ flex: 1, padding: '0.7rem', background: amtValid && amt <= status.availableLoan ? C.accent : C.border, color: amtValid && amt <= status.availableLoan ? C.white : C.textFaint, border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: amtValid && amt <= status.availableLoan ? 'pointer' : 'not-allowed', fontFamily: MONO }}>
                      {busy ? '…' : 'Kredit aufnehmen →'}
                    </button>
                    <button onClick={() => doAction('repay')} disabled={busy || !amtValid || status.loan <= 0 || amt > credits}
                      style={{ flex: 1, padding: '0.7rem', background: amtValid && status.loan > 0 && amt <= credits ? C.bgAlt : C.border, color: amtValid && status.loan > 0 && amt <= credits ? C.text : C.textFaint, border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: amtValid && status.loan > 0 && amt <= credits ? 'pointer' : 'not-allowed', fontFamily: MONO }}>
                      {busy ? '…' : 'Tilgen ←'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem' }}>
                    {[500, 1000, 2000, 5000].map(v => (
                      <button key={v} onClick={() => setAmount(String(v))}
                        style={{ flex: 1, padding: '4px 0', background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '0.68rem', color: C.textMuted, cursor: 'pointer', fontFamily: MONO }}>
                        {v >= 1000 ? `${v/1000}k` : v}
                      </button>
                    ))}
                    <button onClick={() => setAmount(String(status.availableLoan))}
                      style={{ flex: 1, padding: '4px 0', background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '0.68rem', color: C.textMuted, cursor: 'pointer', fontFamily: MONO }}>Max</button>
                  </div>
                </>
              )}

              {/* Zinseszins-Visualisierung */}
              <div style={{ fontSize: '0.62rem', color: C.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase' as const, fontFamily: MONO, marginBottom: '0.6rem' }}>
                Zinseszins-Entwicklung · {amtValid && amt >= 100 ? `${amt.toLocaleString('de')} Cr` : '1.000 Cr'} über {previewTicks} Ticks
              </div>
              {compound && (() => {
                const data = compound.loan.slice(0, previewTicks)
                const maxVal = Math.max(...data.map(d => d.balance))
                return (
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '0.85rem', marginBottom: '0.75rem' }}>
                    {/* Mini-Balkendiagramm */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '60px', marginBottom: '8px' }}>
                      {data.map((d, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <div style={{ width: '100%', background: C.red, borderRadius: '2px 2px 0 0', height: `${Math.round((d.balance / maxVal) * 56)}px`, opacity: 0.7 + i * 0.03 }} />
                        </div>
                      ))}
                    </div>
                    {/* Tick-Labels */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: C.textFaint, fontFamily: MONO }}>
                      <span>Tick 1</span>
                      <span style={{ color: C.red, fontWeight: 700 }}>Tick {previewTicks}: {data[previewTicks-1]?.balance.toLocaleString('de')} Cr</span>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.68rem', color: C.textMuted, lineHeight: 1.5 }}>
                      Zinslast/Tick: <span style={{ color: C.red, fontWeight: 700 }}>−{Math.round((amtValid && amt >= 100 ? amt : 1000) * compound.loanRate).toLocaleString('de')} Cr</span>
                      <span style={{ marginLeft: '12px' }}>+{((compound.loanRate) * 100).toFixed(1)}%/Tick Zinseszins</span>
                    </div>
                  </div>
                )
              })()}

              {/* Tick-Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.68rem', color: C.textFaint, fontFamily: MONO, flexShrink: 0 }}>Vorschau:</span>
                {[5, 10, 15, 20].map(v => (
                  <button key={v} onClick={() => setPreview(v)}
                    style={{ padding: '2px 10px', background: previewTicks === v ? C.accent : C.bgAlt, color: previewTicks === v ? C.white : C.textMuted, border: `1px solid ${previewTicks === v ? C.accent : C.border}`, borderRadius: '20px', fontSize: '0.68rem', cursor: 'pointer', fontFamily: MONO }}>
                    {v} Ticks
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── SICHERHEITEN ───────────────────────────────────────────────── */}
          {!loading && tab === 'sicherheiten' && !collateral && (
            <div style={{ padding: '1.5rem', color: C.textMuted, fontFamily: MONO, fontSize: '0.8rem' }}>Sicherheiten konnten nicht geladen werden.</div>
          )}
          {!loading && tab === 'sicherheiten' && collateral && (
            <>
              {/* Zusammenfassung */}
              <div style={{ background: C.accentLight, border: '1px solid #b8cce8', borderRadius: '8px', padding: '0.85rem 1.1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.62rem', color: C.accent, letterSpacing: '0.12em', textTransform: 'uppercase' as const, fontFamily: MONO }}>Gesamter Beleihungswert</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: C.accent, fontFamily: MONO, marginTop: '2px' }}>{collateral.total.toLocaleString('de')} Cr</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.62rem', color: C.accent, letterSpacing: '0.12em', textTransform: 'uppercase' as const, fontFamily: MONO }}>Kreditlimit (70%)</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: C.accent, fontFamily: MONO, marginTop: '2px' }}>{collateral.creditLimit.toLocaleString('de')} Cr</div>
                  </div>
                </div>
              </div>

              {/* Gebäude */}
              {collateral.buildings.length > 0 && (
                <>
                  <div style={{ fontSize: '0.62rem', color: C.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase' as const, fontFamily: MONO, marginBottom: '0.5rem' }}>Gebäude</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
                    {collateral.buildings.map(b => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.85rem', background: C.white, border: `1px solid ${C.border}`, borderRadius: '7px' }}>
                        <div>
                          <div style={{ fontSize: '0.78rem', color: C.text, fontWeight: 700 }}>{BUILDING_NAMES[b.name] ?? b.name}</div>
                          <div style={{ fontSize: '0.65rem', color: C.textFaint }}>{b.locationName}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.78rem', color: C.accent, fontWeight: 700, fontFamily: MONO }}>{b.ertragswert.toLocaleString('de')} Cr</div>
                          <div style={{ fontSize: '0.62rem', color: C.textFaint }}>Ertragswert</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Schiffe */}
              {collateral.ships.length > 0 && (
                <>
                  <div style={{ fontSize: '0.62rem', color: C.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase' as const, fontFamily: MONO, marginBottom: '0.5rem' }}>Schiffe</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {collateral.ships.map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.85rem', background: C.white, border: `1px solid ${C.border}`, borderRadius: '7px' }}>
                        <div>
                          <div style={{ fontSize: '0.78rem', color: C.text, fontWeight: 700 }}>{s.name}</div>
                          <div style={{ fontSize: '0.65rem', color: C.textFaint }}>60% Restwert</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.78rem', color: C.accent, fontWeight: 700, fontFamily: MONO }}>{s.restwert.toLocaleString('de')} Cr</div>
                          <div style={{ fontSize: '0.62rem', color: C.textFaint }}>Beleihungswert</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {collateral.buildings.length === 0 && collateral.ships.length === 0 && (
                <div style={{ fontSize: '0.82rem', color: C.textMuted, fontFamily: MONO, padding: '0.5rem 0' }}>
                  Keine beleihbaren Sicherheiten. Baue Gebäude oder kaufe ein Schiff um dein Kreditlimit zu erhöhen.
                </div>
              )}

              {/* Schulungsnachweis-Status */}
              <div style={{ marginTop: '1.25rem', padding: '0.65rem 0.85rem', background: collateral.hasModule ? C.greenLight : C.redLight, border: `1px solid ${collateral.hasModule ? '#a0dcb8' : '#f0a0a0'}`, borderRadius: '7px', fontSize: '0.72rem', color: collateral.hasModule ? C.green : C.red, fontFamily: MONO }}>
                {collateral.hasModule
                  ? '✓ Schulungsnachweis „ECO-L0-0001" vorhanden — Kredite freigeschaltet'
                  : '✗ Schulungsnachweis fehlt — Akademie · Modul „ECO-L0-0001" abschließen'}
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '0.5rem 1.5rem', borderTop: `1px solid ${C.border}`, fontSize: '0.62rem', color: C.textFaint, fontFamily: MONO, background: C.bgAlt, flexShrink: 0 }}>
          Solar Central Bank · Einlagen gesichert · Zinsen werden pro Tick automatisch gebucht
        </div>
      </div>
    </div>
  )
}
