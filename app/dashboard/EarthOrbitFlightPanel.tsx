'use client'

import { useCallback, useEffect, useState } from 'react'
import { useGameStore } from '@/lib/store/gameStore'
import { getToken } from '@/lib/supabase/auth'

type EvidenceState = 'ready' | 'blocked' | 'unresolved'
type Evidence = Record<
  'spacecraft' | 'actor' | 'departureSurface' | 'destinationOrbit' | 'docking' | 'missionConflict' | 'crew' | 'cargo' | 'engineering',
  EvidenceState
>

type ReadinessResponse = {
  ok?: boolean
  assessment?: { ready: boolean; blockers: string[] }
  evidence?: Evidence
  crew?: { boarded: boolean; role: string | null }
  cargo?: { empty: boolean; totalLegacyAmount: number; unresolvedResources: string[]; rationale: string }
  engineeringRequest?: string
  error?: string
}

type MissionResponse = {
  ok?: boolean
  mission?: {
    id: string
    phase: string
    status: string
    target_orbit_node_slug: string
  } | null
  presentation?: {
    progress: number
    label: string
    terminal: boolean
  } | null
  executionReady?: boolean
  orbitalPresence?: unknown
  error?: string
}

const LABELS: Record<keyof Evidence, string> = {
  spacecraft: 'Raumfahrzeug',
  actor: 'Berechtigung',
  departureSurface: 'Startort Erde',
  destinationOrbit: '400-km-LEO',
  docking: 'Docking frei',
  missionConflict: 'Keine andere Mission',
  crew: 'Crew',
  cargo: 'Fracht / Masse',
  engineering: 'Engineering-Freigabe',
}

function stateGlyph(state: EvidenceState) {
  if (state === 'ready') return '✓'
  if (state === 'blocked') return '×'
  return '…'
}

async function gameRequest(path: string, init?: RequestInit) {
  const token = await getToken()
  if (!token) throw new Error('Nicht eingeloggt')
  return fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })
}

/**
 * First playable-spaceflight surface. It exposes unresolved Core gates instead
 * of offering a fake teleport button. Player crew presence is explicit and
 * empty cargo is resolved as a physical zero-payload state.
 */
export default function EarthOrbitFlightPanel() {
  const location = useGameStore(s => s.location)
  const shipId = useGameStore(s => s.shipId)
  const inTransit = useGameStore(s => s.inTransit)

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null)
  const [mission, setMission] = useState<MissionResponse | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!shipId || location !== 'earth' || inTransit) return
    setLoading(true)
    setMessage(null)
    try {
      const [readinessRes, missionRes] = await Promise.all([
        gameRequest('/api/game/ascent/readiness', {
          method: 'POST',
          body: JSON.stringify({
            shipId,
            departureSurfaceSlug: 'earth',
            targetOrbitNodeSlug: 'earth-leo-400',
          }),
        }),
        gameRequest(`/api/game/ascent?shipId=${encodeURIComponent(shipId)}`),
      ])
      setReadiness(await readinessRes.json())
      setMission(await missionRes.json())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Raumflugstatus konnte nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [shipId, location, inTransit])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  if (location !== 'earth' || inTransit || !shipId) return null

  const activeMission = mission?.mission && mission.mission.status === 'active'
  const canAdvance = Boolean(activeMission && mission?.executionReady)
  const ready = Boolean(readiness?.assessment?.ready)
  const needsCrew = Boolean(readiness?.evidence && readiness.evidence.crew !== 'ready')

  async function boardSelf() {
    if (!shipId) return
    setLoading(true)
    setMessage(null)
    try {
      const res = await gameRequest('/api/game/ascent/crew', {
        method: 'POST',
        body: JSON.stringify({ action: 'board-self', shipId }),
      })
      const data = await res.json()
      if (!res.ok) setMessage(data.error ?? 'Crew konnte nicht an Bord gehen.')
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  async function authorize() {
    if (!shipId) return
    setLoading(true)
    setMessage(null)
    try {
      const res = await gameRequest('/api/game/ascent', {
        method: 'POST',
        body: JSON.stringify({
          action: 'authorize',
          shipId,
          departureSurfaceSlug: 'earth',
          targetOrbitNodeSlug: 'earth-leo-400',
        }),
      })
      const data = await res.json()
      if (!res.ok) setMessage(data.error ?? 'Startfreigabe nicht verfügbar.')
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  async function advance() {
    if (!shipId) return
    setLoading(true)
    setMessage(null)
    try {
      const res = await gameRequest('/api/game/ascent', {
        method: 'POST',
        body: JSON.stringify({ action: 'advance', shipId }),
      })
      const data = await res.json()
      if (!res.ok) setMessage(data.error ?? 'Flugphase konnte nicht fortgesetzt werden.')
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', right: 14, bottom: 86, zIndex: 2290, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            border: '1px solid rgba(201,169,97,.55)',
            background: 'rgba(7,17,27,.94)',
            color: '#e6d3a0',
            borderRadius: 8,
            padding: '8px 12px',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0,0,0,.28)',
          }}
        >
          ↑ Erde → LEO
        </button>
      ) : (
        <section style={{ width: 330, border: '1px solid rgba(201,169,97,.42)', borderRadius: 10, background: 'rgba(5,13,22,.97)', color: '#d8e8ef', boxShadow: '0 14px 40px rgba(0,0,0,.45)', overflow: 'hidden' }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px', borderBottom: '1px solid rgba(77,119,145,.32)' }}>
            <div>
              <div style={{ color: '#c9a961', fontSize: 12, fontWeight: 700 }}>RAUMFLUG</div>
              <div style={{ marginTop: 2, fontSize: 10, color: '#7891a0' }}>EARTH → 400 KM LEO</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 0, color: '#7891a0', cursor: 'pointer', fontSize: 16 }}>×</button>
          </header>

          <div style={{ padding: 11 }}>
            {mission?.mission ? (
              <div style={{ marginBottom: 10, padding: 8, borderRadius: 6, background: 'rgba(42,78,122,.18)', border: '1px solid rgba(70,112,155,.28)' }}>
                <div style={{ fontSize: 10, color: '#7891a0' }}>MISSION</div>
                <div style={{ marginTop: 3, color: '#d8e8ef', fontSize: 12 }}>{mission.presentation?.label ?? mission.mission.phase}</div>
                <div style={{ height: 5, marginTop: 7, borderRadius: 3, background: '#111f2b', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((mission.presentation?.progress ?? 0) * 100)}%`, background: '#c9a961' }} />
                </div>
              </div>
            ) : readiness?.evidence ? (
              <div style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
                {(Object.keys(LABELS) as (keyof Evidence)[]).map(key => {
                  const state = readiness.evidence![key]
                  return (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 10, color: state === 'ready' ? '#9cc9a9' : state === 'blocked' ? '#e2a0a0' : '#b7a97e' }}>
                      <span>{LABELS[key]}</span>
                      <span>{stateGlyph(state)} {state}</span>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {!activeMission && readiness?.crew?.boarded && (
              <div style={{ marginBottom: 8, fontSize: 9, color: '#7fa98b' }}>
                Crew: du bist als {readiness.crew.role ?? 'Crew'} an Bord.
              </div>
            )}

            {!activeMission && readiness?.cargo && (
              <div style={{ marginBottom: 8, fontSize: 9, lineHeight: 1.4, color: readiness.cargo.empty ? '#7fa98b' : '#b7a97e' }}>
                Cargo: {readiness.cargo.rationale}
                {!readiness.cargo.empty && readiness.cargo.unresolvedResources.length > 0
                  ? ` Betroffen: ${readiness.cargo.unresolvedResources.join(', ')}.`
                  : ''}
              </div>
            )}

            {message && <div style={{ marginBottom: 9, fontSize: 10, lineHeight: 1.45, color: '#e0b2a7' }}>{message}</div>}

            {readiness?.engineeringRequest && !activeMission && (
              <div style={{ marginBottom: 9, fontSize: 9, lineHeight: 1.4, color: '#6f8795' }}>
                Authority: {readiness.engineeringRequest}
              </div>
            )}

            {!activeMission && needsCrew && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void boardSelf()}
                style={{ width: '100%', marginBottom: 7, border: '1px solid #315b70', background: 'rgba(49,91,112,.18)', color: '#a9d3df', borderRadius: 6, padding: '7px 8px', cursor: loading ? 'default' : 'pointer', fontSize: 10 }}
              >
                ALS COMMANDER / PILOT AN BORD
              </button>
            )}

            <div style={{ display: 'flex', gap: 7 }}>
              <button
                type="button"
                disabled={loading}
                onClick={() => void refresh()}
                style={{ flex: 1, border: '1px solid #29465d', background: '#0c1b28', color: '#8facbd', borderRadius: 6, padding: '7px 8px', cursor: loading ? 'default' : 'pointer', fontSize: 10 }}
              >
                {loading ? 'PRÜFE …' : 'STATUS'}
              </button>
              {activeMission ? (
                <button
                  type="button"
                  disabled={loading || !canAdvance}
                  onClick={() => void advance()}
                  style={{ flex: 1.3, border: '1px solid rgba(201,169,97,.6)', background: canAdvance ? 'rgba(201,169,97,.15)' : 'rgba(60,60,60,.18)', color: canAdvance ? '#e6d3a0' : '#66717a', borderRadius: 6, padding: '7px 8px', cursor: canAdvance ? 'pointer' : 'default', fontSize: 10 }}
                >
                  NÄCHSTE FLUGPHASE
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loading || !ready}
                  onClick={() => void authorize()}
                  title={!ready ? 'Start bleibt gesperrt, solange autoritative Gates ungeklärt sind.' : undefined}
                  style={{ flex: 1.3, border: '1px solid rgba(201,169,97,.6)', background: ready ? 'rgba(201,169,97,.15)' : 'rgba(60,60,60,.18)', color: ready ? '#e6d3a0' : '#66717a', borderRadius: 6, padding: '7px 8px', cursor: ready ? 'pointer' : 'default', fontSize: 10 }}
                >
                  STARTFREIGABE
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
