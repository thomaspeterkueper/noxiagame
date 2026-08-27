'use client'

import React, { useEffect, useState } from 'react'

type Resident = {
  id: string
  displayName: string
  birthYear: number | null
  activityState: string
  lastAction: string | null
  lastTick: number | null
  assignments: { type: string; roleCode: string | null; tileEntityId: string | null }[]
  needs: { code: string; satisfaction: number }[]
  skills: { code: string; level: number; experience: number }[]
}

const ACTIVITY_LABEL: Record<string, string> = {
  idle: 'wartet',
  travelling: 'unterwegs',
  working: 'arbeitet',
  resting: 'ruht sich aus',
  socialising: 'im Austausch',
  inspecting: 'prüft eine Anlage',
}

const ROLE_LABEL: Record<string, string> = {
  technician: 'Technik', scientist: 'Forschung', geologist: 'Geologie', operator: 'Betrieb',
  trader: 'Handel', administrator: 'Verwaltung', service: 'Service', resident: 'Bewohner',
}

export default function BuildingResidentsCard({ tileEntityId }: { tileEntityId: string }) {
  const [residents, setResidents] = useState<Resident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/game/population?tileEntityId=${encodeURIComponent(tileEntityId)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => { if (!cancelled) setResidents(Array.isArray(data.residents) ? data.residents : []) })
      .catch(() => { if (!cancelled) setResidents([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tileEntityId])

  if (loading) {
    return <div style={{ padding: '6px 10px', background: '#0a0a08', color: '#5f6c5a', fontSize: '0.58rem' }}>Bewohner werden ermittelt …</div>
  }

  if (residents.length === 0) return null

  return (
    <div style={{ padding: '7px 10px 9px', background: '#0a0a08', borderTop: '1px solid #2a2418' }}>
      <div style={{ color: '#c9d060', fontSize: '0.58rem', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 5 }}>
        PERSONEN IN DIESEM GEBÄUDE · {residents.length}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {residents.slice(0, 8).map(person => {
          const work = person.assignments.find(a => a.type === 'work')
          const home = person.assignments.find(a => a.type === 'home')
          const assignment = work ?? home
          const rest = person.needs.find(n => n.code === 'rest')?.satisfaction
          return (
            <div key={person.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', padding: '4px 6px', background: '#10100d', border: '1px solid #242419', borderRadius: 4 }}>
              <div>
                <div style={{ color: '#d8d6bd', fontSize: '0.62rem', fontWeight: 700 }}>{person.displayName}</div>
                <div style={{ color: '#7f8e74', fontSize: '0.55rem', marginTop: 1 }}>
                  {assignment?.roleCode ? (ROLE_LABEL[assignment.roleCode] ?? assignment.roleCode) : 'Bewohner'}
                  {typeof rest === 'number' ? ` · Erholung ${Math.round(rest * 100)}%` : ''}
                </div>
              </div>
              <div style={{ color: '#9aaa84', fontSize: '0.55rem', textAlign: 'right' }}>
                {ACTIVITY_LABEL[person.activityState] ?? person.activityState}
                {person.lastTick != null ? <div style={{ color: '#555e50', marginTop: 1 }}>Tick {person.lastTick}</div> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
