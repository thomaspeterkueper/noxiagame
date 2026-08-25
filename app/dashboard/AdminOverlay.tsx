'use client'

// app/dashboard/AdminOverlay.tsx
// Erstellt: 20.06.2026
// Aktualisiert: 25.08.2026 — Steuersätze bearbeitbar + Kasse-Abheben für den
//               Gouverneur (NOXIA-ECON-0002), Verkaufen-Button ergänzt
// Version:  1.2.0
//
// Verwaltungs-Overlay — öffnet sich beim Klick auf das Admin-Gebäude.
// Zeigt: Aufträge, Stationsguthaben, Einnahmen, Ausgaben, Lagerbestand,
// Bevölkerung und Bedarf der Kolonie.
//
// Randfarben (alle drei Overlay-Typen):
//   Blau  (#2a6ab5) = öffentliches / staatliches Admin-Gebäude
//   Gold  (#c9a961) = eigenes Gebäude
//   Rot   (#c94040) = fremder Spieler

import React from 'react'

import { useState, useEffect } from 'react'
import { getToken } from '@/lib/supabase/auth'

const RES_DE: Record<string, string> = {
  water: 'Wasser', energy: 'Energie', metal: 'Metall',
}
const RES_ICON: Record<string, string> = {
  water: '💧', energy: '⚡', metal: '⛏️',
}
const ENTRY_LABEL: Record<string, string> = {
  tax_property:    'Grundsteuer',
  tax_transaction: 'Transaktionssteuer',
  tax_landing:     'Landegebühr',
  landing_fee:     'Landegebühr',
  tariff:          'Zoll',
  payout:          'Auszahlung',
  governor_withdrawal: 'Abhebung (Gouverneur)',
  other:           'Sonstiges',
}

interface AdminData {
  location: {
    slug: string; name: string; population: number; populationMax: number
    isSupplied: boolean; governorId: string | null; governorName: string | null
  }
  resources: { resource: string; stock: number; consumption: number; production: number }[]
  settings:  { taxProperty: number; taxTransaction: number; taxLanding: number }
  treasury:  { balance: number; totalIncome: number; totalExpenses: number; lastTick: number }
  ledger:    { tick: number; entry_type: string; amount: number; note: string; profiles?: { username: string } | null }[]
  orders:    { id: string; resource: string; amount: number; reward: number; expires_at: string | null; status: string }[]
}

interface AdminOverlayProps {
  locationSlug: string
  onClose: () => void
  userId?: string          // zum Gouverneur-Abgleich (25.08.2026)
  canSell?: boolean        // true wenn Spieler Eigentümer & nicht staatlich (25.08.2026)
  onSellClick?: () => void
}

export default function AdminOverlay({ locationSlug, onClose, userId, canSell, onSellClick }: AdminOverlayProps) {
  const [data, setData]     = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]       = useState<'overview' | 'orders' | 'ledger'>('overview')

  // Steuersätze-Bearbeitung (nur Gouverneur, 25.08.2026)
  const [editingTax, setEditingTax] = useState(false)
  const [taxPropertyInput,    setTaxPropertyInput]    = useState('')
  const [taxTransactionInput, setTaxTransactionInput] = useState('')
  const [taxLandingInput,     setTaxLandingInput]     = useState('')
  const [taxSaving, setTaxSaving] = useState(false)
  const [taxMsg, setTaxMsg]       = useState<string | null>(null)

  // Kasse-Abheben (nur Gouverneur, 25.08.2026)
  const [withdrawInput, setWithdrawInput]   = useState('')
  const [withdrawing, setWithdrawing]       = useState(false)
  const [withdrawMsg, setWithdrawMsg]       = useState<string | null>(null)

  const isGovernor = !!userId && !!data && userId === data.location.governorId

  function reload() {
    setLoading(true)
    fetch(`/api/game/admin?location=${locationSlug}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
        setTaxPropertyInput(String(d?.settings?.taxProperty ?? 0))
        setTaxTransactionInput(String(Math.round((d?.settings?.taxTransaction ?? 0) * 1000) / 10))  // Anzeige in %
        setTaxLandingInput(String(d?.settings?.taxLanding ?? 0))
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationSlug])

  async function saveTaxRates() {
    setTaxSaving(true); setTaxMsg(null)
    try {
      const token = await getToken()
      const params = new URLSearchParams({
        action: 'setTaxRates',
        location: locationSlug,
        taxProperty:    String(Math.max(0, Number(taxPropertyInput) || 0)),
        taxTransaction: String(Math.max(0, (Number(taxTransactionInput) || 0) / 100)),  // % → Anteil
        taxLanding:     String(Math.max(0, Number(taxLandingInput) || 0)),
      })
      const res = await fetch(`/api/game/admin?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) { setTaxMsg(json.error ?? 'Fehler beim Speichern'); setTaxSaving(false); return }
      setTaxMsg('Gespeichert.')
      setEditingTax(false)
      reload()
    } catch { setTaxMsg('Fehler beim Speichern') }
    setTaxSaving(false)
  }

  async function withdraw() {
    const amount = Math.round(Number(withdrawInput) || 0)
    if (amount <= 0) return
    setWithdrawing(true); setWithdrawMsg(null)
    try {
      const token = await getToken()
      const res = await fetch(`/api/game/admin?action=withdraw&location=${locationSlug}&amount=${amount}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) { setWithdrawMsg(json.error ?? 'Fehler beim Abheben'); setWithdrawing(false); return }
      setWithdrawMsg(`${amount} Cr abgehoben.`)
      setWithdrawInput('')
      reload()
    } catch { setWithdrawMsg('Fehler beim Abheben') }
    setWithdrawing(false)
  }

  const S: Record<string, React.CSSProperties> = {
    backdrop: {
      position: 'fixed', inset: 0, background: 'rgba(2,4,8,0.75)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    panel: {
      background: '#0d1a26', border: '1px solid #2a4e7a', borderRadius: '12px',
      width: 'min(560px, 95vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      boxShadow: '0 8px 40px rgba(0,0,0,0.6)', fontFamily: "'Courier Prime', monospace",
      color: '#cdd6e0', overflow: 'hidden',
    },
    header: {
      padding: '1rem 1.25rem 0.75rem',
      borderBottom: '1px solid rgba(42,78,122,0.5)',
      background: 'linear-gradient(180deg, #0a1520 0%, #0d1a26 100%)',
    },
    body: { flex: 1, overflow: 'auto', padding: '1rem 1.25rem' },
    tabBar: {
      display: 'flex', gap: '0', borderBottom: '1px solid rgba(42,78,122,0.5)',
      padding: '0 1.25rem', background: '#0a1520',
    },
    row: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
      fontSize: '0.75rem',
    },
    label: { color: '#5a7a9a' },
    val:   { color: '#cdd6e0', fontWeight: 600 },
    valGreen: { color: '#6fcf97', fontWeight: 600 },
    valRed:   { color: '#e74c3c', fontWeight: 600 },
    section: { marginBottom: '1.25rem' },
    sectionTitle: {
      fontSize: '0.6rem', fontWeight: 700, color: '#2a6ab5',
      textTransform: 'uppercase' as const, letterSpacing: '3px', marginBottom: '0.5rem',
    },
    orderCard: {
      background: 'rgba(42,78,122,0.15)', border: '1px solid rgba(42,78,122,0.4)',
      borderRadius: '6px', padding: '0.6rem 0.75rem', marginBottom: '0.5rem',
    },
  }

  function Tab({ id, label }: { id: typeof tab; label: string }) {
    const active = tab === id
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '0.6rem 1rem', fontSize: '0.7rem', fontWeight: active ? 700 : 400,
          color: active ? '#c9a961' : '#5a7a9a',
          borderBottom: active ? '2px solid #c9a961' : '2px solid transparent',
          transition: 'color 0.15s',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div style={S.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.panel}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.6rem', color: '#2a6ab5', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase' }}>
                🏛 Verwaltung
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#cdd6e0', marginTop: '3px' }}>
                {data?.location.name ?? locationSlug.toUpperCase()}
              </div>
              {data?.location.governorName && (
                <div style={{ fontSize: '0.65rem', color: '#5a7a9a', marginTop: '2px' }}>
                  Gouverneur: <span style={{ color: '#c9a961' }}>{data.location.governorName}</span>
                </div>
              )}
              {!data?.location.governorName && !loading && (
                <div style={{ fontSize: '0.65rem', color: '#5a7a9a', marginTop: '2px' }}>
                  Staatliche Verwaltung · kein privater Gouverneur
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#5a7a9a', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {canSell && onSellClick && (
            <button
              onClick={onSellClick}
              style={{ marginTop: '8px', background: 'transparent', border: '1px solid #3a5a7a', color: '#8ab0d0', borderRadius: '6px', padding: '5px 12px', fontSize: '0.68rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              🏷️ Verkaufen
            </button>
          )}

          {/* Status-Badges */}
          {data && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '20px', background: data.location.isSupplied ? 'rgba(111,207,151,0.15)' : 'rgba(231,76,60,0.15)', color: data.location.isSupplied ? '#6fcf97' : '#e74c3c' }}>
                {data.location.isSupplied ? '🟢 Versorgt' : '🔴 Engpass'}
              </span>
              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(42,78,122,0.3)', color: '#8ab0d0' }}>
                👥 {data.location.population.toLocaleString('de')} / {data.location.populationMax.toLocaleString('de')}
              </span>
              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(201,169,97,0.15)', color: '#c9a961' }}>
                💰 {data.treasury.balance.toLocaleString('de')} Cr
              </span>
            </div>
          )}
        </div>

        {/* Tab-Leiste */}
        <div style={S.tabBar}>
          <Tab id="overview" label="Übersicht" />
          <Tab id="orders"   label={`Aufträge${data ? ` (${data.orders.length})` : ''}`} />
          <Tab id="ledger"   label="Buchhaltung" />
        </div>

        {/* Body */}
        <div style={S.body}>
          {loading && (
            <div style={{ color: '#5a7a9a', textAlign: 'center', padding: '2rem', fontSize: '0.8rem' }}>
              Lade Verwaltungsdaten …
            </div>
          )}

          {!loading && data && tab === 'overview' && (
            <>
              {/* Lagerbestand */}
              <div style={S.section}>
                <div style={S.sectionTitle}>Lagerbestand & Bedarf</div>
                {data.resources.map(r => {
                  const deficit = r.consumption - r.production
                  const ticksLeft = deficit > 0 ? Math.floor(r.stock / deficit) : null
                  return (
                    <div key={r.resource} style={S.row}>
                      <span style={S.label}>{RES_ICON[r.resource]} {RES_DE[r.resource] ?? r.resource}</span>
                      <span style={{ display: 'flex', gap: '1.5rem', fontSize: '0.7rem' }}>
                        <span style={S.label}>Lager <span style={S.val}>{r.stock}t</span></span>
                        <span style={S.label}>−{r.consumption}/Tick</span>
                        <span style={r.production > 0 ? S.valGreen : S.label}>+{r.production}/Tick</span>
                        {ticksLeft !== null && (
                          <span style={{ color: ticksLeft < 5 ? '#e74c3c' : '#8ab0d0' }}>
                            ~{ticksLeft} Ticks
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Finanzen */}
              <div style={S.section}>
                <div style={S.sectionTitle}>Stationsguthaben</div>
                <div style={S.row}>
                  <span style={S.label}>Guthaben</span>
                  <span style={{ ...S.val, color: data.treasury.balance >= 0 ? '#6fcf97' : '#e74c3c' }}>
                    {data.treasury.balance.toLocaleString('de')} Cr
                  </span>
                </div>
                <div style={S.row}>
                  <span style={S.label}>Gesamteinnahmen (Lifetime)</span>
                  <span style={S.valGreen}>+{data.treasury.totalIncome.toLocaleString('de')} Cr</span>
                </div>
                <div style={S.row}>
                  <span style={S.label}>Gesamtausgaben (Lifetime)</span>
                  <span style={S.valRed}>{data.treasury.totalExpenses?.toLocaleString('de') ?? '0'} Cr</span>
                </div>

                {isGovernor && data.treasury.balance > 0 && (
                  <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="number" min={1} max={Math.floor(data.treasury.balance)}
                      placeholder={`bis ${Math.floor(data.treasury.balance)} Cr`}
                      value={withdrawInput} onChange={e => setWithdrawInput(e.target.value)}
                      style={{ flex: 1, background: '#06101c', border: '1px solid #2a4e7a', borderRadius: 6, padding: '5px 8px', color: '#cdd6e0', fontSize: '0.72rem', fontFamily: 'inherit' }}
                    />
                    <button onClick={withdraw} disabled={withdrawing || !withdrawInput}
                      style={{ background: 'rgba(201,169,97,0.15)', border: '1px solid #c9a961', color: '#c9a961', borderRadius: 6, padding: '5px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: withdrawing ? 'default' : 'pointer', opacity: withdrawing ? 0.6 : 1 }}>
                      {withdrawing ? '…' : 'Abheben'}
                    </button>
                  </div>
                )}
                {withdrawMsg && <div style={{ fontSize: '0.65rem', color: withdrawMsg.includes('abgehoben') ? '#6fcf97' : '#e74c3c', marginTop: '4px' }}>{withdrawMsg}</div>}
              </div>

              {/* Steuersätze */}
              <div style={S.section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={S.sectionTitle}>Tarife & Steuern</div>
                  {isGovernor && !editingTax && (
                    <button onClick={() => setEditingTax(true)} style={{ background: 'transparent', border: '1px solid #3a5a7a', color: '#8ab0d0', borderRadius: 6, padding: '3px 10px', fontSize: '0.65rem', cursor: 'pointer' }}>
                      Bearbeiten
                    </button>
                  )}
                </div>

                {!editingTax && (
                  <>
                    <div style={S.row}>
                      <span style={S.label}>Grundsteuer</span>
                      <span style={S.val}>{data.settings.taxProperty > 0 ? `${data.settings.taxProperty} Cr/Gebäude/Tick` : '—'}</span>
                    </div>
                    <div style={S.row}>
                      <span style={S.label}>Transaktionssteuer</span>
                      <span style={S.val}>{data.settings.taxTransaction > 0 ? `${(data.settings.taxTransaction * 100).toFixed(1)}%` : '—'}</span>
                    </div>
                    <div style={S.row}>
                      <span style={S.label}>Landegebühr</span>
                      <span style={S.val}>{data.settings.taxLanding > 0 ? `${data.settings.taxLanding} Cr/Landung` : '—'}</span>
                    </div>
                  </>
                )}

                {editingTax && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#5a7a9a' }}>
                      Grundsteuer (Cr/Gebäude/Tick)
                      <input type="number" min={0} value={taxPropertyInput} onChange={e => setTaxPropertyInput(e.target.value)}
                        style={{ display: 'block', width: '100%', marginTop: '3px', background: '#06101c', border: '1px solid #2a4e7a', borderRadius: 6, padding: '5px 8px', color: '#cdd6e0', fontSize: '0.75rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </label>
                    <label style={{ fontSize: '0.65rem', color: '#5a7a9a' }}>
                      Transaktionssteuer (%)
                      <input type="number" min={0} max={50} step={0.1} value={taxTransactionInput} onChange={e => setTaxTransactionInput(e.target.value)}
                        style={{ display: 'block', width: '100%', marginTop: '3px', background: '#06101c', border: '1px solid #2a4e7a', borderRadius: 6, padding: '5px 8px', color: '#cdd6e0', fontSize: '0.75rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </label>
                    <label style={{ fontSize: '0.65rem', color: '#5a7a9a' }}>
                      Landegebühr (Cr/Landung)
                      <input type="number" min={0} value={taxLandingInput} onChange={e => setTaxLandingInput(e.target.value)}
                        style={{ display: 'block', width: '100%', marginTop: '3px', background: '#06101c', border: '1px solid #2a4e7a', borderRadius: 6, padding: '5px 8px', color: '#cdd6e0', fontSize: '0.75rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button onClick={saveTaxRates} disabled={taxSaving}
                        style={{ flex: 1, background: 'rgba(201,169,97,0.15)', border: '1px solid #c9a961', color: '#c9a961', borderRadius: 6, padding: '6px 0', fontSize: '0.7rem', fontWeight: 700, cursor: taxSaving ? 'default' : 'pointer', opacity: taxSaving ? 0.6 : 1 }}>
                        {taxSaving ? 'Speichert …' : 'Speichern'}
                      </button>
                      <button onClick={() => { setEditingTax(false); setTaxMsg(null) }}
                        style={{ flex: 1, background: 'transparent', border: '1px solid #3a5a7a', color: '#8ab0d0', borderRadius: 6, padding: '6px 0', fontSize: '0.7rem', cursor: 'pointer' }}>
                        Abbrechen
                      </button>
                    </div>
                    {taxMsg && <div style={{ fontSize: '0.65rem', color: taxMsg === 'Gespeichert.' ? '#6fcf97' : '#e74c3c' }}>{taxMsg}</div>}
                  </div>
                )}
              </div>
            </>
          )}

          {!loading && data && tab === 'orders' && (
            <>
              {data.orders.length === 0 ? (
                <div style={{ color: '#5a7a9a', fontSize: '0.75rem', padding: '1rem 0' }}>
                  Keine offenen öffentlichen Aufträge.
                </div>
              ) : (
                data.orders.map(o => {
                  const hoursLeft = o.expires_at
                    ? Math.max(0, Math.round((new Date(o.expires_at).getTime() - Date.now()) / 3.6e6))
                    : null
                  return (
                    <div key={o.id} style={S.orderCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>
                          {RES_ICON[o.resource]} {o.amount}t {RES_DE[o.resource] ?? o.resource}
                        </span>
                        <span style={{ color: '#c9a961', fontWeight: 700, fontSize: '0.8rem' }}>
                          {o.reward.toLocaleString('de')} Cr
                        </span>
                      </div>
                      {hoursLeft !== null && (
                        <div style={{ fontSize: '0.65rem', color: hoursLeft < 3 ? '#e74c3c' : '#5a7a9a', marginTop: '3px' }}>
                          ⏳ noch {hoursLeft}h
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </>
          )}

          {!loading && data && tab === 'ledger' && (
            <>
              {data.ledger.length === 0 ? (
                <div style={{ color: '#5a7a9a', fontSize: '0.75rem', padding: '1rem 0' }}>
                  Noch keine Buchungen.
                </div>
              ) : (
                data.ledger.map((e, i) => (
                  <div key={i} style={{ ...S.row, flexWrap: 'wrap', gap: '0.25rem' }}>
                    <span style={S.label}>
                      Tick {e.tick} · {ENTRY_LABEL[e.entry_type] ?? e.entry_type}
                      {e.profiles?.username && <span style={{ color: '#8ab0d0' }}> · {e.profiles.username}</span>}
                    </span>
                    <span style={{ color: e.amount >= 0 ? '#6fcf97' : '#e74c3c', fontWeight: 600 }}>
                      {e.amount >= 0 ? '+' : ''}{Number(e.amount).toLocaleString('de')} Cr
                    </span>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
