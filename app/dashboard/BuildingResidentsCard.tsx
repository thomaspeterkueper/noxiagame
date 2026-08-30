'use client'

import React, { useEffect, useState } from 'react'

type HistoryItem = { id: string; tick: number; type: string; subjectType?: string | null; subjectRef?: string | null; payload?: Record<string, any> }
type Resident = {
  id: string
  personKey?: string | null
  displayName: string
  birthYear: number | null
  bioShort?: string | null
  publicRole?: string | null
  traits?: Record<string, any>
  activityState: string
  lastAction: string | null
  lastDecisionFactors?: Record<string, any>
  lastTick: number | null
  assignments: { type: string; roleCode: string | null; tileEntityId: string | null }[]
  needs: { code: string; satisfaction: number }[]
  skills: { code: string; level: number; experience: number }[]
  history?: HistoryItem[]
}

const ACTIVITY_LABEL: Record<string, string> = {
  idle: 'wartet', travelling: 'unterwegs', working: 'arbeitet', resting: 'ruht sich aus', socialising: 'im Austausch', inspecting: 'prüft eine Anlage',
}
const ROLE_LABEL: Record<string, string> = {
  technician: 'Technik', scientist: 'Forschung', geologist: 'Geologie', operator: 'Betrieb', trader: 'Handel', administrator: 'Verwaltung', service: 'Service', resident: 'Bewohner',
  medical_center_lead: 'Leitung Medical Center', water_life_support_lead: 'Wasser & Life Support', fabrication_center_lead: 'Leitung Fabrication Center', geology_lab_lead: 'Geologie & Labor', rover_operations_lead: 'Roverbetrieb', infrastructure_coordinator: 'Infrastrukturkoordination', helioscorp_liaison: 'HeliosCorp · Verträge',
}

function pct(v?: number) { return typeof v === 'number' ? `${Math.round(v * 100)}%` : '—' }
function humanAction(code?: string | null) {
  if (!code) return null
  return code.replaceAll('_', ' ')
}

export default function BuildingResidentsCard({ tileEntityId, locationSlug }: { tileEntityId?: string; locationSlug?: string }) {
  const [residents, setResidents] = useState<Resident[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!tileEntityId && !locationSlug) return
    let cancelled = false
    setLoading(true)
    const query = tileEntityId ? `tileEntityId=${encodeURIComponent(tileEntityId)}` : `locationSlug=${encodeURIComponent(locationSlug!)}`
    fetch(`/api/game/population?${query}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => { if (!cancelled) setResidents(Array.isArray(data.residents) ? data.residents : []) })
      .catch(() => { if (!cancelled) setResidents([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tileEntityId, locationSlug])

  if (loading) return <div style={{ padding: '6px 10px', background: '#0a0a08', color: '#5f6c5a', fontSize: '0.58rem' }}>Personen werden ermittelt …</div>
  if (residents.length === 0) return null

  return (
    <div style={{ padding: '8px 10px 10px', background: '#0a0a08', borderTop: '1px solid #2a2418' }}>
      <div style={{ color: '#c9d060', fontSize: '0.58rem', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>
        PERSONEN · {residents.length}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {residents.slice(0, 12).map(person => {
          const work = person.assignments.find(a => a.type === 'work')
          const home = person.assignments.find(a => a.type === 'home')
          const assignment = work ?? home
          const expanded = openId === person.id
          const rest = person.needs.find(n => n.code === 'rest')?.satisfaction
          const safety = person.needs.find(n => n.code === 'safety')?.satisfaction
          const topSkills = [...person.skills].sort((a, b) => b.level - a.level).slice(0, 4)
          return (
            <button key={person.id} onClick={() => setOpenId(expanded ? null : person.id)} style={{ width: '100%', textAlign: 'left', padding: '7px 8px', background: expanded ? '#15150f' : '#10100d', border: `1px solid ${expanded ? '#6d6330' : '#242419'}`, borderRadius: 5, cursor: 'pointer', color: 'inherit' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'start' }}>
                <div>
                  <div style={{ color: '#e2dfc6', fontSize: '0.65rem', fontWeight: 700 }}>{person.displayName}</div>
                  <div style={{ color: '#9aaa84', fontSize: '0.56rem', marginTop: 2 }}>{person.publicRole || (assignment?.roleCode ? (ROLE_LABEL[assignment.roleCode] ?? assignment.roleCode) : 'Bewohner')}</div>
                </div>
                <div style={{ color: '#9aaa84', fontSize: '0.55rem', textAlign: 'right' }}>
                  {ACTIVITY_LABEL[person.activityState] ?? person.activityState}
                  {person.lastTick != null ? <div style={{ color: '#555e50', marginTop: 1 }}>Tick {person.lastTick}</div> : null}
                </div>
              </div>

              {person.lastAction && <div style={{ color: '#c4bb76', fontSize: '0.55rem', marginTop: 5 }}>Aktuell: {humanAction(person.lastAction)}</div>}

              {expanded && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #2a2a20' }}>
                  {person.bioShort && <div style={{ color: '#b8b59f', fontSize: '0.58rem', lineHeight: 1.45, marginBottom: 7 }}>{person.bioShort}</div>}
                  <div style={{ display: 'flex', gap: 10, color: '#7f8e74', fontSize: '0.54rem', marginBottom: 7 }}>
                    <span>Erholung {pct(rest)}</span><span>Sicherheit {pct(safety)}</span>
                  </div>
                  {topSkills.length > 0 && <div style={{ marginBottom: 7 }}>
                    <div style={{ color: '#6f765f', fontSize: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Kompetenzen</div>
                    <div style={{ color: '#a8b297', fontSize: '0.53rem', lineHeight: 1.45 }}>{topSkills.map(s => `${s.code.replaceAll('_', ' ')} ${Math.round(s.level * 100)}%`).join(' · ')}</div>
                  </div>}
                  {(person.history?.length ?? 0) > 0 && <div>
                    <div style={{ color: '#6f765f', fontSize: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Letzte Ereignisse</div>
                    {(person.history ?? []).slice(0, 3).map(h => <div key={h.id} style={{ color: '#8d977f', fontSize: '0.52rem', lineHeight: 1.4 }}>Tick {h.tick}: {h.payload?.reason || h.payload?.action_code || h.type}</div>)}
                  </div>}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
