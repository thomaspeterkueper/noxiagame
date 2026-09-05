'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { BUILDING_EXPANSIONS } from '@/lib/game/buildingExpansions'

type Available = {
  id: string
  name: string
  cost: number
  buildTimeTicks: number
  footprint: { widthM: number; depthM: number }
}

type Entity = {
  id: string
  entity_id: string
  entity_type: string
  profile_id: string | null
  placement_mode: string | null
  x_m: number | null
  y_m: number | null
  z_m: number | null
  footprint_width_m: number | null
  footprint_depth_m: number | null
  parent_id: string | null
  slot: number | null
}

type Build = {
  id: string
  buildable_id: string
  status: string
  x_m: number | null
  y_m: number | null
  footprint_width_m: number | null
  footprint_depth_m: number | null
  completes_at: string
}

type State = {
  location: { slug: string; name: string }
  frame: { coordinate_system?: string; world_seed?: string } | null
  entities: Entity[]
  builds: Build[]
  available: Available[]
}

type WorldObject = {
  id: string
  entity_id: string
  x_m: number
  y_m: number
  footprint_width_m: number | null
  footprint_depth_m: number | null
  pending: boolean
  entity?: Entity
}

const W = 900
const H = 560
const SCALE = 0.12
const CX = W / 2
const CY = H / 2

const toScreen = (x: number, y: number) => ({ left: CX + x * SCALE, top: CY + y * SCALE })

export default function SpatialBuildTest() {
  const [state, setState] = useState<State | null>(null)
  const [selected, setSelected] = useState<Available | null>(null)
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const [parent, setParent] = useState<Entity | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

      // Keep the tester self-contained: visiting this page also lets the existing
      // canonical lifecycle finalize due root buildings and due expansions.
      await Promise.all([
        fetch('/api/game/build', { headers }),
        fetch('/api/game/build-expansion', { headers }),
      ])

      const response = await fetch('/api/game/build/spatial?location=earth', { headers })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setState(data)
      setSelected(current => current ?? data.available?.[0] ?? null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Laden fehlgeschlagen')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const world = useMemo<WorldObject[]>(() => [
    ...(state?.entities ?? [])
      .filter(entity => entity.parent_id == null && entity.placement_mode === 'world' && entity.x_m != null && entity.y_m != null)
      .map(entity => ({
        id: entity.id,
        entity_id: entity.entity_id,
        x_m: Number(entity.x_m),
        y_m: Number(entity.y_m),
        footprint_width_m: entity.footprint_width_m,
        footprint_depth_m: entity.footprint_depth_m,
        pending: false,
        entity,
      })),
    ...(state?.builds ?? [])
      .filter(build => build.x_m != null && build.y_m != null)
      .map(build => ({
        id: `build:${build.id}`,
        entity_id: build.buildable_id,
        x_m: Number(build.x_m),
        y_m: Number(build.y_m),
        footprint_width_m: build.footprint_width_m,
        footprint_depth_m: build.footprint_depth_m,
        pending: true,
      })),
  ], [state])

  const expansions = useMemo(() => {
    if (!parent) return []
    return Object.values(BUILDING_EXPANSIONS).filter(expansion =>
      !expansion.planned &&
      expansion.cost != null &&
      expansion.buildTimeTicks != null &&
      expansion.parentBuildingIds.includes(parent.entity_id),
    )
  }, [parent])

  const childCount = parent
    ? (state?.entities ?? []).filter(entity => entity.parent_id === parent.id).length
    : 0

  async function buildWorld() {
    if (!selected || !point) return
    setBusy(true)
    setMessage('')
    try {
      const token = await getToken()
      const response = await fetch('/api/game/build/spatial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          buildableId: selected.id,
          location: 'earth',
          xM: point.x,
          yM: point.y,
          rotationDeg: 0,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setMessage(`${selected.name}: Bauauftrag gestartet.`)
      setPoint(null)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bau fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  async function buildExpansion(expansionId: string, expansionName: string) {
    if (!parent) return
    setBusy(true)
    setMessage('')
    try {
      const token = await getToken()
      const params = new URLSearchParams({
        action: 'start',
        expansionId,
        parentEntityId: parent.id,
      })
      const response = await fetch(`/api/game/build-expansion?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setMessage(`${expansionName}: Erweiterungsbau gestartet.`)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erweiterungsbau fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#eef2ea', fontFamily: 'system-ui', padding: 18, color: '#20364a' }}>
      <div style={{ maxWidth: 1220, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, margin: 0 }}>NOXIA · Metrischer Bau-Test</h1>
            <small>{state?.location?.name ?? 'Erde'} · Weltpositionen in Metern · kein globales Kachelraster</small>
          </div>
          <a href="/dashboard">← Dashboard</a>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 14 }}>
          <section style={{ overflowX: 'auto' }}>
            <div
              onClick={event => {
                const rect = event.currentTarget.getBoundingClientRect()
                setPoint({
                  x: Math.round((event.clientX - rect.left - CX) / SCALE),
                  y: Math.round((event.clientY - rect.top - CY) / SCALE),
                })
                setParent(null)
              }}
              style={{
                position: 'relative',
                width: W,
                height: H,
                overflow: 'hidden',
                background: 'linear-gradient(145deg,#bed1a7,#d8e2c2)',
                border: '1px solid #a9b69c',
                borderRadius: 12,
                cursor: 'crosshair',
              }}
            >
              <div style={{ position: 'absolute', left: CX, top: 0, bottom: 0, borderLeft: '1px dashed #65776b66' }} />
              <div style={{ position: 'absolute', top: CY, left: 0, right: 0, borderTop: '1px dashed #65776b66' }} />

              {world.map(object => {
                const screen = toScreen(object.x_m, object.y_m)
                const width = Math.max(14, Number(object.footprint_width_m ?? 24) * SCALE)
                const height = Math.max(14, Number(object.footprint_depth_m ?? 24) * SCALE)
                return (
                  <button
                    key={object.id}
                    onClick={event => {
                      event.stopPropagation()
                      if (!object.pending && object.entity) {
                        setParent(object.entity)
                        setPoint(null)
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: screen.left - width / 2,
                      top: screen.top - height / 2,
                      width,
                      height,
                      border: parent?.id === object.id ? '2px solid #e2a000' : '1px solid #24415e',
                      background: object.pending ? '#e2a00099' : '#567fa9bb',
                      borderRadius: 3,
                      cursor: object.pending ? 'default' : 'pointer',
                    }}
                    title={`${object.entity_id} · ${object.x_m}/${object.y_m} m${object.pending ? ' · im Bau' : ''}`}
                  />
                )
              })}

              {point && (() => {
                const screen = toScreen(point.x, point.y)
                const width = Math.max(14, (selected?.footprint.widthM ?? 24) * SCALE)
                const height = Math.max(14, (selected?.footprint.depthM ?? 24) * SCALE)
                return (
                  <div style={{
                    position: 'absolute',
                    left: screen.left - width / 2,
                    top: screen.top - height / 2,
                    width,
                    height,
                    border: '2px dashed #bf7d00',
                    background: '#f0c04d55',
                  }} />
                )
              })()}
            </div>
            <small>Klick in die Landschaft = freie Bauposition. Gebäude anklicken = kanonische Gebäude-Erweiterungen anzeigen.</small>
          </section>

          <aside style={{ background: '#fff', border: '1px solid #d8ded3', borderRadius: 12, padding: 14, height: 'fit-content' }}>
            <h2 style={{ fontSize: 15, marginTop: 0 }}>Bauen</h2>
            <label style={{ fontSize: 12 }}>Bautyp</label>
            <select
              value={selected?.id ?? ''}
              onChange={event => setSelected(state?.available.find(item => item.id === event.target.value) ?? null)}
              style={{ width: '100%', padding: 8, margin: '4px 0 10px' }}
            >
              {state?.available.map(item => (
                <option key={item.id} value={item.id}>{item.name} · {item.cost.toLocaleString('de-DE')} Cr</option>
              ))}
            </select>

            {selected && (
              <div style={{ fontSize: 12, marginBottom: 10 }}>
                Footprint: {selected.footprint.widthM} × {selected.footprint.depthM} m · Bauzeit {selected.buildTimeTicks} Tick(s)
              </div>
            )}

            {point && (
              <div style={{ padding: 10, background: '#f3f1e7', borderRadius: 8, marginBottom: 10 }}>
                <b>Freie Weltposition</b>
                <div>{point.x} m / {point.y} m</div>
                <button disabled={busy} onClick={() => void buildWorld()} style={{ marginTop: 8, padding: '7px 12px' }}>
                  Bauauftrag starten
                </button>
              </div>
            )}

            {parent && (
              <div style={{ padding: 10, background: '#eef3f8', borderRadius: 8, marginBottom: 10 }}>
                <b>{parent.entity_id.replaceAll('_', ' ')}</b>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Position: {parent.x_m ?? '—'} / {parent.y_m ?? '—'} m · vorhandene Erweiterungen: {childCount}
                </div>
                <p style={{ fontSize: 12 }}>
                  Erweiterungen verwenden die bestehende Gebäude-Hierarchie. Der Slot wird serverseitig vergeben.
                </p>
                {expansions.length === 0 ? (
                  <small>Für diesen Gebäudetyp ist noch keine aktive Erweiterung definiert.</small>
                ) : expansions.map(expansion => (
                  <div key={expansion.id} style={{ borderTop: '1px solid #d7e0e8', paddingTop: 8, marginTop: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{expansion.name}</div>
                    <div style={{ fontSize: 12 }}>
                      {expansion.cost?.toLocaleString('de-DE')} Cr · {expansion.buildTimeTicks} Tick(s)
                    </div>
                    <button
                      disabled={busy}
                      onClick={() => void buildExpansion(expansion.id, expansion.name)}
                      style={{ marginTop: 7, padding: '7px 12px' }}
                    >
                      Erweiterung bauen
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!point && !parent && <p style={{ fontSize: 12, color: '#667' }}>Klicke in die Landschaft oder auf ein metrisch platziertes Gebäude.</p>}
            {message && <div style={{ fontSize: 12, padding: 8, background: '#fff4cf', borderRadius: 6 }}>{message}</div>}

            <hr />
            <small>
              Frame: {state?.frame?.coordinate_system ?? 'Migration noch nicht aktiv'}<br />
              Seed: {state?.frame?.world_seed ?? '—'}
            </small>
          </aside>
        </div>
      </div>
    </main>
  )
}
