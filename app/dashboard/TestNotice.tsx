'use client'

// app/dashboard/TestNotice.tsx
// Hinweis zum Testbetrieb – einmal je Anmeldung statt dauerhaft in der Ecke (06.11.2026,
// Rückmeldung eines Mitspielers über Thomas: „ein Hinweis, wenn man sich anmeldet, reicht,
// so nimmt es nur Platz weg“). Der Hinweis im Gespräch („Automatisch ausgewertet · Mehr dazu“) bleibt.

import { useEffect, useState } from 'react'

const KEY = 'noxia.testNoticeSeen'

export default function TestNotice() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    try { if (sessionStorage.getItem(KEY)) return } catch { /* ohne Speicher: zeigen */ }
    setShow(true)
    const timer = setTimeout(() => dismiss(), 20_000)
    return () => clearTimeout(timer)
  }, [])
  function dismiss() { setShow(false); try { sessionStorage.setItem(KEY, '1') } catch { /* egal */ } }
  if (!show) return null
  return <div role="status" style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 5000, maxWidth: 360, padding: '10px 12px', borderRadius: 8, background: 'rgba(8,25,31,.96)', color: '#d8f4ef', border: '1px solid #4e8883', fontSize: 12, lineHeight: 1.45, boxShadow: '0 2px 14px #0008' }}>
    <b style={{ display: 'block', fontSize: 11, letterSpacing: '.1em', color: '#9fd3c0' }}>TESTBETRIEB</b>
    Gespräche im Spiel werden automatisch ausgewertet; ein Schutzfilter ist aktiv. <a href="/testbetrieb" style={{ color: '#f1d57a' }}>Mehr dazu</a>
    <div style={{ marginTop: 8, textAlign: 'right' }}><button onClick={dismiss} style={{ border: '1px solid #4e8883', background: '#17383a', color: '#eef2ed', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Verstanden</button></div>
  </div>
}
