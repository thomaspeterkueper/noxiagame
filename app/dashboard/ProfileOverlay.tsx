'use client'

// app/dashboard/ProfileOverlay.tsx
// Erstellt:     21.06.2026
// Aktualisiert: 15.09.2026 — sichtbare Abmeldung über kanonischen Server-Logout
// Version:      1.2.0
//
// v1.2.0 — sichtbarer Logout im Einstellungen-Tab; nutzt /auth/logout
// v1.1.0 — Einstellungen-Tab mit Email-Änderung und Account-Löschung
// v1.0.0 — Kompetenz-System, Statistiken

import React from 'react'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const MONO = "'Courier Prime', monospace"
const SANS = 'system-ui, sans-serif'

const C = {
  bg:        '#f4f2ed',
  bgAlt:     '#ece8e0',
  bgWhite:   '#ffffff',
  border:    '#e0ddd6',
  text:      '#1a2a3a',
  textMuted: '#8a9ab0',
  accent:    '#2a4e7a',
  gold:      '#c9a961',
  green:     '#1a7a4a',
  greenLight:'#e8f7ef',
  red:       '#b52a2a',
  redLight:  '#faeaea',
}

// ── Kompetenz-Definitionen ────────────────────────────────────────────────────

interface KompetenzSchwelle {
  wert: number; label: string; beschreibung: string; freigeschaltet: boolean
}
interface Kompetenz {
  id: string; icon: string; label: string; wert: number
  einheit: string; schwellen: KompetenzSchwelle[]; farbe: string
}
interface PlayerStats {
  transaktionen: number; fluege: number; gebaeudeStunden: number
  wissenspunkte: number; gesamtgewinn: number; registriertSeit: string
}
interface ProfileOverlayProps {
  username: string; avatar: string; credits: number; onClose: () => void
}

function buildKompetenzen(stats: PlayerStats): Kompetenz[] {
  const t = stats.transaktionen, f = stats.fluege
  const b = stats.gebaeudeStunden, w = stats.wissenspunkte
  return [
    {
      id: 'handel', icon: '⚖️', label: 'Handel', wert: t, einheit: 'Transaktionen', farbe: C.gold,
      schwellen: [
        { wert: 10,  label: 'Händler',      beschreibung: 'Marktpreishistorie der letzten 7 Tage sichtbar', freigeschaltet: t >= 10 },
        { wert: 50,  label: 'Kaufmann',      beschreibung: 'Zugang zu Aufträgen mit höherem Reward',        freigeschaltet: t >= 50 },
        { wert: 200, label: 'Handelsmagnat', beschreibung: 'Rohstoff-Termingeschäfte verfügbar',            freigeschaltet: t >= 200 },
      ],
    },
    {
      id: 'pilot', icon: '🚀', label: 'Pilot', wert: f, einheit: 'Flüge', farbe: '#5aaeff',
      schwellen: [
        { wert: 5,  label: 'Copilot',    beschreibung: 'Energieverbrauch −10% auf allen Routen',         freigeschaltet: f >= 5 },
        { wert: 20, label: 'Pilot',      beschreibung: 'Schwerere Schiffe ohne Reichweitenmalus',        freigeschaltet: f >= 20 },
        { wert: 75, label: 'Raumfahrer', beschreibung: 'Piratenbegegnungen durch Ausweichmanöver meidbar',freigeschaltet: f >= 75 },
      ],
    },
    {
      id: 'bau', icon: '🏗️', label: 'Bauen', wert: b, einheit: 'Gebäudestunden', farbe: '#6fcf97',
      schwellen: [
        { wert: 50,   label: 'Bauherr',         beschreibung: 'Bauzeit aller Gebäude −1 Tick',          freigeschaltet: b >= 50 },
        { wert: 200,  label: 'Investor',         beschreibung: 'Gebäudeverkauf ohne Sofort-Abschlag',    freigeschaltet: b >= 200 },
        { wert: 1000, label: 'Immobilienmagnat', beschreibung: 'Exklusive Gebäudetypen freigeschaltet',  freigeschaltet: b >= 1000 },
      ],
    },
    {
      id: 'wissen', icon: '🧠', label: 'Wissen', wert: w, einheit: 'Punkte', farbe: '#b48ce8',
      schwellen: [
        { wert: 100,  label: 'Student',        beschreibung: 'Koloniedetails vollständig sichtbar',  freigeschaltet: w >= 100 },
        { wert: 500,  label: 'Forscher',        beschreibung: 'NPC-Verhaltensmuster erkennbar',      freigeschaltet: w >= 500 },
        { wert: 2000, label: 'Wissenschaftler', beschreibung: 'Eigene Forschungsprojekte starten',   freigeschaltet: w >= 2000 },
      ],
    },
  ]
}

function KompetenzCard({ k }: { k: Kompetenz; key?: string }) {
  const [open, setOpen] = useState(false)
  const naechste = k.schwellen.find(s => !s.freigeschaltet)
  const pct = naechste ? Math.min(100, Math.round((k.wert / naechste.wert) * 100)) : 100
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', background: C.bgWhite }}>
        <span style={{ fontSize: '1.1rem' }}>{k.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: C.text }}>{k.label}</span>
            <span style={{ fontSize: '0.65rem', color: C.textMuted, fontFamily: MONO }}>{k.wert.toLocaleString('de')} {k.einheit}</span>
          </div>
          <div style={{ background: C.bgAlt, height: 5, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: k.farbe, borderRadius: 3, transition: 'width 0.5s' }} />
          </div>
          {naechste
            ? <div style={{ fontSize: '0.57rem', color: C.textMuted, marginTop: 3 }}>{pct}% → {naechste.label} (noch {(naechste.wert - k.wert).toLocaleString('de')} {k.einheit})</div>
            : <div style={{ fontSize: '0.57rem', color: k.farbe, marginTop: 3 }}>✓ Alle Schwellen erreicht</div>
          }
        </div>
        <span style={{ fontSize: '0.65rem', color: C.textMuted }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '0.5rem 1rem 0.75rem', background: '#faf9f6' }}>
          {k.schwellen.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.4rem 0', borderBottom: i < k.schwellen.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <span style={{ fontSize: '0.9rem', marginTop: 1 }}>{s.freigeschaltet ? '✅' : '🔒'}</span>
              <div>
                <div style={{ fontSize: '0.73rem', fontWeight: 700, color: s.freigeschaltet ? C.text : C.textMuted }}>
                  {s.label} <span style={{ fontWeight: 400, color: C.textMuted, fontSize: '0.62rem' }}>ab {s.wert.toLocaleString('de')} {k.einheit}</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: s.freigeschaltet ? C.accent : C.textMuted, marginTop: 1 }}>{s.beschreibung}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Wissenskarte-Tab ──────────────────────────────────────────────────────────
// Keine starre Baumgrafik: zeigt den erreichten Bereich plus nur die direkt
// angrenzenden, noch gesperrten Knoten ("eine Stufe weiter"). Jeder Spieler
// sieht so seinen eigenen, tatsächlich erkundeten Ausschnitt des Wissensgraphen
// (lib/knowledge/unlockRegistry.ts) statt eines für alle gleichen Tech-Baums.

interface UnlockEntry { id: string; label: string; tier: string | null; grants: string[]; grantedAt?: string; sourceModule?: string }
interface FrontierEntry { id: string; label: string; scope: string; tier: string; grants: string[]; missingUnlocks: { id: string; label: string }[] }

const TIER_COLOR: Record<string, string> = {
  foundation: C.gold, component: '#5aaeff', subsystem: '#6fcf97', integration: '#b48ce8',
}
const TIER_LABEL: Record<string, string> = {
  foundation: 'Grundlage', component: 'Komponente', subsystem: 'Subsystem', integration: 'Integration',
}

function WissenskarteTab() {
  const [unlocked, setUnlocked]   = useState<UnlockEntry[]>([])
  const [frontier, setFrontier]   = useState<FrontierEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        const jwt = session?.access_token ?? ''
        const res = await fetch('/api/game/knowledge?action=unlocks', { headers: { Authorization: `Bearer ${jwt}` } })
        const data = await res.json() as { unlocked?: UnlockEntry[]; frontier?: FrontierEntry[]; error?: string }
        if (cancelled) return
        if (data.error) { setError(data.error); return }
        setUnlocked(data.unlocked ?? [])
        setFrontier(data.frontier ?? [])
      } catch {
        if (!cancelled) setError('Wissenskarte derzeit nicht verfügbar.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const reachableNow = frontier.filter(f => f.missingUnlocks.length === 0)
  const oneAway      = frontier.filter(f => f.missingUnlocks.length === 1)

  if (loading) return <div style={{ color: C.textMuted, textAlign: 'center' as const, padding: '2rem', fontSize: '0.8rem' }}>Lädt …</div>
  if (error)   return <div style={{ color: C.red, textAlign: 'center' as const, padding: '2rem', fontSize: '0.8rem' }}>{error}</div>

  return (
    <div style={{ padding: '1rem 1.25rem' }}>
      <div style={{ fontSize: '0.7rem', color: C.textMuted, lineHeight: 1.6, marginBottom: '1.25rem' }}>
        Dein eigener Ausschnitt des Wissensnetzes — kein fester Pfad, nur dein erreichter Bereich und der nächste Schritt davon aus.
      </div>

      {/* Erreichter Bereich */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.6rem', color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '2px', marginBottom: '0.6rem', fontFamily: MONO }}>
          Erreicht ({unlocked.length})
        </div>
        {unlocked.length === 0
          ? <div style={{ fontSize: '0.75rem', color: C.textMuted }}>Noch nichts freigeschaltet — unten siehst du, wo du anfangen kannst.</div>
          : (
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem' }}>
              {unlocked.map(u => (
                <div key={u.id} title={u.id} style={{ padding: '0.45rem 0.7rem', borderRadius: 7, background: `${TIER_COLOR[u.tier ?? ''] ?? C.textMuted}1a`, border: `1px solid ${TIER_COLOR[u.tier ?? ''] ?? C.border}`, fontSize: '0.72rem', color: C.text }}>
                  <span style={{ marginRight: 4 }}>✅</span>{u.label}
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Jetzt erreichbar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.6rem', color: C.green, textTransform: 'uppercase' as const, letterSpacing: '2px', marginBottom: '0.6rem', fontFamily: MONO }}>
          Jetzt erreichbar ({reachableNow.length})
        </div>
        {reachableNow.length === 0
          ? <div style={{ fontSize: '0.75rem', color: C.textMuted }}>Nichts direkt Erreichbares — siehe unten, was noch fehlt.</div>
          : reachableNow.map(f => (
            <div key={f.id} style={{ border: `1px solid #a0dcb8`, background: C.greenLight, borderRadius: 8, padding: '0.6rem 0.8rem', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.text }}>{f.label} <span style={{ fontSize: '0.58rem', color: C.textMuted, fontWeight: 400 }}>({TIER_LABEL[f.tier] ?? f.tier})</span></div>
              <div style={{ fontSize: '0.68rem', color: C.textMuted, marginTop: 2 }}>{f.scope}</div>
              <div style={{ fontSize: '0.62rem', color: C.green, marginTop: 3 }}>Alle Voraussetzungen erfüllt — nur noch die Erfahrung/Handlung selbst fehlt.</div>
            </div>
          ))}
      </div>

      {/* Eine Stufe weiter */}
      <div>
        <div style={{ fontSize: '0.6rem', color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '2px', marginBottom: '0.6rem', fontFamily: MONO }}>
          Eine Stufe weiter ({oneAway.length})
        </div>
        {oneAway.length === 0
          ? <div style={{ fontSize: '0.75rem', color: C.textMuted }}>Nichts in Sichtweite.</div>
          : oneAway.map(f => (
            <div key={f.id} style={{ border: `1px solid ${C.border}`, background: C.bgWhite, borderRadius: 8, padding: '0.6rem 0.8rem', marginBottom: '0.5rem', opacity: 0.85 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.text }}>🔒 {f.label} <span style={{ fontSize: '0.58rem', color: C.textMuted, fontWeight: 400 }}>({TIER_LABEL[f.tier] ?? f.tier})</span></div>
              <div style={{ fontSize: '0.68rem', color: C.textMuted, marginTop: 2 }}>{f.scope}</div>
              <div style={{ fontSize: '0.62rem', color: C.accent, marginTop: 3 }}>Dafür fehlt noch: {f.missingUnlocks.map(m => m.label).join(', ')}</div>
            </div>
          ))}
      </div>
    </div>
  )
}

// ── Einstellungen-Tab ─────────────────────────────────────────────────────────

function EinstellungenTab({ username }: { username: string }) {
  const [email, setEmail]               = useState('')
  const [emailMsg, setEmailMsg]         = useState<{ text: string; ok: boolean } | null>(null)
  const [emailBusy, setEmailBusy]       = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteMsg, setDeleteMsg]         = useState<{ text: string; ok: boolean } | null>(null)
  const [deleteBusy, setDeleteBusy]       = useState(false)
  const [showDeleteForm, setShowDeleteForm] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', border: `1px solid ${C.border}`, borderRadius: 6,
    padding: '0.65rem 0.9rem', fontSize: '0.9rem', outline: 'none',
    background: C.bgWhite, color: C.text, fontFamily: MONO,
    boxSizing: 'border-box' as const,
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.62rem', textTransform: 'uppercase' as const,
    letterSpacing: '2px', color: C.textMuted, marginBottom: '0.4rem',
    fontFamily: MONO, fontWeight: 700,
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) { setEmailMsg({ text: 'Ungültige Email-Adresse.', ok: false }); return }
    setEmailBusy(true); setEmailMsg(null)
    try {
      const sb = createClient()
      const { error } = await sb.auth.updateUser({ email })
      if (error) { setEmailMsg({ text: error.message, ok: false }); return }
      setEmailMsg({ text: 'Bestätigungs-Email wurde an die neue Adresse gesendet.', ok: true })
      setEmail('')
    } catch { setEmailMsg({ text: 'Fehler beim Ändern der Email.', ok: false }) }
    setEmailBusy(false)
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault()
    if (deleteConfirm !== username) {
      setDeleteMsg({ text: `Bitte gib deinen Pilotennamen ein: "${username}"`, ok: false }); return
    }
    setDeleteBusy(true); setDeleteMsg(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const jwt = session?.access_token ?? ''
      const res = await fetch('/api/game/account?action=delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      })
      const data = await res.json() as Record<string, unknown>
      if (data.error) { setDeleteMsg({ text: data.error as string, ok: false }); return }
      await sb.auth.signOut()
      window.location.href = '/'
    } catch { setDeleteMsg({ text: 'Fehler beim Löschen. Bitte versuche es später erneut.', ok: false }) }
    setDeleteBusy(false)
  }

  return (
    <div style={{ padding: '1.25rem', overflowY: 'auto' as const, flex: 1 }}>

      {/* Email ändern */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.65rem', color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '2px', fontFamily: MONO, marginBottom: '0.75rem' }}>
          Email-Adresse ändern
        </div>
        <form onSubmit={handleEmailChange}>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={labelStyle}>Neue Email</label>
            <input style={inputStyle} type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="neue@email.de" required />
          </div>
          {emailMsg && (
            <div style={{ padding: '0.6rem 0.8rem', borderRadius: 6, marginBottom: '0.75rem', fontSize: '0.8rem', fontFamily: MONO, background: emailMsg.ok ? C.greenLight : C.redLight, color: emailMsg.ok ? C.green : C.red, border: `1px solid ${emailMsg.ok ? '#a0dcb8' : '#f0a0a0'}` }}>
              {emailMsg.text}
            </div>
          )}
          <button type="submit" disabled={emailBusy || !email} style={{ padding: '0.65rem 1.25rem', background: email ? C.accent : C.bgAlt, color: email ? '#fff' : C.textMuted, border: 'none', borderRadius: 6, cursor: email ? 'pointer' : 'not-allowed', fontSize: '0.8rem', fontWeight: 700, fontFamily: MONO }}>
            {emailBusy ? '…' : 'Bestätigungs-Email senden'}
          </button>
        </form>
      </div>

      <div style={{ height: 1, background: C.border, marginBottom: '2rem' }} />

      {/* Abmelden */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.65rem', color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '2px', fontFamily: MONO, marginBottom: '0.75rem' }}>
          Sitzung
        </div>
        <p style={{ fontSize: '0.82rem', color: C.textMuted, lineHeight: 1.6, marginBottom: '1rem' }}>
          Beendet die aktuelle Sitzung auf diesem Gerät. Dein Konto und dein Spielfortschritt bleiben erhalten.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign('/auth/logout')}
          style={{ padding: '0.65rem 1.25rem', background: C.accent, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, fontFamily: MONO }}
        >
          ↪ Abmelden
        </button>
      </div>

      <div style={{ height: 1, background: C.border, marginBottom: '2rem' }} />

      {/* Account löschen */}
      <div>
        <div style={{ fontSize: '0.65rem', color: C.red, textTransform: 'uppercase' as const, letterSpacing: '2px', fontFamily: MONO, marginBottom: '0.75rem' }}>
          Account endgültig löschen
        </div>

        {!showDeleteForm ? (
          <div>
            <p style={{ fontSize: '0.82rem', color: C.textMuted, lineHeight: 1.6, marginBottom: '1rem' }}>
              Dein Konto, alle Gebäude, Schiffe, Credits und der gesamte Spielfortschritt werden unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <button onClick={() => setShowDeleteForm(true)} style={{ padding: '0.65rem 1.25rem', background: 'transparent', color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, fontFamily: MONO }}>
              Account löschen …
            </button>
          </div>
        ) : (
          <form onSubmit={handleDeleteAccount}>
            <div style={{ background: C.redLight, border: `1px solid #f0a0a0`, borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.82rem', color: C.red, fontWeight: 700, fontFamily: MONO, marginBottom: '0.5rem' }}>
                ⚠ Diese Aktion ist unwiderruflich
              </div>
              <div style={{ fontSize: '0.78rem', color: C.text, lineHeight: 1.6 }}>
                Gib deinen Pilotennamen ein um zu bestätigen:
              </div>
              <div style={{ marginTop: '0.75rem', fontFamily: MONO, fontSize: '0.85rem', color: C.accent, fontWeight: 700 }}>
                {username}
              </div>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ ...labelStyle, color: C.red }}>Pilotenname zur Bestätigung</label>
              <input style={{ ...inputStyle, border: `1.5px solid ${C.red}44` }}
                type="text" value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={username} autoFocus />
            </div>

            {deleteMsg && (
              <div style={{ padding: '0.6rem 0.8rem', borderRadius: 6, marginBottom: '0.75rem', fontSize: '0.8rem', fontFamily: MONO, background: C.redLight, color: C.red, border: '1px solid #f0a0a0' }}>
                {deleteMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button type="submit" disabled={deleteBusy || deleteConfirm !== username}
                style={{ flex: 1, padding: '0.7rem', background: deleteConfirm === username ? C.red : C.bgAlt, color: deleteConfirm === username ? '#fff' : C.textMuted, border: 'none', borderRadius: 6, cursor: deleteConfirm === username ? 'pointer' : 'not-allowed', fontSize: '0.85rem', fontWeight: 700, fontFamily: MONO }}>
                {deleteBusy ? 'Wird gelöscht …' : 'Endgültig löschen'}
              </button>
              <button type="button" onClick={() => { setShowDeleteForm(false); setDeleteConfirm(''); setDeleteMsg(null) }}
                style={{ padding: '0.7rem 1.25rem', background: C.bgAlt, color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontFamily: MONO }}>
                Abbrechen
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

type Tab = 'kompetenzen' | 'wissenskarte' | 'einstellungen'

export default function ProfileOverlay({ username, avatar, credits, onClose }: ProfileOverlayProps) {
  const [tab, setTab]       = useState<Tab>('kompetenzen')
  const [stats, setStats]   = useState<PlayerStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        const jwt = session?.access_token ?? ''
        const [tradeRes, knowledgeRes, profileRes] = await Promise.all([
          fetch('/api/game/trade?action=getTrades',    { headers: { Authorization: `Bearer ${jwt}` } }),
          fetch('/api/game/knowledge',                 { headers: { Authorization: `Bearer ${jwt}` } }),
          fetch('/api/game/profile',                   { headers: { Authorization: `Bearer ${jwt}` } }),
        ])
        const tradeData     = await tradeRes.json() as Record<string, unknown>
        const knowledgeData = await knowledgeRes.json() as Record<string, unknown>
        const profileData   = await profileRes.json() as Record<string, unknown>
        const trades        = (tradeData.trades as any[]) ?? []
        const gesamtgewinn  = trades.reduce((s: number, t: any) => s + (t.profit ?? 0), 0)
        const profile       = (profileData.profile as { flight_count?: number } | null) ?? null
        setStats({
          transaktionen:  trades.length,
          // flight_count ist der einzige verlässliche Flugzähler (wird beim
          // tatsächlichen Flug in profiles.flight_count hochgezählt, siehe
          // app/api/game/transit/route.ts). Vorher stand hier eine Ableitung
          // aus Handelstransaktionen (from_location !== to_location), die bei
          // Spielern ohne gezählte Transportfahrten fälschlich 0 zeigte.
          fluege:         profile?.flight_count ?? 0,
          gebaeudeStunden: 0,
          wissenspunkte:  (knowledgeData.knowledge_points as number) ?? 0,
          gesamtgewinn,
          registriertSeit: '',
        })
      } catch {
        setStats({ transaktionen: 0, fluege: 0, gebaeudeStunden: 0, wissenspunkte: 0, gesamtgewinn: 0, registriertSeit: '' })
      }
      setLoading(false)
    }
    load()
  }, [])

  const kompetenzen   = stats ? buildKompetenzen(stats) : []
  const freigeschaltet = kompetenzen.flatMap(k => k.schwellen.filter(s => s.freigeschaltet)).length
  const gesamt        = kompetenzen.flatMap(k => k.schwellen).length

  return (
    // alignItems 'flex-start' + paddingTop statt 'center': zentriert hätte das
    // Overlay mit der oberen Statusleiste (Credits/Standort) und je nach
    // Bildschirmhöhe auch mit der unteren Navigationsleiste überlappt. Mit
    // festem Abstand von oben und reduzierter maxHeight bleibt oben und unten
    // sichtbar Luft.
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,8,0.75)', zIndex: 1100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1rem', paddingTop: '4.5rem', overflowY: 'auto' as const }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.bg, borderRadius: 14, width: 'min(480px, 95vw)', maxHeight: '74vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 48px rgba(0,0,0,0.4)', fontFamily: SANS, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '1.25rem 1.4rem', background: C.accent, display: 'flex', gap: '1rem', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1a3a5a', border: `2px solid ${C.gold}`, overflow: 'hidden', flexShrink: 0 }}>
            <img src={`/images/avatars/${avatar}.png`} alt={username} width={52} height={52}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{username}</div>
            <div style={{ fontSize: '0.65rem', color: C.gold, fontFamily: MONO, marginTop: 2 }}>
              {credits.toLocaleString('de')} Cr · {freigeschaltet}/{gesamt} Fähigkeiten
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8ab0d0', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>

        {/* Statistiken */}
        {stats && (
          <div style={{ padding: '0.85rem 1.4rem', background: C.bgWhite, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: '1.5rem', flexShrink: 0 }}>
            {[
              { label: 'Transaktionen', wert: stats.transaktionen },
              { label: 'Flüge',         wert: stats.fluege },
              { label: 'Gesamtgewinn',  wert: `${stats.gesamtgewinn.toLocaleString('de')} Cr` },
              { label: 'Wissen',        wert: `${stats.wissenspunkte} 🧠` },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' as const, flex: 1 }}>
                <div style={{ fontSize: '0.55rem', color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '1px' }}>{s.label}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.accent, marginTop: 2, fontFamily: MONO }}>{s.wert}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.bg, flexShrink: 0 }}>
          {(['kompetenzen', 'wissenskarte', 'einstellungen'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '0.6rem', border: 'none', borderBottom: tab === t ? `2px solid ${C.accent}` : '2px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: '0.72rem', fontWeight: tab === t ? 700 : 400, color: tab === t ? C.accent : C.textMuted, fontFamily: MONO, textTransform: 'uppercase' as const, letterSpacing: '1.5px' }}>
              {t === 'kompetenzen' ? 'Kompetenzen' : t === 'wissenskarte' ? 'Wissenskarte' : 'Einstellungen'}
            </button>
          ))}
        </div>

        {/* Tab-Inhalt */}
        <div style={{ flex: 1, overflowY: 'auto' as const }}>
          {tab === 'kompetenzen' && (
            <div style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.6rem', color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '2px', marginBottom: '0.75rem', fontFamily: MONO }}>
                Kompetenzen
              </div>
              {loading
                ? <div style={{ color: C.textMuted, textAlign: 'center' as const, padding: '2rem', fontSize: '0.8rem' }}>Lädt …</div>
                : kompetenzen.map(k => <KompetenzCard key={k.id} k={k} />)
              }
              {!loading && (
                <div style={{ marginTop: '0.9rem', padding: '0.7rem 0.9rem', background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: '0.72rem', color: C.textMuted, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem' }}>🎓</span>
                  <span>Gehe zur Akademie an deinem Standort, um weiteres Wissen zu sammeln.</span>
                </div>
              )}
            </div>
          )}
          {tab === 'wissenskarte' && <WissenskarteTab />}
          {tab === 'einstellungen' && <EinstellungenTab username={username} />}
        </div>

        <div style={{ padding: '0.5rem 1.4rem', borderTop: `1px solid ${C.border}`, fontSize: '0.58rem', color: C.textMuted, textAlign: 'center' as const, fontFamily: MONO, background: C.bgAlt, flexShrink: 0 }}>
          Kompetenzen wachsen durch Praxis — nicht durch Punkte
        </div>
      </div>
    </div>
  )
}
