// app/dashboard/ProfileOverlay.tsx
// Erstellt:     21.06.2026 21:15
// Aktualisiert: 21.06.2026 21:15
// Version:      1.0.0
//
// Spielerprofil-Overlay — zeigt Kompetenzen, Statistiken, freigeschaltete
// Fähigkeiten. Öffnet sich über Avatar-Klick im Header oder Profil-Gebäude.
//
// Kompetenz-System: organisch durch Praxis, keine Level-Zahlen.
// Schwellen öffnen echte Spielmechaniken (nicht nur kosmetisch).

'use client'

import { useState, useEffect } from 'react'

const MONO = "'Courier Prime', monospace"

// ── Kompetenz-Definitionen ────────────────────────────────────────────────────

interface KompetenzSchwelle {
  wert:        number   // ab diesem Wert freigeschaltet
  label:       string
  beschreibung: string
  freigeschaltet: boolean
}

interface Kompetenz {
  id:       string
  icon:     string
  label:    string
  wert:     number     // aktueller Wert
  einheit:  string     // z.B. "Transaktionen", "Flüge"
  schwellen: KompetenzSchwelle[]
  farbe:    string
}

function buildKompetenzen(stats: PlayerStats): Kompetenz[] {
  const t = stats.transaktionen
  const f = stats.fluege
  const b = stats.gebaeudeStunden
  const w = stats.wissenspunkte

  return [
    {
      id: 'handel', icon: '⚖️', label: 'Handel', wert: t, einheit: 'Transaktionen', farbe: '#c9a961',
      schwellen: [
        { wert: 10,  label: 'Händler',       beschreibung: 'Marktpreishistorie der letzten 7 Tage sichtbar', freigeschaltet: t >= 10 },
        { wert: 50,  label: 'Kaufmann',       beschreibung: 'Zugang zu Aufträgen mit höherem Reward',        freigeschaltet: t >= 50 },
        { wert: 200, label: 'Handelsmagnat',  beschreibung: 'Rohstoff-Termingeschäfte verfügbar',            freigeschaltet: t >= 200 },
      ],
    },
    {
      id: 'pilot', icon: '🚀', label: 'Pilot', wert: f, einheit: 'Flüge', farbe: '#5aaeff',
      schwellen: [
        { wert: 5,   label: 'Copilot',        beschreibung: 'Energieverbrauch −10% auf allen Routen',        freigeschaltet: f >= 5 },
        { wert: 20,  label: 'Pilot',           beschreibung: 'Schwerere Schiffe ohne Reichweitenmalus',       freigeschaltet: f >= 20 },
        { wert: 75,  label: 'Raumfahrer',      beschreibung: 'Piratenbegegnungen durch Ausweichmanöver meidbar', freigeschaltet: f >= 75 },
      ],
    },
    {
      id: 'bau', icon: '🏗️', label: 'Bauen', wert: b, einheit: 'Gebäudestunden', farbe: '#6fcf97',
      schwellen: [
        { wert: 50,   label: 'Bauherr',        beschreibung: 'Bauzeit aller Gebäude −1 Tick',                 freigeschaltet: b >= 50 },
        { wert: 200,  label: 'Investor',        beschreibung: 'Gebäudeverkauf ohne Sofort-Abschlag',          freigeschaltet: b >= 200 },
        { wert: 1000, label: 'Immobilienmagnat',beschreibung: 'Exklusive Gebäudetypen freigeschaltet',        freigeschaltet: b >= 1000 },
      ],
    },
    {
      id: 'wissen', icon: '🧠', label: 'Wissen', wert: w, einheit: 'Punkte', farbe: '#b48ce8',
      schwellen: [
        { wert: 100,  label: 'Student',         beschreibung: 'Koloniedetails vollständig sichtbar',           freigeschaltet: w >= 100 },
        { wert: 500,  label: 'Forscher',         beschreibung: 'NPC-Verhaltensmuster erkennbar',               freigeschaltet: w >= 500 },
        { wert: 2000, label: 'Wissenschaftler',  beschreibung: 'Eigene Forschungsprojekte starten',            freigeschaltet: w >= 2000 },
      ],
    },
  ]
}

// ── Interfaces ────────────────────────────────────────────────────────────────

interface PlayerStats {
  transaktionen:    number
  fluege:           number
  gebaeudeStunden:  number
  wissenspunkte:    number
  gesamtgewinn:     number
  registriertSeit:  string
}

interface ProfileOverlayProps {
  username:  string
  avatar:    string
  credits:   number
  onClose:   () => void
}

// ── Kompetenz-Balken ─────────────────────────────────────────────────────────

function KompetenzCard({ k }: { k: Kompetenz }) {
  const [open, setOpen] = useState(false)
  const naechste = k.schwellen.find(s => !s.freigeschaltet)
  const pct = naechste
    ? Math.min(100, Math.round((k.wert / naechste.wert) * 100))
    : 100

  return (
    <div style={{ background: '#fff', border: '1px solid #e0ddd6', borderRadius: '10px', overflow: 'hidden', marginBottom: '0.5rem' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
      >
        <span style={{ fontSize: '1.2rem' }}>{k.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1a2a3a' }}>{k.label}</span>
            <span style={{ fontSize: '0.65rem', color: '#6a7a8a', fontFamily: MONO }}>
              {k.wert.toLocaleString('de')} {k.einheit}
            </span>
          </div>
          <div style={{ background: '#f0ede8', height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: k.farbe, borderRadius: '3px', transition: 'width 0.5s' }} />
          </div>
          {naechste && (
            <div style={{ fontSize: '0.57rem', color: '#8a9ab0', marginTop: '3px' }}>
              {pct}% → {naechste.label} (noch {(naechste.wert - k.wert).toLocaleString('de')} {k.einheit})
            </div>
          )}
          {!naechste && (
            <div style={{ fontSize: '0.57rem', color: k.farbe, marginTop: '3px' }}>✓ Alle Schwellen erreicht</div>
          )}
        </div>
        <span style={{ fontSize: '0.65rem', color: '#8a9ab0' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid #f0ede8', padding: '0.5rem 1rem 0.75rem' }}>
          {k.schwellen.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.4rem 0', borderBottom: i < k.schwellen.length - 1 ? '1px solid #f8f6f2' : 'none' }}>
              <span style={{ fontSize: '0.9rem', marginTop: '1px' }}>{s.freigeschaltet ? '✅' : '🔒'}</span>
              <div>
                <div style={{ fontSize: '0.73rem', fontWeight: 700, color: s.freigeschaltet ? '#1a2a3a' : '#8a9ab0' }}>
                  {s.label}
                  <span style={{ fontWeight: 400, color: '#8a9ab0', marginLeft: '0.4rem', fontSize: '0.62rem' }}>
                    ab {s.wert.toLocaleString('de')} {k.einheit}
                  </span>
                </div>
                <div style={{ fontSize: '0.65rem', color: s.freigeschaltet ? '#4a6a8a' : '#a0b0c0', marginTop: '1px' }}>
                  {s.beschreibung}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function ProfileOverlay({ username, avatar, credits, onClose }: ProfileOverlayProps) {
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        const jwt = session?.access_token ?? ''

        // Statistiken aus verschiedenen Quellen zusammensetzen
        const [tradeRes, knowledgeRes] = await Promise.all([
          fetch('/api/game/trade?action=getTrades', { headers: { Authorization: `Bearer ${jwt}` } }),
          fetch('/api/game/knowledge',               { headers: { Authorization: `Bearer ${jwt}` } }),
        ])
        const tradeData     = await tradeRes.json()
        const knowledgeData = await knowledgeRes.json()

        const trades = tradeData.trades ?? []
        const gesamtgewinn = trades.reduce((s: number, t: any) => s + (t.profit ?? 0), 0)

        setStats({
          transaktionen:   trades.length,
          fluege:          trades.filter((t: any) => t.from_location !== t.to_location).length,
          gebaeudeStunden: 0,   // TODO: aus player_builds berechnen
          wissenspunkte:   knowledgeData.knowledge_points ?? 0,
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

  const kompetenzen = stats ? buildKompetenzen(stats) : []
  const freigeschaltet = kompetenzen.flatMap(k => k.schwellen.filter(s => s.freigeschaltet)).length
  const gesamt = kompetenzen.flatMap(k => k.schwellen).length

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,8,0.75)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#f4f2ed', borderRadius: '14px',
        width: 'min(480px, 95vw)', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 48px rgba(0,0,0,0.4)',
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ padding: '1.25rem 1.4rem', background: '#2a4e7a', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1a3a5a', border: '2px solid #c9a961', overflow: 'hidden', flexShrink: 0 }}>
            <img src={`/images/avatars/${avatar}.png`} alt={username} width={52} height={52}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{username}</div>
            <div style={{ fontSize: '0.65rem', color: '#c9a961', fontFamily: MONO, marginTop: '2px' }}>
              {credits.toLocaleString('de')} Cr · {freigeschaltet}/{gesamt} Fähigkeiten
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8ab0d0', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>

        {/* Statistiken */}
        {stats && (
          <div style={{ padding: '0.85rem 1.4rem', background: '#fff', borderBottom: '1px solid #e0ddd6', display: 'flex', gap: '1.5rem' }}>
            {[
              { label: 'Transaktionen', wert: stats.transaktionen },
              { label: 'Flüge',         wert: stats.fluege },
              { label: 'Gesamtgewinn',  wert: `${stats.gesamtgewinn.toLocaleString('de')} Cr` },
              { label: 'Wissen',        wert: `${stats.wissenspunkte} 🧠` },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '0.55rem', color: '#8a9ab0', textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#2a4e7a', marginTop: '2px', fontFamily: MONO }}>{s.wert}</div>
              </div>
            ))}
          </div>
        )}

        {/* Kompetenzen */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.6rem', color: '#8a9ab0', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.75rem' }}>
            Kompetenzen
          </div>

          {loading ? (
            <div style={{ color: '#8a9ab0', textAlign: 'center', padding: '2rem', fontSize: '0.8rem' }}>Lädt …</div>
          ) : (
            kompetenzen.map(k => <KompetenzCard key={k.id} k={k} />)
          )}
        </div>

        <div style={{ padding: '0.5rem 1.4rem', borderTop: '1px solid #e0ddd6', fontSize: '0.58rem', color: '#8a9ab0', textAlign: 'center', fontFamily: MONO }}>
          Kompetenzen wachsen durch Praxis — nicht durch Punkte
        </div>
      </div>
    </div>
  )
}
