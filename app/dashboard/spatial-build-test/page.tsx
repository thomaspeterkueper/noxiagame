'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
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

type Pan = { x: number; y: number }

type DragState = {
  pointerId: number
  startX: number
  startY: number
  startPanX: number
  startPanY: number
  moved: boolean
}

const BASE_PX_PER_M = 0.12
const MIN_ZOOM = 0.25
const MAX_ZOOM = 8
const DRAG_THRESHOLD_PX = 5

const clampZoom = (value: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))

export default function SpatialBuildTest() {
  const [state, setState] = useState<State | null>(null)
  const [selected, setSelected] = useState<Available | null>(null)
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const [parent, setParent] = useState<Entity | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

      // Keep the tester self-contained: visiting this page also lets the existing
      // canonical lifecycle finalize due root buildings and due expansions.
      await Promise.all([
        fetch('/api/game/build', { headers, cache: 'no-store' }),
        fetch('/api/game/build-expansion', { headers, cache: 'no-store' }),
      ])

      const response = await fetch('/api/game/build/spatial?location=earth', {
        headers,
        cache: 'no-store',
      })
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

  const worldToScreen = useCallback((xM: number, yM: number) => ({
    left: `calc(50% + ${pan.x + xM * BASE_PX_PER_M * zoom}px)`,
    top: `calc(50% + ${pan.y + yM * BASE_PX_PER_M * zoom}px)`,
  }), [pan.x, pan.y, zoom])

  function pointFromPointer(clientX: number, clientY: number, sourcePan = pan) {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return null

    const screenX = clientX - rect.left - rect.width / 2
    const screenY = clientY - rect.top - rect.height / 2

    return {
      x: Math.round((screenX - sourcePan.x) / (BASE_PX_PER_M * zoom)),
      y: Math.round((screenY - sourcePan.y) / (BASE_PX_PER_M * zoom)),
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
      moved: false,
    }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) drag.moved = true

    if (drag.moved) {
      setPan({ x: drag.startPanX + dx, y: drag.startPanY + dy })
    }
  }

  function finishPointer(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    if (!cancelled && !drag.moved) {
      const nextPoint = pointFromPointer(event.clientX, event.clientY, {
        x: drag.startPanX,
        y: drag.startPanY,
      })
      if (nextPoint) {
        setPoint(nextPoint)
        setParent(null)
      }
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
    setDragging(false)
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault()
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return

    const cursorX = event.clientX - rect.left - rect.width / 2
    const cursorY = event.clientY - rect.top - rect.height / 2
    const worldX = (cursorX - pan.x) / (BASE_PX_PER_M * zoom)
    const worldY = (cursorY - pan.y) / (BASE_PX_PER_M * zoom)
    const nextZoom = clampZoom(zoom * Math.exp(-event.deltaY * 0.0015))

    if (nextZoom === zoom) return

    setZoom(nextZoom)
    setPan({
      x: cursorX - worldX * BASE_PX_PER_M * nextZoom,
      y: cursorY - worldY * BASE_PX_PER_M * nextZoom,
    })
  }

  function zoomAtCenter(factor: number) {
    const nextZoom = clampZoom(zoom * factor)
    if (nextZoom === zoom) return
    const ratio = nextZoom / zoom
    setZoom(nextZoom)
    setPan(current => ({ x: current.x * ratio, y: current.y * ratio }))
  }

  function resetView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

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

  const controlButtonStyle = {
    minWidth: 34,
    height: 32,
    border: '1px solid #aab7a3',
    borderRadius: 6,
    background: '#ffffffee',
    color: '#20364a',
    fontWeight: 700,
    cursor: 'pointer',
  } as const

  return (
    <main style={{ minHeight: '100vh', background: '#eef2ea', fontFamily: 'system-ui', padding: 18, color: '#20364a' }}>
      <div style={{ maxWidth: 1380, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, margin: 0 }}>NOXIA · Metrischer Bau-Test</h1>
            <small>{state?.location?.name ?? 'Erde'} · Weltpositionen in Metern · kein globales Kachelraster</small>
          </div>
          <a href="/dashboard">← Dashboard</a>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 14 }}>
          <section style={{ minWidth: 0 }}>
            <div
              ref={viewportRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={event => finishPointer(event)}
              onPointerCancel={event => finishPointer(event, true)}
              onWheel={handleWheel}
              style={{
                position: 'relative',
                width: '100%',
                height: 620,
                overflow: 'hidden',
                background: 'linear-gradient(145deg,#bed1a7,#d8e2c2)',
                border: '1px solid #a9b69c',
                borderRadius: 12,
                cursor: dragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: `calc(50% + ${pan.x}px)`,
                  top: 0,
                  bottom: 0,
                  borderLeft: '1px dashed #65776b66',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${pan.y}px)`,
                  left: 0,
                  right: 0,
                  borderTop: '1px dashed #65776b66',
                  pointerEvents: 'none',
                }}
              />

              {world.map(object => {
                const screen = worldToScreen(object.x_m, object.y_m)
                const width = Math.max(10, Number(object.footprint_width_m ?? 24) * BASE_PX_PER_M * zoom)
                const height = Math.max(10, Number(object.footprint_depth_m ?? 24) * BASE_PX_PER_M * zoom)
                return (
                  <button
                    key={object.id}
                    onPointerDown={event => event.stopPropagation()}
                    onClick={event => {
                      event.stopPropagation()
                      if (!object.pending && object.entity) {
                        setParent(object.entity)
                        setPoint(null)
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: screen.left,
                      top: screen.top,
                      width,
                      height,
                      transform: 'translate(-50%, -50%)',
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
                const screen = worldToScreen(point.x, point.y)
                const width = Math.max(10, (selected?.footprint.widthM ?? 24) * BASE_PX_PER_M * zoom)
                const height = Math.max(10, (selected?.footprint.depthM ?? 24) * BASE_PX_PER_M * zoom)
                return (
                  <div style={{
                    position: 'absolute',
                    left: screen.left,
                    top: screen.top,
                    width,
                    height,
                    transform: 'translate(-50%, -50%)',
                    border: '2px dashed #bf7d00',
                    background: '#f0c04d55',
                    pointerEvents: 'none',
                  }} />
                )
              })()}

              <div
                onPointerDown={event => event.stopPropagation()}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: 6,
                  borderRadius: 8,
                  background: '#eef2eadd',
                  boxShadow: '0 2px 8px #20364a22',
                }}
              >
                <button type="button" onClick={() => zoomAtCenter(1 / 1.25)} style={controlButtonStyle} title="Herauszoomen">−</button>
                <span style={{ minWidth: 58, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>{Math.round(zoom * 100)} %</span>
                <button type="button" onClick={() => zoomAtCenter(1.25)} style={controlButtonStyle} title="Hineinzoomen">+</button>
                <button type="button" onClick={resetView} style={{ ...controlButtonStyle, padding: '0 10px' }} title="Ansicht zentrieren">Reset</button>
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: 12,
                  bottom: 12,
                  padding: '5px 8px',
                  borderRadius: 6,
                  background: '#eef2eadd',
                  fontSize: 11,
                  color: '#435869',
                  pointerEvents: 'none',
                }}
              >
                Ziehen: Karte verschieben · Mausrad: Zoom · Klick: Bauposition
              </div>
            </div>
            <small>
              Klick in die Landschaft = freie Bauposition. Ziehen = Ansicht verschieben. Mausrad = auf Cursorposition zoomen. Gebäude anklicken = Erweiterungen anzeigen.
            </small>
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
              Frame: {state ? (state.frame?.coordinate_system ?? `kein Frame für ${state.location.slug}`) : 'wird geladen …'}<br />
              Seed: {state?.frame?.world_seed ?? '—'}<br />
              Ansicht: {Math.round(zoom * 100)} % · Δ {Math.round(pan.x)} / {Math.round(pan.y)} px
            </small>
          </aside>
        </div>
      </div>
    </main>
  )
}
