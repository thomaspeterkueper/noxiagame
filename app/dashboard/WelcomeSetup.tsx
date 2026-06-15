// app/dashboard/WelcomeSetup.tsx
// Erstellt: 07.06.2026
// Erst-Login-Onboarding: Name + Avatar wählen, dann drei Einweisungskarten.
// Erscheint wenn profiles.onboarded = false. Dark-UI-Stil (Transit-Ästhetik).
//
// Einbindung in DashboardClient:
//   {profile && !profile.onboarded && (
//     <WelcomeSetup onDone={() => { reloadProfile(); /* Orders neu laden */ }} />
//   )}

'use client'

import { useState } from 'react'
import { getToken } from '@/lib/supabase/auth'

const C = {
  bg:    '#020408',
  panel: '#0a1018',
  line:  '#1c2836',
  text:  '#aab8c8',
  dim:   '#5a6878',
  gold:  '#c9a961',
  blue:  '#4a7eba',
  red:   '#c96161',
}

const AVATARS = Array.from({ length: 12 }, (_, i) => `pilot_${String(i + 1).padStart(2, '0')}`)

// Die drei Einweisungskarten: der Kernloop als Dreizeiler, Noxia-Ton.
const CARDS = [
  { icon: '💧', title: 'Kauf Wasser auf dem Mond', text: 'Hier ist es billig. Die Handelszentrale wartet auf dem Dashboard.' },
  { icon: '🔴', title: 'Flieg zum Mars', text: 'Dort ist Wasser knapp — und Knappheit hat ihren Preis.' },
  { icon: '📈', title: 'Verkauf mit Gewinn', text: 'Und sieh zu, wie die Kolonie wächst. Sie wird sich erinnern.' },
]

export default function WelcomeSetup({ onDone }: { onDone: () => void }) {
  const [step, setStep]       = useState<'setup' | 'cards'>('setup')
  const [name, setName]       = useState('')
  const [avatar, setAvatar]   = useState<string | null>(null)
  const [cardIdx, setCardIdx] = useState(0)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const mono: React.CSSProperties = { fontFamily: "'Courier Prime', 'Courier New', monospace" }
  const canSave = name.trim().length >= 2 && avatar !== null

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true); setError(null)
    const token = await getToken()
    const res = await fetch(
      `/api/game/profile?action=setup&username=${encodeURIComponent(name.trim())}&avatar=${avatar}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    setSaving(false)
    if (data.error) { setError(data.error); return }
    setStep('cards')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>

        {/* Logo-Zeile */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontWeight: 300, letterSpacing: '0.14em', color: C.gold, fontSize: '1.6rem' }}>
            noχ<sup style={{ fontSize: '0.45em' }}>1</sup>ᐃ
          </span>
        </div>

        {step === 'setup' && (
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '1.8rem' }}>
            <div style={{ ...mono, fontSize: 10, letterSpacing: '0.2em', color: C.dim, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Pilotenregistrierung · Shackleton-Basis
            </div>
            <div style={{ ...mono, fontSize: 13, color: C.text, marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Ein Frachter wartet im Dock. 5.000 Credits auf dem Konto.
              Das Sonnensystem braucht Versorger.
            </div>

            {/* Name */}
            <label style={{ ...mono, fontSize: 10, letterSpacing: '0.15em', color: C.dim, textTransform: 'uppercase' }}>
              Rufzeichen
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={20}
              placeholder="Dein Pilotenname"
              style={{
                ...mono, display: 'block', width: '100%', boxSizing: 'border-box',
                marginTop: '0.4rem', marginBottom: '1.4rem', padding: '0.65rem 0.8rem',
                background: C.bg, border: `1px solid ${C.line}`, color: C.gold,
                fontSize: 15, outline: 'none', letterSpacing: '0.05em',
              }}
            />

            {/* Avatar-Raster */}
            <label style={{ ...mono, fontSize: 10, letterSpacing: '0.15em', color: C.dim, textTransform: 'uppercase' }}>
              Dienstfoto
            </label>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px',
              marginTop: '0.5rem', marginBottom: '1.4rem',
            }}>
              {AVATARS.map(a => (
                <button key={a} onClick={() => setAvatar(a)} style={{
                  padding: 0, cursor: 'pointer', background: 'none',
                  border: avatar === a ? `2px solid ${C.gold}` : `2px solid ${C.line}`,
                  borderRadius: '4px', overflow: 'hidden', lineHeight: 0,
                  opacity: avatar === null || avatar === a ? 1 : 0.45,
                  transition: 'opacity 0.15s, border-color 0.15s',
                }}>
                  <img src={`/images/avatars/${a}.png`} alt={a} style={{ width: '100%', display: 'block' }} />
                </button>
              ))}
            </div>

            {error && (
              <div style={{ ...mono, fontSize: 11, color: C.red, marginBottom: '0.9rem' }}>{error}</div>
            )}

            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              style={{
                ...mono, width: '100%', padding: '0.8rem',
                background: canSave ? 'transparent' : 'transparent',
                border: `1px solid ${canSave ? C.gold : C.line}`,
                color: canSave ? C.gold : C.dim,
                fontSize: 13, letterSpacing: '0.1em', cursor: canSave ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? '…' : 'Registrierung abschließen'}
            </button>
          </div>
        )}

        {step === 'cards' && (
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '1.8rem', textAlign: 'center' }}>
            <div style={{ ...mono, fontSize: 10, letterSpacing: '0.2em', color: C.dim, textTransform: 'uppercase', marginBottom: '1.6rem' }}>
              Einweisung {cardIdx + 1} / {CARDS.length}
            </div>

            <div style={{ fontSize: '2.2rem', marginBottom: '0.8rem' }}>{CARDS[cardIdx].icon}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.25rem', color: C.gold, marginBottom: '0.6rem' }}>
              {CARDS[cardIdx].title}
            </div>
            <div style={{ ...mono, fontSize: 13, color: C.text, lineHeight: 1.7, maxWidth: '380px', margin: '0 auto 1.8rem' }}>
              {CARDS[cardIdx].text}
            </div>

            {/* Fortschritts-Punkte */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '1.6rem' }}>
              {CARDS.map((_, i) => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: i === cardIdx ? C.gold : C.line,
                }} />
              ))}
            </div>

            <button
              onClick={() => cardIdx < CARDS.length - 1 ? setCardIdx(cardIdx + 1) : onDone()}
              style={{
                ...mono, padding: '0.75rem 2.5rem',
                background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold,
                fontSize: 13, letterSpacing: '0.1em', cursor: 'pointer',
              }}
            >
              {cardIdx < CARDS.length - 1 ? 'Weiter' : 'Zum Dock'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
