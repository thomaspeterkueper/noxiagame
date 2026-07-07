// app/dashboard/TipSystem.tsx
// Version:      1.2.0
// Erstellt:     20.06.2026
// Aktualisiert: 07.07.2026 — Kompaktes nächstes Missionsziel ergänzt
//
// Kontextsensitives Tipp-System.
// Tipps werden priorisiert — immer nur der dringendste wird gezeigt.
// "Nicht mehr anzeigen" speichert die Tip-ID in localStorage.
// Zusätzlich wird das nächste aktive Missionsziel kompakt eingeblendet.

'use client'

import { useState, useEffect, useCallback } from 'react'
import { getToken } from '@/lib/supabase/auth'

const STORAGE_KEY = 'noxia_dismissed_tips'

type MissionAction = 'shipyard' | 'warehouse' | 'travel' | 'grid' | 'academy' | 'none'

type MissionStep = {
  id: string
  title: string
  description: string
  action: MissionAction
  completed: boolean
}

type Mission = {
  id: string
  title: string
  theme: string
  status: 'active' | 'completed'
  nextStep: MissionStep | null
}

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

function actionLabel(action: MissionAction) {
  switch (action) {
    case 'shipyard': return 'Werft öffnen'
    case 'warehouse': return 'Warenhaus öffnen'
    case 'travel': return 'Navigation öffnen'
    case 'grid': return 'Zum Grid'
    case 'academy': return 'Akademie suchen'
    default: return 'Details öffnen'
  }
}

function triggerObjectiveAction(action: MissionAction) {
  if (action === 'grid' || action === 'travel') {
    window.scrollTo({ top: action === 'travel' ? 70 : 120, behavior: 'smooth' })
    return
  }

  // Fallback ohne harte Dashboard-Kopplung: öffnet den bereits vorhandenen Journey-Drawer.
  // Die Detailkarte enthält danach die direkt verdrahteten Aktionsbuttons.
  const journeyButton = Array.from(document.querySelectorAll('button'))
    .find(button => button.textContent?.includes('Journey')) as HTMLButtonElement | undefined
  journeyButton?.click()
}

export interface TipDef {
  id:        string
  icon:      string
  text:      string
  condition: boolean   // zeigen wenn true
}

interface TipBannerProps {
  tips: TipDef[]   // priorisierte Liste — erster zutreffende wird gezeigt
}

function NextObjectiveBanner() {
  const [mission, setMission] = useState<Mission | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const token = await getToken()
        const res = await fetch('/api/game/missions', { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (!res.ok || data.error) return
        const active = Array.isArray(data.missions)
          ? data.missions.find((m: Mission) => m.status !== 'completed' && m.nextStep)
          : null
        if (!cancelled) setMission(active ?? null)
      } catch {}
      finally { if (!cancelled) setMounted(true) }
    }
    load()
    const iv = window.setInterval(load, 30000)
    return () => { cancelled = true; window.clearInterval(iv) }
  }, [])

  if (!mounted || !mission?.nextStep) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.85rem',
      background: 'linear-gradient(90deg, rgba(42,78,122,0.98), rgba(42,78,122,0.88))',
      color: '#fff', borderRadius: '8px', padding: '0.65rem 0.85rem',
      marginBottom: '0.75rem', boxShadow: '0 8px 22px rgba(27,39,51,0.16)',
      border: '1px solid rgba(255,255,255,0.12)',
    }}>
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>🧭</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.55rem', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.72, fontWeight: 800 }}>Nächstes Ziel · {mission.title}</div>
        <div style={{ fontSize: '0.78rem', fontWeight: 800, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mission.nextStep.title}</div>
        <div style={{ fontSize: '0.62rem', opacity: 0.78, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mission.nextStep.description}</div>
      </div>
      {mission.nextStep.action !== 'none' && (
        <button
          onClick={() => triggerObjectiveAction(mission.nextStep!.action)}
          style={{
            background: '#fff', color: '#1a3a5a', border: 'none', borderRadius: '6px',
            padding: '0.42rem 0.7rem', fontSize: '0.65rem', fontWeight: 900,
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          {actionLabel(mission.nextStep.action)} →
        </button>
      )}
    </div>
  )
}

export function TipBanner({ tips }: TipBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [mounted, setMounted]     = useState(false)

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

  return (
    <>
      <NextObjectiveBanner />
      {tip && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '0.7rem',
          background: 'rgba(201,169,97,0.07)',
          border: '1px solid rgba(201,169,97,0.25)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.78rem',
          lineHeight: 1.55,
          color: '#3a4a5a',
        }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }}>{tip.icon}</span>
          <span style={{ flex: 1 }}>{tip.text}</span>
          <button
            onClick={() => handleDismiss(tip.id)}
            title="Diesen Tipp nicht mehr anzeigen"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#4a5a6a', fontSize: '0.65rem', flexShrink: 0,
              padding: '2px 4px', borderRadius: '4px',
              whiteSpace: 'nowrap' as const,
              lineHeight: 1.4,
            }}
          >
            ✕ ausblenden
          </button>
        </div>
      )}
    </>
  )
}
