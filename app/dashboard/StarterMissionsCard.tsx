// app/dashboard/StarterMissionsCard.tsx
// Erstellt: 02.07.2026
// Version: 0.1.0

'use client'

import React, { useEffect, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { T } from './ui'

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
  summary: string
  reward: string
  steps: MissionStep[]
  completed: number
  total: number
  progress_percent: number
  status: 'active' | 'completed'
  nextStep: MissionStep | null
}

type Props = {
  onOpenShipyard?: () => void
  onOpenWarehouse?: () => void
  onOpenTravel?: () => void
  onFocusGrid?: () => void
  onOpenAcademyHint?: () => void
}

function actionLabel(action: MissionAction) {
  switch (action) {
    case 'shipyard': return 'Werft öffnen'
    case 'warehouse': return 'Warenhaus öffnen'
    case 'travel': return 'Reise öffnen'
    case 'grid': return 'Baufelder ansehen'
    case 'academy': return 'Akademie suchen'
    default: return 'Ansehen'
  }
}

function runAction(action: MissionAction, props: Props) {
  if (action === 'shipyard') props.onOpenShipyard?.()
  else if (action === 'warehouse') props.onOpenWarehouse?.()
  else if (action === 'travel') props.onOpenTravel?.()
  else if (action === 'grid') props.onFocusGrid?.()
  else if (action === 'academy') props.onOpenAcademyHint?.()
}

export default function StarterMissionsCard(props: Props) {
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  async function loadMissions() {
    try {
      setLoading(true)
      const token = await getToken()
      const res = await fetch('/api/game/missions', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok || data.error) {
        setMsg(data.detail ? `${data.error} ${data.detail}` : data.error ?? 'Missionen konnten nicht geladen werden.')
        return
      }
      setMissions(Array.isArray(data.missions) ? data.missions : [])
    } catch {
      setMsg('Missionen konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMissions() }, [])

  const active = missions.filter(m => m.status !== 'completed').slice(0, 3)
  const completedCount = missions.filter(m => m.status === 'completed').length
  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.radiusLg }

  return (
    <div style={{ ...card, padding: '1rem 1.15rem', borderLeft: `4px solid ${T.blue}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.58rem', color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, marginBottom: '0.25rem' }}>Erste Missionen</div>
          <div style={{ fontFamily: 'Georgia, serif', color: T.blueDeep, fontSize: '1.08rem', fontWeight: 600 }}>🧭 Das Spielprinzip lernen</div>
          <div style={{ fontSize: '0.72rem', color: T.inkSoft, marginTop: '0.2rem', lineHeight: 1.45 }}>
            Kleine Ziele zeigen die Grundsysteme: Schiff, Reise, Handel, Produktion, Forschung und Mondbasis.
          </div>
        </div>
        <div style={{ fontSize: '0.62rem', color: T.gold, fontWeight: 800, whiteSpace: 'nowrap' }}>{completedCount}/{missions.length || 6}</div>
      </div>

      {loading && <div style={{ fontSize: '0.68rem', color: T.inkFaint }}>Lade Missionen …</div>}
      {msg && <div style={{ color: T.red, fontSize: '0.68rem', marginBottom: '0.6rem' }}>{msg}</div>}

      {!loading && active.length === 0 && (
        <div style={{ fontSize: '0.72rem', color: T.gold, fontWeight: 800 }}>Alle Startmissionen abgeschlossen. Jetzt können die Journeys übernehmen.</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.65rem' }}>
        {active.map(mission => {
          const next = mission.nextStep
          return (
            <div key={mission.id} style={{ background: '#fbfaf7', border: `1px solid ${T.lineSoft}`, borderRadius: T.radius, padding: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ fontWeight: 850, color: T.blueDeep, fontSize: '0.82rem' }}>{mission.title}</div>
                <div style={{ fontSize: '0.56rem', color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>{mission.theme}</div>
              </div>
              <div style={{ margin: '0.45rem 0', height: 5, background: '#e8e4dc', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${mission.progress_percent}%`, height: '100%', background: T.blue }} />
              </div>
              <div style={{ fontSize: '0.64rem', color: T.inkSoft, lineHeight: 1.35, marginBottom: '0.55rem' }}>{mission.summary}</div>

              {next && (
                <div style={{ padding: '0.5rem', borderRadius: T.radius, background: 'rgba(42,78,122,0.08)', border: `1px solid ${T.lineSoft}` }}>
                  <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'start' }}>
                    <span style={{ width: 17, height: 17, borderRadius: '50%', background: '#fff', border: `1px solid ${T.blue}`, color: T.blue, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.58rem', flexShrink: 0 }}>→</span>
                    <div>
                      <div style={{ fontSize: '0.67rem', fontWeight: 800, color: T.blueDeep }}>{next.title}</div>
                      <div style={{ fontSize: '0.6rem', color: T.inkSoft, lineHeight: 1.35, marginTop: 2 }}>{next.description}</div>
                    </div>
                  </div>
                  {next.action !== 'none' && <button onClick={() => runAction(next.action, props)} style={{ marginTop: '0.45rem', fontSize: '0.61rem', fontWeight: 800, border: `1px solid ${T.blue}`, background: '#fff', color: T.blueDeep, borderRadius: 5, padding: '0.35rem 0.55rem', cursor: 'pointer' }}>{actionLabel(next.action)} →</button>}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.55rem' }}>
                {mission.steps.map(step => <div key={step.id} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: '0.4rem', alignItems: 'center', fontSize: '0.61rem', color: step.completed ? T.inkFaint : T.inkSoft }}><span style={{ width: 14, height: 14, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: step.completed ? T.gold : '#ece8df', color: step.completed ? '#fff' : T.inkFaint, fontSize: '0.52rem' }}>{step.completed ? '✓' : '·'}</span><span style={{ textDecoration: step.completed ? 'line-through' : 'none' }}>{step.title}</span></div>)}
              </div>
              <div style={{ fontSize: '0.56rem', color: T.gold, fontWeight: 800, marginTop: '0.55rem' }}>{mission.reward}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
