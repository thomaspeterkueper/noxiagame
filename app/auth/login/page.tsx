'use client'

// app/auth/login/page.tsx
// Aktualisiert: 15.09.2026 — Registrierung auf kanonischen Flow vereinheitlicht; harter Redirect nach Login
import React from 'react'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router   = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [visible, setVisible]   = useState(false)

  // Fade-in nach Mount
  useEffect(() => { setTimeout(() => setVisible(true), 50) }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.session || !data.user) {
      setError('Email oder Passwort falsch.')
      setLoading(false)
      return
    }

    // Ein voller Seitenwechsel verhindert, dass Zustand-/React-State eines zuvor
    // angemeldeten Accounts beim Kontowechsel im Browser erhalten bleibt.
    window.location.assign('/dashboard')
  }

  function handleRegister() {
    // Es gibt genau einen Registrierungsweg. Dort werden Username,
    // E-Mail-Verifikation und Confirmation-Callback korrekt behandelt.
    router.push('/auth/register')
  }

  return (
    <main style={{
      minHeight: '100vh',
      backgroundImage: 'url(/images/hero.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,9,16,0.55)', zIndex: 0 }} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        background: 'rgba(255,255,255,0.97)',
        borderRadius: '12px',
        padding: '2.75rem 2.5rem',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
        margin: '1rem',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 300, letterSpacing: '0.15em', color: '#2a4e7a', fontSize: '2rem', margin: '0 0 0.4rem' }}>
            noχ<sup style={{ fontSize: '0.45em', verticalAlign: 'super', lineHeight: 0 }}>1</sup>ᐃ
          </h1>
          <div style={{ width: '40px', height: '2px', background: '#c9a961', margin: '0 auto' }} />
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #e2ddd4', marginBottom: '1.75rem' }}>
          <button
            type="button"
            style={{
              flex: 1, padding: '0.6rem', background: 'transparent', border: 'none',
              borderBottom: '2px solid #c9a961', color: '#2a4e7a',
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' as const,
              letterSpacing: '2px', cursor: 'default', transition: 'color 0.2s',
            }}>
            Anmelden
          </button>
          <button
            type="button"
            onClick={handleRegister}
            style={{
              flex: 1, padding: '0.6rem', background: 'transparent', border: 'none',
              borderBottom: '2px solid transparent', color: '#94a3b8',
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' as const,
              letterSpacing: '2px', cursor: 'pointer', transition: 'color 0.2s',
            }}>
            Neu registrieren
          </button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem 0.8rem', fontSize: '0.8rem', color: '#c0392b', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.62rem', textTransform: 'uppercase' as const, letterSpacing: '2px', color: '#64748b', marginBottom: '0.4rem', fontWeight: 700 }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="pilot@noxia.space" required autoFocus
              style={{ width: '100%', border: '1px solid #e2ddd4', borderRadius: '6px', padding: '0.65rem 0.9rem', fontSize: '0.95rem', outline: 'none', background: '#fafaf8', color: '#1e2a36', boxSizing: 'border-box' as const, transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = '#2a4e7a'}
              onBlur={e => e.target.style.borderColor = '#e2ddd4'}
            />
          </div>
          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.62rem', textTransform: 'uppercase' as const, letterSpacing: '2px', color: '#64748b', marginBottom: '0.4rem', fontWeight: 700 }}>
              Passwort
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              style={{ width: '100%', border: '1px solid #e2ddd4', borderRadius: '6px', padding: '0.65rem 0.9rem', fontSize: '0.95rem', outline: 'none', background: '#fafaf8', color: '#1e2a36', boxSizing: 'border-box' as const, transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = '#2a4e7a'}
              onBlur={e => e.target.style.borderColor = '#e2ddd4'}
            />
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', background: loading ? '#94a3b8' : '#2a4e7a',
            color: '#fff', border: 'none', padding: '0.85rem',
            fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' as const,
            letterSpacing: '3px', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}>
            {loading ? 'Bitte warten …' : 'Ins Universum →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.75rem', color: '#94a3b8' }}>
          <Link href="/auth/reset-password" style={{ color: '#94a3b8', textDecoration: 'none' }}>
            Passwort vergessen?
          </Link>
        </p>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.65rem', color: '#c8c0b4', letterSpacing: '1px' }}>
          NOXIA · SOLAR SYSTEM TRADING
        </p>
      </div>
    </main>
  )
}
