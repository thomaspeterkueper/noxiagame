'use client'

import React from 'react'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (username.length < 3) { setError('Benutzername muss mindestens 3 Zeichen haben.'); return }
    if (password.length < 6) { setError('Passwort muss mindestens 6 Zeichen haben.'); return }

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Nach Registrierung direkt einloggen
const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
if (loginError) {
  router.push('/auth/login')
} else {
  // Nach Registrierung direkt einloggen
const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
if (loginError) {
  router.push('/auth/login')
} else {
  router.push('/dashboard')
}
}
    router.refresh()
  }

  const s = {
    page:  { minHeight: '100vh', background: '#f4f2ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
    card:  { background: '#fff', border: '1px solid #e2ddd4', borderRadius: '8px', padding: '2.5rem', width: '100%', maxWidth: '400px' } as React.CSSProperties,
    label: { display: 'block', fontSize: '0.65rem', textTransform: 'uppercase' as const, letterSpacing: '2px', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 700 },
    input: { width: '100%', border: '1px solid #e2ddd4', borderRadius: '4px', padding: '0.6rem 0.8rem', fontSize: '0.9rem', outline: 'none', background: '#faf9f6', color: '#1e2a36', boxSizing: 'border-box' as const },
    btn:   { width: '100%', background: '#2a4e7a', color: '#fff', border: 'none', padding: '0.75rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '2px', borderRadius: '4px', cursor: 'pointer' },
    error: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', padding: '0.6rem 0.8rem', fontSize: '0.8rem', color: '#c0392b', marginBottom: '1rem' },
  }

  return (
    <main style={s.page}>
      <div style={s.card}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 300, letterSpacing: '0.15em', color: '#2a4e7a', fontSize: '1.8rem', margin: '0 0 0.5rem' }}>
            noχ<sup style={{ fontSize: '0.45em', verticalAlign: 'super', lineHeight: 0 }}>1</sup>ᐃ
          </h1>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '3px' }}>Konto erstellen</p>
        </div>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={s.label}>Pilotenname</label>
            <input
              style={s.input}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="z.B. IronDrifter"
              required
              autoFocus
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={s.label}>Email</label>
            <input
              style={s.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="pilot@noxia.space"
              required
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={s.label}>Passwort</label>
            <input
              style={s.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mindestens 6 Zeichen"
              required
            />
          </div>
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Wird erstellt...' : 'Konto erstellen'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
          Bereits registriert?{' '}
          <Link href="/auth/login" style={{ color: '#2a4e7a', fontWeight: 700, textDecoration: 'none' }}>
            Anmelden
          </Link>
        </p>
      </div>
    </main>
  )
}