'use client'

// app/_components/MusicLink.tsx
// Erstellt:     31.05.2026
// Aktualisiert: 04.07.2026 — Login-Overlay statt Seitennavigation
// Version:      2.0.0
import React, { useState } from 'react'
import { useMusicContext } from './MusicProvider'
import { createClient } from '@/lib/supabase/client'

const MONO = "'Courier Prime', monospace"

export default function MusicLink() {
  const { play } = useMusicContext()
  const [showLogin, setShowLogin] = useState(false)
  const [mode, setMode]           = useState<'login' | 'register'>('login')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [name, setName]           = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    play()

    // Session prüfen
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()

    if (session) {
      window.location.href = '/dashboard'
    } else {
      setShowLogin(true)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const sb = createClient()
    const { error } = await sb.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError('Email oder Passwort falsch.'); return }
    window.location.href = '/dashboard'
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const sb = createClient()
    const { error } = await sb.auth.signUp({
      email, password,
      options: { data: { username: name } }
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    window.location.href = '/dashboard'
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1px solid rgba(201,169,97,0.3)',
    borderRadius: 6, padding: '0.65rem 0.9rem',
    fontSize: '0.9rem', outline: 'none',
    background: 'rgba(4,9,16,0.6)', color: '#e8e4da',
    fontFamily: MONO, boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.6rem',
    textTransform: 'uppercase', letterSpacing: '2px',
    color: 'rgba(201,169,97,0.6)', marginBottom: '0.4rem',
    fontFamily: MONO,
  }

  return (
    <>
      {/* CTA-Button */}
      <a href="/dashboard" onClick={handleClick} style={{
        display: 'inline-block',
        color: '#c9a961',
        fontSize: '0.8rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '3px',
        borderBottom: '1px solid #c9a961',
        paddingBottom: '8px',
        textDecoration: 'none',
        fontFamily: 'sans-serif',
        textShadow: '0 1px 8px rgba(0,0,0,0.9)',
        marginTop: '1rem',
        cursor: 'pointer',
      }}>
        Ins Universum
      </a>

      {/* Login-Overlay — erscheint über dem Universum-Bild */}
      {showLogin && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(4,9,16,0.82)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
          onClick={e => e.target === e.currentTarget && setShowLogin(false)}
        >
          <div style={{
            background: 'rgba(8,16,28,0.97)',
            border: '1px solid rgba(201,169,97,0.3)',
            borderRadius: 12,
            padding: '2.25rem 2rem',
            width: 'min(380px, 92vw)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.7)',
          }}>
            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <h2 style={{
                fontFamily: 'Georgia, serif', fontWeight: 300,
                letterSpacing: '0.15em', color: '#2a4e7a',
                fontSize: '1.6rem', margin: '0 0 0.4rem',
              }}>
                noχ<sup style={{ fontSize: '0.45em', verticalAlign: 'super', lineHeight: 0 }}>1</sup>ᐃ
              </h2>
              <p style={{ fontSize: '0.6rem', color: 'rgba(201,169,97,0.6)', textTransform: 'uppercase', letterSpacing: '3px', fontFamily: MONO, margin: 0 }}>
                {mode === 'login' ? 'Anmelden' : 'Registrieren'}
              </p>
            </div>

            {/* Mode-Toggle */}
            <div style={{ display: 'flex', marginBottom: '1.5rem', borderBottom: '1px solid rgba(201,169,97,0.2)' }}>
              {(['login', 'register'] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setError('') }}
                  style={{
                    flex: 1, padding: '0.5rem', border: 'none',
                    borderBottom: mode === m ? '2px solid #c9a961' : '2px solid transparent',
                    background: 'transparent',
                    color: mode === m ? '#c9a961' : 'rgba(201,169,97,0.4)',
                    cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                    fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '2px',
                  }}>
                  {m === 'login' ? 'Anmelden' : 'Neu registrieren'}
                </button>
              ))}
            </div>

            {error && (
              <div style={{ background: 'rgba(181,42,42,0.15)', border: '1px solid rgba(181,42,42,0.4)', borderRadius: 6, padding: '0.6rem 0.8rem', fontSize: '0.8rem', color: '#f08080', marginBottom: '1rem', fontFamily: MONO }}>
                {error}
              </div>
            )}

            <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
              {mode === 'register' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Pilotenname</label>
                  <input style={inputStyle} type="text" value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="McKnight" required autoFocus />
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="pilot@noxia.space" required
                  autoFocus={mode === 'login'} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Passwort</label>
                <input style={inputStyle} type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required />
              </div>
              <button type="submit" disabled={loading} style={{
                width: '100%', background: '#2a4e7a', color: '#fff',
                border: 'none', padding: '0.8rem',
                fontSize: '0.72rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '2px',
                borderRadius: 6, cursor: loading ? 'wait' : 'pointer',
                fontFamily: MONO, opacity: loading ? 0.7 : 1,
              }}>
                {loading ? '…' : mode === 'login' ? 'Ins Universum →' : 'Konto erstellen →'}
              </button>
            </form>

            <button onClick={() => setShowLogin(false)} style={{
              display: 'block', margin: '1rem auto 0',
              background: 'transparent', border: 'none',
              color: 'rgba(201,169,97,0.4)', cursor: 'pointer',
              fontSize: '0.68rem', fontFamily: MONO,
            }}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </>
  )
}
