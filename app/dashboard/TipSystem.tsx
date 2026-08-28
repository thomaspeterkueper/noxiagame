'use client'

// app/dashboard/TipSystem.tsx
// Version:      1.4.0
// Aktualisiert: 28.08.2026 — separates Missionsziel-Banner entfernt;
//               Dashboard zeigt nur noch kontextsensitive, ausblendbare Tipps.

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'noxia_dismissed_tips'

function getDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}

function dismiss(id: string) {
  const set = getDismissed()
  set.add(id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

export interface TipDef {
  id: string
  icon: string
  text: string
  condition: boolean
}

interface TipBannerProps {
  tips: TipDef[]
}

export function TipBanner({ tips }: TipBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setDismissed(getDismissed())
    setMounted(true)
  }, [])

  const handleDismiss = useCallback((id: string) => {
    dismiss(id)
    setDismissed(prev => new Set([...prev, id]))
  }, [])

  if (!mounted) return null

  const tip = tips.find(t => t.condition && !dismissed.has(t.id))
  if (!tip) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.7rem',
      background: 'rgba(201,169,97,0.07)',
      border: '1px solid rgba(201,169,97,0.25)',
      borderRadius: '8px',
      padding: '0.65rem 0.85rem',
      fontSize: '0.76rem',
      lineHeight: 1.45,
      color: '#3a4a5a',
    }}>
      <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '1px' }}>{tip.icon}</span>
      <span style={{ flex: 1 }}>{tip.text}</span>
      <button
        onClick={() => handleDismiss(tip.id)}
        title="Diesen Tipp nicht mehr anzeigen"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#4a5a6a', fontSize: '0.64rem', flexShrink: 0,
          padding: '2px 4px', borderRadius: '4px',
          whiteSpace: 'nowrap' as const,
          lineHeight: 1.4,
        }}
      >
        ✕ ausblenden
      </button>
    </div>
  )
}
