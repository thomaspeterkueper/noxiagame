'use client'

// app/dashboard/JourneyGuideCard.tsx
// Erstellt: 01.07.2026
// Aktualisiert: 09.07.2026 — Commit D: moon_colony Abschluss-Sequenz
// Version:      0.5.2

import React, { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { JOURNEY_DEFS, JourneyKey } from '@/lib/game/journeys'
import { T } from './ui'

type PlayerJourney = {
  id: string
  journey_key: JourneyKey
  title: string
  status: string
  progress: number
  progress_max: number
  progress_percent?: number
  completed_step_ids?: string[]
}

type JourneyStep = {
  id: string
  journey_key: JourneyKey
  step_order: number
  title: string
  description?: string | null
  optional?: boolean
}

type JourneyGuideCardProps = {
  currentLocation?: string
  onOpenShipyard?: () => void
  onOpenWarehouse?: () => void
  onOpenTravel?: () => void
  onFocusGrid?: () => void
  onOpenAcademyHint?: () => void
  onActiveStepChange?: (stepId: string | null) => void
  onStepCompleted?: (title: string) => void
  onJourneyCompleted?: (journeyKey: string) => void   // Abschluss-Sequenz
}

function pct(j: PlayerJourney) {
  if (typeof j.progress_percent === 'number') return Math.max(0, Math.min(100, j.progress_percent))
  return Math.max(0, Math.min(100, Math.round((j.progress / Math.max(1, j.progress_max)) * 100)))
}

function actionForStep(journeyKey: JourneyKey, step: JourneyStep | undefined, actions: JourneyGuideCardProps) {
  if (!step) return null
  const base = { fontSize: '0.61rem', fontWeight: 800, borderRadius: 5, padding: '0.35rem 0.55rem', cursor: 'pointer' as const }

  if (journeyKey === 'moon_colony') {
    if (step.step_order === 1) return { label: 'Werft öffnen', onClick: actions.onOpenShipyard, style: base }
    if (step.step_order === 2) return { label: 'Reise / Standort öffnen', onClick: actions.onOpenTravel, style: base }
    if (step.step_order === 3 || step.step_order === 4) return { label: 'Baufelder ansehen', onClick: actions.onFocusGrid, style: base }
  }

  if (journeyKey === 'merchant') {
    if (step.step_order === 1) return { label: 'Schiffe ansehen', onClick: actions.onOpenShipyard, style: base }
    if (step.step_order === 2 || step.step_order === 4) return { label: 'Warenhaus öffnen', onClick: actions.onOpenWarehouse, style: base }
    if (step.step_order === 3) return { label: 'Reise / Standort öffnen', onClick: actions.onOpenTravel, style: base }
  }

  if (journeyKey === 'research') {
    if (step.step_order === 1 || step.step_order === 2) return { label: 'Akademie suchen', onClick: actions.onOpenAcademyHint ?? actions.onFocusGrid, style: base }
    if (step.step_order === 3) return { label: 'Baufelder ansehen', onClick: actions.onFocusGrid, style: base }
  }

  if (journeyKey === 'industry') {
    return { label: 'Baufelder ansehen', onClick: actions.onFocusGrid, style: base }
  }

  return null
}

export default function JourneyGuideCard(props: JourneyGuideCardProps) {
  const [journeys, setJourneys] = useState<PlayerJourney[]>([])
  const [steps, setSteps] = useState<JourneyStep[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const prevCompleted = React.useRef<Set<string>>(new Set())

  async function loadJourneys() {
    try {
      setLoading(true)
      const token = await getToken()
      const res = await fetch('/api/game/journeys', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok || data.error) {
        setMsg(data.detail ? `${data.error} ${data.detail}` : data.error ?? 'Wege konnten nicht geladen werden.')
        return
      }
      const newJourneys = Array.isArray(data.journeys) ? data.journeys : []
      const newSteps    = Array.isArray(data.steps)    ? data.steps    : []
      setJourneys(newJourneys)
      setSteps(newSteps)

      // Toast bei neu abgeschlossenem Schritt
      if (props.onStepCompleted) {
        for (const j of newJourneys) {
          for (const id of j.completed_step_ids ?? []) {
            if (!prevCompleted.current.has(id)) {
              const step = newSteps.find((s: any) => s.id === id)
              if (step) props.onStepCompleted?.(step.title)
            }
          }
        }
        prevCompleted.current = new Set(newJourneys.flatMap((j: any) => j.completed_step_ids ?? []))

      // Journey-Abschluss erkennen
      if (props.onJourneyCompleted) {
        for (const j of newJourneys) {
          if (j.status === 'completed' || (j.progress >= j.progress_max && j.progress_max > 0)) {
            props.onJourneyCompleted?.(j.journey_key)
          }
        }
      }
      }
    } catch {
      setMsg('Wege konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadJourneys() }, [])

  async function startJourney(key: JourneyKey) {
    try {
      setBusy(key)
      setMsg(null)
      const token = await getToken()
      const res = await fetch('/api/game/journeys', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ journeyKey: key }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setMsg(data.detail ? `${data.error} ${data.detail}` : data.error ?? 'Weg konnte nicht gestartet werden.')
        return
      }
      await loadJourneys()
    } catch {
      setMsg('Weg konnte nicht gestartet werden.')
    } finally {
      setBusy(null)
    }
  }

  const activeKeys = useMemo(() => new Set(journeys.map(j => j.journey_key)), [journeys])

  const firstActiveStepId = useMemo(() => {
    for (const j of journeys) {
      const completed = new Set(j.completed_step_ids ?? [])
      const ownSteps = steps
        .filter(s => s.journey_key === j.journey_key)
        .sort((a, b) => a.step_order - b.step_order)
      const firstOpen = ownSteps.find(s => !completed.has(s.id))
      if (firstOpen) return firstOpen.id
    }
    return null
  }, [journeys, steps])

  useEffect(() => {
    props.onActiveStepChange?.(firstActiveStepId)
  }, [firstActiveStepId])
  const activeDefs = JOURNEY_DEFS.filter(j => activeKeys.has(j.key))
  const inactiveDefs = JOURNEY_DEFS.filter(j => !activeKeys.has(j.key))
  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.radiusLg }

  return (
    <div style={{ ...card, padding: '1rem 1.15rem', borderLeft: `4px solid ${T.gold}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.58rem', color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, marginBottom: '0.25rem' }}>Spielerführung</div>
          <div style={{ fontFamily: 'Georgia, serif', color: T.blueDeep, fontSize: '1.15rem', fontWeight: 600 }}>🎯 Ihr Weg ins Sonnensystem</div>
          <div style={{ fontSize: '0.74rem', color: T.inkSoft, marginTop: '0.2rem', lineHeight: 1.45 }}>
            Wählen Sie, womit Sie beginnen möchten. Sie können jederzeit mehrere Wege parallel verfolgen oder später wechseln.
          </div>
        </div>
        {loading && <div style={{ fontSize: '0.65rem', color: T.inkFaint }}>Lade …</div>}
      </div>

      {msg && <div style={{ color: T.red, fontSize: '0.68rem', marginBottom: '0.6rem' }}>{msg}</div>}

      {activeDefs.length > 0 && (
        <div style={{ marginBottom: '0.85rem' }}>
          <div style={{ fontSize: '0.62rem', color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: '0.35rem' }}>Aktive Wege</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.65rem' }}>
            {activeDefs.map(def => {
              const j = journeys.find(x => x.journey_key === def.key)
              const p = j ? pct(j) : 0
              const completed = new Set(j?.completed_step_ids ?? [])
              const ownSteps = steps.filter(s => s.journey_key === def.key).sort((a, b) => a.step_order - b.step_order)
              const firstOpen = ownSteps.find(s => !completed.has(s.id))
              const action = actionForStep(def.key, firstOpen, props)
              const progressMax = j?.progress_max ?? (ownSteps.length || 1)
              return (
                <div key={def.key} style={{ background: '#fbfaf7', border: `1px solid ${T.lineSoft}`, borderRadius: T.radius, padding: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ fontWeight: 800, color: T.blueDeep, fontSize: '0.82rem' }}>{def.icon} {def.title}</div>
                    <div style={{ fontSize: '0.6rem', color: T.gold, fontWeight: 800 }}>{j?.progress ?? 0}/{progressMax}</div>
                  </div>
                  <div style={{ margin: '0.45rem 0 0.55rem', height: 5, background: '#e8e4dc', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${p}%`, height: '100%', background: T.gold }} />
                  </div>

                  {firstOpen && action?.onClick && (
                    <button onClick={action.onClick} style={{ ...action.style, marginBottom: '0.5rem', border: `1px solid ${T.gold}`, background: '#fff7df', color: T.blueDeep }}>
                      {action.label} →
                    </button>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {ownSteps.length === 0 && <div style={{ fontSize: '0.66rem', color: T.inkSoft, lineHeight: 1.45 }}><strong>Nächster Schritt:</strong> {def.firstStep}</div>}
                    {ownSteps.map(step => {
                      const done = completed.has(step.id)
                      const current = firstOpen?.id === step.id
                      return (
                        <div key={step.id} style={{
                          display: 'grid', gridTemplateColumns: '18px 1fr', gap: '0.45rem', alignItems: 'start',
                          padding: current ? '0.4rem 0.45rem' : '0.15rem 0',
                          borderRadius: T.radius,
                          background: current ? 'rgba(201,169,97,0.12)' : 'transparent',
                        }}>
                          <span style={{
                            width: 16, height: 16, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.58rem', marginTop: '1px',
                            background: done ? T.gold : current ? '#fff7df' : '#ece8df',
                            color: done ? '#fff' : current ? T.gold : T.inkFaint,
                            border: `1px solid ${done ? T.gold : current ? T.gold : T.line}`,
                          }}>{done ? '✓' : step.step_order}</span>
                          <div>
                            <div style={{ fontSize: '0.66rem', fontWeight: current ? 800 : 650, color: done ? T.inkFaint : current ? T.blueDeep : T.inkSoft, textDecoration: done ? 'line-through' : 'none' }}>
                              {step.title}{step.optional && <span style={{ color: T.inkFaint, fontWeight: 500 }}> · optional</span>}
                            </div>
                            {current && step.description && <div style={{ fontSize: '0.6rem', color: T.inkSoft, lineHeight: 1.35, marginTop: '0.12rem' }}>{step.description}</div>}
                          </div>
                        </div>
                      )
                    })}
                    {ownSteps.length > 0 && !firstOpen && <div style={{ fontSize: '0.64rem', color: T.gold, fontWeight: 800, marginTop: '0.2rem' }}>Weg abgeschlossen. Sie können weitere Wege parallel starten.</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {inactiveDefs.length > 0 && (
        <div>
          <div style={{ fontSize: '0.62rem', color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: '0.35rem' }}>Beginnen mit</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.5rem' }}>
            {inactiveDefs.map(def => (
              <button key={def.key} disabled={busy !== null} onClick={() => startJourney(def.key)} style={{ textAlign: 'left', border: `1px solid ${T.line}`, background: '#fff', borderRadius: T.radius, padding: '0.75rem', cursor: busy ? 'wait' : 'pointer', color: T.ink }}>
                <div style={{ fontWeight: 800, color: T.blueDeep, fontSize: '0.78rem', marginBottom: '0.2rem' }}>{def.icon} {def.title}</div>
                <div style={{ fontSize: '0.64rem', color: T.inkSoft, lineHeight: 1.35 }}>{def.subtitle}</div>
                <div style={{ fontSize: '0.6rem', color: T.gold, marginTop: '0.45rem', fontWeight: 700 }}>{busy === def.key ? 'Starte …' : 'Weg starten →'}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
