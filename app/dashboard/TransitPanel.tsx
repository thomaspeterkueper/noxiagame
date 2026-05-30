// app/dashboard/TransitPanel.tsx
// Erstellt: 30.05.2026

'use client'

import { useEffect } from 'react'
import { useGameStore } from '@/lib/store/gameStore'

const LOC_NAME: Record<string, string> = { moon: 'Mond', mars: 'Mars', phobos: 'Phobos' }
const LOC_ICON: Record<string, string> = { moon: '🌙', mars: '🔴', phobos: '🪨' }

export default function TransitPanel({ onArrival }: { onArrival: (dest: string) => void }) {
  const { inTransit, transitFrom, transitTo, transitTotal, transitLeft, tickTransit } = useGameStore()

  useEffect(() => {
    if (!inTransit) return
    const interval = setInterval(() => {
      tickTransit()
    }, 1000)
    return () => clearInterval(interval)
  }, [inTransit])

  // Ankunft melden
  useEffect(() => {
    if (!inTransit && transitTo === null && transitFrom !== null) {
      // wurde gerade gelandet – aber transitTo ist schon null
    }
  }, [inTransit])

  const progress = transitTotal > 0 ? ((transitTotal - transitLeft) / transitTotal) * 100 : 0
  const mins = Math.floor(transitLeft / 60)
  const secs = transitLeft % 60
  const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`

  if (!inTransit) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#0a0f1a',
        border: '1px solid #1a3a5a',
        borderRadius: '12px',
        padding: '3rem',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}>
        {/* Route */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ fontSize: '2rem' }}>{LOC_ICON[transitFrom ?? '']}</div>
            <div style={{ fontSize: '0.7rem', color: '#5a7a9a', marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
              {LOC_NAME[transitFrom ?? '']}
            </div>
          </div>
          <div style={{ flex: 1, position: 'relative', height: '2px', background: '#1a3a5a' }}>
            {/* Schiff-Animation */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: `${progress}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: '1.2rem',
              transition: 'left 0.8s linear',
            }}>
              🚀
            </div>
            <div style={{
              position: 'absolute',
              top: 0, left: 0,
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #2a4e7a, #c9a961)',
              transition: 'width 0.8s linear',
            }} />
          </div>
          <div>
            <div style={{ fontSize: '2rem' }}>{LOC_ICON[transitTo ?? '']}</div>
            <div style={{ fontSize: '0.7rem', color: '#5a7a9a', marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
              {LOC_NAME[transitTo ?? '']}
            </div>
          </div>
        </div>

        {/* Countdown */}
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '3rem', fontWeight: 300, color: '#c9a961', marginBottom: '0.5rem' }}>
          {timeStr}
        </div>
        <div style={{ fontSize: '0.7rem', color: '#5a7a9a', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '2rem' }}>
          Ankunft in
        </div>

        {/* Fortschrittsbalken */}
        <div style={{ background: '#1a3a5a', height: '4px', borderRadius: '2px', overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #2a4e7a, #c9a961)',
            transition: 'width 0.8s linear',
          }} />
        </div>

        {/* Statusmeldung */}
        <div style={{ fontSize: '0.75rem', color: '#3a5a7a', fontStyle: 'italic' }}>
          {progress < 30 && 'Triebwerke auf voller Leistung...'}
          {progress >= 30 && progress < 70 && 'Reisegeschwindigkeit erreicht.'}
          {progress >= 70 && progress < 95 && 'Bremsmanöver einleiten...'}
          {progress >= 95 && 'Landeanflug läuft...'}
        </div>
      </div>
    </div>
  )
}