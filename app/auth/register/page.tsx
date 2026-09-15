'use client'

import React, { useState } from 'react'
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
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (username.length < 3) {
      setError('Benutzername muss mindestens 3 Zeichen haben.')
      return
    }
    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen haben.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.session) {
      router.replace('/dashboard')
      router.refresh()
      return
    }

    if (data.user) {
      setRegisteredEmail(email)
      setLoading(false)
      return
    }

    setError('Das Konto konnte nicht vollständig erstellt werden. Bitte versuche es erneut.')
    setLoading(false)
  }

  const s = {
    page: { minHeight: '100vh', background: '#f4f2ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
    card: { background: '#fff', border: '1px solid #e2ddd4', borderRadius: '8px', padding: '2.5rem', width: '100%', maxWidth: '400px' } as React.CSSProperties,
    label: { display: 'block', fontSize: '0.65rem', textTransform: 'uppercase' as const, letterSpacing: '2px', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 700 },
    input: { width: '100%', border: '1px solid #e2ddd4', borderRadius: '4px', padding: '0.6rem 0.8rem', fontSize: '0.9rem', outline: 'none', background: '#faf9f6', color: '#1e2a36', boxSizing: 'border-box' as const },
    btn: { width: '100%', background: '#2a4e7a', color: '#fff', border: 'none', padding: '0.75rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '2px', borderRadius: '4px', cursor: 'pointer' },
    error: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', padding: '0.6rem 0.8rem', fontSize: '0.8rem', color: '#c0392b', marginBottom: '1rem' },
    success: { background: '#f0f7f4', border: '1px solid #c9ded4', borderRadius: '6px', padding: '1rem', fontSize: '0.82rem', color: '#315b49', lineHeight: 1.6 } as React.CSSProperties,
  }

  return (
    <main style={s.page}>
      <div style={s.card}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 300, letterSpacing: '0.15em', color: '#2a4e7a', fontSize: '1.8rem', margin: '0 0 0.5rem' }}>
            noχ<sup style={{ fontSize: '0.45em', verticalAlign: 'super', lineHeight: 0 }}>1</sup>ᐃ
          </h1>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '3px' }}>
            {registeredEmail ? 'E-Mail bestätigen' : 'Konto erstellen'}
          </p>
        </div>

        {error && <div style={s.error}>{error}</div>}

        {registeredEmail ? (
          <div>
            <div style={s.success}>
              <strong>Konto erstellt.</strong>
              <div style={{ marginTop: '0.45rem' }}>
                Wir haben eine Bestätigungs-E-Mail an <strong>{registeredEmail}</strong> gesendet.
                Öffne den Link in dieser E-Mail. Danach wirst du automatisch zum NOXIA-Dashboard weitergeleitet.
              </div>
            </div>
            <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              Bereits bestätigt?{' '}
              <Link href="/auth/login" style={{ color: '#2a4e7a', fontWeight: 700, textDecoration: 'none' }}>
                Anmelden
              </Link>
            </p>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </main>
  )
}
