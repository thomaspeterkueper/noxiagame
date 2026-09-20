'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { getBuildingVisual } from '@/lib/game/buildings/visuals'
import { SHACKLETON_SURFACE_LOGISTICS_CHAIN } from '@/lib/game/moonSurfaceLogistics'
import { deriveSurfaceMissionProgress } from '@/lib/game/vehicles/surfaceProgress'
import {
  parseSurfaceRouteGeometry,
  pointAlongSurfaceRoute,
  type SurfaceRouteGeometry,
  type SurfaceRoutePoint,
} from '@/lib/game/vehicles/surfaceRouteGeometry'

type BuildRequirements = {
  knowledgeOk: boolean
  creditsOk: boolean
  canBuild: boolean
  requiredUnlock?: string | null
  requiredLabel?: string | null
  learningUrl?: string | null
}

type BuildingDef = {
  id: string
  name: string
  cost: number
  buildTimeTicks: number
  footprint: { widthM: number; depthM: number; clearanceM: number }
  requirements?: BuildRequirements
}

type SpatialEntity = {
  id: string
  entity_id?: string | null
  name?: string | null
  x_m?: number | null
  y_m?: number | null
  rotation_deg?: number | null
  footprint_width_m?: number | null
  footprint_depth_m?: number | null
  status?: string | null
  ownerLabel?: string | null
  isOwn?: boolean
}

type PendingBuild = {
  id: string
  buildable_id?: string | null
  name?: string | null
  x_m?: number | null
  y_m?: number | null
  rotation_deg?: number | null
  footprint_width_m?: number | null
  footprint_depth_m?: number | null
  status?: string | null
}

type SpatialPayload = {
  location?: { id: string; slug: string; name: string }
  profile?: { id?: string; credits?: number }
  frame?: { origin_status?: string | null; terrain_dataset_id?: string | null } | null
  terrain?: {
    activeDataset?: { id?: string; dataset_name?: string; status?: string } | null
    resolution?: { status?: string; zM?: number | null }
    elevationGrid?: { stepM: number; size: number; values: (number | null)[] } | null
  }
  entities?: SpatialEntity[]
  builds?: PendingBuild[]
  available?: BuildingDef[]
  error?: string
}

type Inventory = {
  id: string
  inventory_kind: string
  subject_type: string
  subject_id: string | null
  label: string
  metadata?: Record<string, unknown> | null
}

type TransportJob = {
  id: string
  domain: string
  source_inventory_id: string
  destination_inventory_id: string
  vehicle_inventory_id: string | null
  vehicle_role: string | null
  resource: string
  amount: number
  status: string
  route_snapshot?: Record<string, unknown> | null
  started_at?: string | null
  arrives_at?: string | null
}

type LogisticsPayload = {
  inventories?: Inventory[]
  jobs?: TransportJob[]
  error?: string
}

type MapNode = { inventory: Inventory; point: SurfaceRoutePoint }
type MapRoute = {
  job: TransportJob
  geometry: SurfaceRouteGeometry
  vehiclePoint: SurfaceRoutePoint
  progress01: number
}
type SelectedSpot = { xM: number; yM: number }
type Pan = { x: number; y: number }

const ACTIVE = new Set(['reserved', 'loading', 'in_transit', 'arrived', 'unloading'])
const VIEW_W = 1000
const VIEW_H = 620
const PAD = 54
const MIN_ZOOM = 0.7
const MAX_ZOOM = 8

function finite(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function inventoryPoint(inventory: Inventory, entities: SpatialEntity[]): SurfaceRoutePoint | null {
  const metadata = inventory.metadata ?? {}
  const metaX = finite(metadata.xM ?? metadata.x_m)
  const metaY = finite(metadata.yM ?? metadata.y_m)
  if (metaX != null && metaY != null) return { xM: metaX, yM: metaY }
  if (!inventory.subject_id) return null
  const entity = entities.find(item => item.id === inventory.subject_id || item.entity_id === inventory.subject_id)
  const xM = finite(entity?.x_m)
  const yM = finite(entity?.y_m)
  return xM != null && yM != null ? { xM, yM } : null
}

function formatStatus(status: string) {
  return status.replaceAll('_', ' ')
}

function formatRemaining(seconds: number | null) {
  if (seconds == null) return '–'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

export default function ShackletonSurfaceMap() {
  const [spatial, setSpatial] = useState<SpatialPayload | null>(null)
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [jobs, setJobs] = useState<TransportJob[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 })
  const [selectedSpot, setSelectedSpot] = useState<SelectedSpot | null>(null)
  const [selectedBuildId, setSelectedBuildId] = useState<string>('')
  const [rotationDeg, setRotationDeg] = useState(0)
  const [placing, setPlacing] = useState(false)
  const [buildMessage, setBuildMessage] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; pan: Pan; moved: boolean } | null>(null)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const headers = { Authorization: `Bearer ${token}` }
      const spatialResponse = await fetch('/api/game/build/spatial?location=moon', { headers, cache: 'no-store' })
      const spatialPayload = await spatialResponse.json() as SpatialPayload
      if (!spatialResponse.ok || !spatialPayload.location?.id) {
        throw new Error(spatialPayload.error ?? 'Moon-Standort nicht verfügbar')
      }
      const logisticsResponse = await fetch(`/api/game/logistics?locationId=${encodeURIComponent(spatialPayload.location.id)}`, {
        headers,
        cache: 'no-store',
      })
      const logisticsPayload = await logisticsResponse.json() as LogisticsPayload
      if (!logisticsResponse.ok) throw new Error(logisticsPayload.error ?? 'Moon-Logistik nicht verfügbar')
      setSpatial(spatialPayload)
      setInventories(logisticsPayload.inventories ?? [])
      setJobs(logisticsPayload.jobs ?? [])
      setMessage(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 15_000)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const entities = spatial?.entities ?? []
  const pendingBuilds = spatial?.builds ?? []
  const available = spatial?.available ?? []
  const nodes = useMemo<MapNode[]>(() => inventories
    .filter(inventory => inventory.inventory_kind !== 'vehicle')
    .flatMap(inventory => {
      const point = inventoryPoint(inventory, entities)
      return point ? [{ inventory, point }] : []
    }), [inventories, entities])

  const activeJobs = useMemo(() => jobs.filter(job => job.domain === 'surface' && ACTIVE.has(job.status)), [jobs])
  const routes = useMemo<MapRoute[]>(() => activeJobs.flatMap(job => {
    const geometry = parseSurfaceRouteGeometry(job.route_snapshot)
    if (!geometry) return []
    const progress = deriveSurfaceMissionProgress(job, now)
    return [{ job, geometry, progress01: progress.progress01, vehiclePoint: pointAlongSurfaceRoute(geometry, progress.progress01) }]
  }), [activeJobs, now])

  const allPoints = useMemo<SurfaceRoutePoint[]>(() => [
    ...nodes.map(node => node.point),
    ...routes.flatMap(route => route.geometry.points),
    ...entities.flatMap(row => {
      const xM = finite(row.x_m), yM = finite(row.y_m)
      return xM != null && yM != null ? [{ xM, yM }] : []
    }),
    ...pendingBuilds.flatMap(row => {
      const xM = finite(row.x_m), yM = finite(row.y_m)
      return xM != null && yM != null ? [{ xM, yM }] : []
    }),
  ], [nodes, routes, entities, pendingBuilds])

  const bounds = useMemo(() => {
    if (!allPoints.length) return { minX: -1000, minY: -1000, spanX: 2000, spanY: 2000 }
    const xs = allPoints.map(point => point.xM)
    const ys = allPoints.map(point => point.yM)
    const rawMinX = Math.min(...xs), rawMaxX = Math.max(...xs)
    const rawMinY = Math.min(...ys), rawMaxY = Math.max(...ys)
    const rawSpanX = Math.max(rawMaxX - rawMinX, 500)
    const rawSpanY = Math.max(rawMaxY - rawMinY, 500)
    const marginX = Math.max(250, rawSpanX * 0.35)
    const marginY = Math.max(250, rawSpanY * 0.35)
    return {
      minX: rawMinX - marginX,
      minY: rawMinY - marginY,
      spanX: rawSpanX + marginX * 2,
      spanY: rawSpanY + marginY * 2,
    }
  }, [allPoints])

  const project = useCallback((point: SurfaceRoutePoint) => ({
    x: PAD + ((point.xM - bounds.minX) / bounds.spanX) * (VIEW_W - PAD * 2),
    y: VIEW_H - PAD - ((point.yM - bounds.minY) / bounds.spanY) * (VIEW_H - PAD * 2),
  }), [bounds])

  const unproject = useCallback((x: number, y: number): SelectedSpot => ({
    xM: bounds.minX + ((x - PAD) / (VIEW_W - PAD * 2)) * bounds.spanX,
    yM: bounds.minY + ((VIEW_H - PAD - y) / (VIEW_H - PAD * 2)) * bounds.spanY,
  }), [bounds])

  const clientToBase = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const sx = (clientX - rect.left) / rect.width * VIEW_W
    const sy = (clientY - rect.top) / rect.height * VIEW_H
    return { x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom }
  }, [pan, zoom])

  function zoomAt(nextZoom: number, clientX?: number, clientY?: number) {
    const next = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
    const svg = svgRef.current
    if (!svg || clientX == null || clientY == null) {
      setZoom(next)
      return
    }
    const rect = svg.getBoundingClientRect()
    const mouseX = (clientX - rect.left) / rect.width * VIEW_W
    const mouseY = (clientY - rect.top) / rect.height * VIEW_H
    const ratio = next / zoom
    setPan(current => ({
      x: mouseX - (mouseX - current.x) * ratio,
      y: mouseY - (mouseY - current.y) * ratio,
    }))
    setZoom(next)
  }

  function resetView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  function onWheel(event: React.WheelEvent<SVGSVGElement>) {
    event.preventDefault()
    zoomAt(zoom * (event.deltaY < 0 ? 1.16 : 0.86), event.clientX, event.clientY)
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, pan, moved: false }
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const rect = event.currentTarget.getBoundingClientRect()
    const dx = (event.clientX - drag.clientX) / rect.width * VIEW_W
    const dy = (event.clientY - drag.clientY) / rect.height * VIEW_H
    if (Math.hypot(dx, dy) > 3) drag.moved = true
    setPan({ x: drag.pan.x + dx, y: drag.pan.y + dy })
  }

  function onPointerUp(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.pointerId !== event.pointerId) return
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch {}
    if (drag.moved) return
    const base = clientToBase(event.clientX, event.clientY)
    if (!base) return
    const spot = unproject(base.x, base.y)
    setSelectedSpot({ xM: Math.round(spot.xM), yM: Math.round(spot.yM) })
    setBuildMessage(null)
  }

  async function placeBuilding() {
    if (!selectedSpot || !selectedBuildId || placing) return
    setPlacing(true)
    setBuildMessage(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const response = await fetch('/api/game/build/spatial', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildableId: selectedBuildId,
          location: 'moon',
          xM: selectedSpot.xM,
          yM: selectedSpot.yM,
          rotationDeg,
        }),
      })
      const result = await response.json() as { error?: string; newCredits?: number }
      if (!response.ok) throw new Error(result.error ?? 'Bauauftrag konnte nicht angelegt werden')
      setBuildMessage(`Bauauftrag angelegt · ${selectedSpot.xM.toLocaleString('de-DE')} m E · ${selectedSpot.yM.toLocaleString('de-DE')} m N`)
      setSelectedSpot(null)
      setSelectedBuildId('')
      setRotationDeg(0)
      await load()
    } catch (error) {
      setBuildMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setPlacing(false)
    }
  }

  const selectedDef = available.find(def => def.id === selectedBuildId) ?? null
  const inventoryById = useMemo(() => new Map(inventories.map(item => [item.id, item])), [inventories])
  const pxPerMeterX = (VIEW_W - PAD * 2) / bounds.spanX
  const pxPerMeterY = (VIEW_H - PAD * 2) / bounds.spanY

  return <main className="moon-shell">
    <header className="hero">
      <div>
        <small>MOON · SHACKLETON · SURFACE OPERATIONS</small>
        <h1>Shackleton</h1>
        <p>Lokale ENU-Spieloberfläche für Bau, Infrastruktur und persistierte Surface-Transporte.</p>
      </div>
      <div className="terrain-state">
        <span>Terrain / Frame</span>
        <b>{spatial?.terrain?.activeDataset?.status ?? spatial?.frame?.origin_status ?? 'unresolved'}</b>
        <small>{spatial?.terrain?.activeDataset?.dataset_name ?? spatial?.frame?.terrain_dataset_id ?? 'LOLA-Datensatz noch nicht aufgelöst'}</small>
      </div>
    </header>

    {message && <div className="notice">{message}</div>}

    <section className="map-card">
      <div className="map-head">
        <div><small>LOKALES ENU-FRAME</small><h2>Spielbare Mondoberfläche</h2></div>
        <div className="map-actions">
          <span>{entities.length} Gebäude</span><span>{pendingBuilds.length} im Bau</span>
          <button type="button" onClick={() => zoomAt(zoom * 1.25)}>+</button>
          <b>{Math.round(zoom * 100)}%</b>
          <button type="button" onClick={() => zoomAt(zoom / 1.25)}>−</button>
          <button type="button" onClick={resetView}>Zentrieren</button>
        </div>
      </div>

      <div className="map-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="application"
          aria-label="Spielbare Shackleton-Mondkarte"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { dragRef.current = null }}
        >
          <defs>
            <pattern id="moon-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d8e1e5" strokeWidth="0.7" opacity="0.28" />
            </pattern>
            <filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <rect width={VIEW_W} height={VIEW_H} fill="rgba(18,24,28,.28)" rx="16" />
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            <rect width={VIEW_W} height={VIEW_H} fill="url(#moon-grid)" rx="16" />

            {(() => {
              const grid = spatial?.terrain?.elevationGrid
              if (!grid || !grid.values.length) return null
              const finite = grid.values.filter((v): v is number => v != null && Number.isFinite(v))
              if (!finite.length) return null
              const minZ = Math.min(...finite)
              const maxZ = Math.max(...finite)
              const span = Math.max(1e-6, maxZ - minZ)
              const half = Math.floor(grid.size / 2)
              const cellW = grid.stepM * pxPerMeterX
              const cellH = grid.stepM * pxPerMeterY
              // Einfache Hoehen-zu-Farbe-Rampe (dunkel = tief, hell = hoch) --
              // kein echtes Hillshading (Sonnenwinkel/Schlagschatten), aber
              // macht das reale NASA-Relief zum ersten Mal tatsaechlich
              // sichtbar statt nur im Status-Badge zu stehen.
              return <g opacity={0.85} pointerEvents="none">
                {grid.values.map((v, i) => {
                  if (v == null || !Number.isFinite(v)) return null
                  const row = Math.floor(i / grid.size) - half
                  const col = (i % grid.size) - half
                  const center = project({ xM: col * grid.stepM, yM: -row * grid.stepM })
                  const t = (v - minZ) / span
                  const lightness = 14 + t * 46 // 14%..60%
                  return <rect
                    key={`elev-${i}`}
                    x={center.x - cellW / 2}
                    y={center.y - cellH / 2}
                    width={cellW + 0.5}
                    height={cellH + 0.5}
                    fill={`hsl(205 22% ${lightness}%)`}
                  />
                })}
              </g>
            })()}

            {routes.map(route => {
              const points = route.geometry.points.map(point => {
                const p = project(point)
                return `${p.x},${p.y}`
              }).join(' ')
              const vehicle = project(route.vehiclePoint)
              return <g key={route.job.id}>
                <polyline points={points} fill="none" stroke="#c8a75a" strokeWidth={5 / zoom} strokeLinejoin="round" strokeLinecap="round" opacity="0.88" />
                <circle cx={vehicle.x} cy={vehicle.y} r={9 / zoom} fill="#f2c65d" stroke="#fff0bd" strokeWidth={2 / zoom} filter="url(#glow)" />
              </g>
            })}

            {entities.map(entity => {
              const xM = finite(entity.x_m), yM = finite(entity.y_m)
              if (xM == null || yM == null) return null
              const p = project({ xM, yM })
              const width = Math.max(8 / zoom, Number(entity.footprint_width_m ?? 20) * pxPerMeterX)
              const depth = Math.max(8 / zoom, Number(entity.footprint_depth_m ?? 20) * pxPerMeterY)
              // BUGFIX 16.09.2026: bisher generisches eingefaerbtes Rechteck
              // fuer JEDEN Gebaeudetyp -- dazu Namen IMMER eingeblendet, was
              // bei eng stehenden Gebaeuden zu unlesbar ueberlappendem Text
              // fuehrte. Jetzt: echtes Icon wie bei Earth (getBuildingVisual),
              // Name als Hover-Tooltip immer verfuegbar, als Text-Label nur
              // ab genuegend Zoom sichtbar.
              const visual = getBuildingVisual(entity.entity_id ?? '', 'moon')
              const spriteScale = visual?.mapScale ?? 1.7
              const spriteW = Math.max(width * spriteScale, 22 / zoom)
              const spriteH = Math.max(Math.max(depth, width * .72) * spriteScale, 18 / zoom)
              return <g key={entity.id} transform={`translate(${p.x} ${p.y}) rotate(${-Number(entity.rotation_deg ?? 0)})`}>
                <title>{entity.name ?? entity.entity_id}{entity.ownerLabel ? ` · ${entity.ownerLabel}` : ''}</title>
                {visual?.mapAsset
                  ? <image href={visual.mapAsset} x={-spriteW / 2} y={-spriteH * .72} width={spriteW} height={spriteH} preserveAspectRatio="xMidYMid meet" opacity={.97} pointerEvents="none" />
                  : <rect x={-width / 2} y={-depth / 2} width={width} height={depth} rx={2 / zoom} fill={entity.isOwn ? '#d0ad55' : '#7896a8'} stroke="#f1f5f7" strokeWidth={1.3 / zoom} opacity="0.94" />}
                {zoom >= 3 && <>
                  <text x={width / 2 + 6 / zoom} y={-3 / zoom} fill="#f0f4f6" fontSize={11 / zoom} fontWeight="700">{entity.name ?? entity.entity_id}</text>
                  <text x={width / 2 + 6 / zoom} y={10 / zoom} fill="#a6b6be" fontSize={8 / zoom}>{entity.ownerLabel ?? 'Gebäude'}</text>
                </>}
              </g>
            })}

            {pendingBuilds.map(build => {
              const xM = finite(build.x_m), yM = finite(build.y_m)
              if (xM == null || yM == null) return null
              const p = project({ xM, yM })
              const width = Math.max(9 / zoom, Number(build.footprint_width_m ?? 20) * pxPerMeterX)
              const depth = Math.max(9 / zoom, Number(build.footprint_depth_m ?? 20) * pxPerMeterY)
              return <g key={build.id} transform={`translate(${p.x} ${p.y}) rotate(${-Number(build.rotation_deg ?? 0)})`}>
                <rect x={-width / 2} y={-depth / 2} width={width} height={depth} fill="rgba(214,155,55,.28)" stroke="#e7b34c" strokeWidth={1.6 / zoom} strokeDasharray={`${6 / zoom} ${4 / zoom}`} />
                <text x={width / 2 + 6 / zoom} y={3 / zoom} fill="#f1c86f" fontSize={9 / zoom} fontWeight="700">{build.name ?? build.buildable_id} · im Bau</text>
              </g>
            })}

            {nodes.map(node => {
              const p = project(node.point)
              return <g key={node.inventory.id}>
                <circle cx={p.x} cy={p.y} r={6 / zoom} fill="#9fb2bd" stroke="#e5edf1" strokeWidth={1.2 / zoom} />
                <text x={p.x + 10 / zoom} y={p.y - 7 / zoom} fill="#e5edf1" fontSize={9 / zoom} fontWeight="700">{node.inventory.label}</text>
              </g>
            })}

            {selectedSpot && (() => {
              const p = project(selectedSpot)
              const previewW = selectedDef ? Math.max(12 / zoom, selectedDef.footprint.widthM * pxPerMeterX) : 18 / zoom
              const previewD = selectedDef ? Math.max(12 / zoom, selectedDef.footprint.depthM * pxPerMeterY) : 18 / zoom
              return <g transform={`translate(${p.x} ${p.y}) rotate(${-rotationDeg})`}>
                <circle r={14 / zoom} fill="none" stroke="#7de3ff" strokeWidth={2 / zoom} />
                {selectedDef && <rect x={-previewW / 2} y={-previewD / 2} width={previewW} height={previewD} fill="rgba(78,203,113,.22)" stroke="#7de3ff" strokeWidth={1.5 / zoom} strokeDasharray={`${5 / zoom} ${3 / zoom}`} />}
              </g>
            })()}
          </g>
        </svg>
        <div className="map-hint">Mausrad: Zoom · Ziehen: Karte verschieben · Klick: Bauplatz wählen</div>
      </div>

      <div className="build-dock">
        <div className="build-location">
          <small>BAUPLATZ</small>
          {selectedSpot
            ? <strong>{selectedSpot.xM.toLocaleString('de-DE')} m E · {selectedSpot.yM.toLocaleString('de-DE')} m N</strong>
            : <strong>Auf freie Mondfläche klicken</strong>}
          <span>Credits: {Number(spatial?.profile?.credits ?? 0).toLocaleString('de-DE')} Cr</span>
        </div>
        <label>
          <small>BAUTYP</small>
          <select value={selectedBuildId} onChange={event => setSelectedBuildId(event.target.value)} disabled={!selectedSpot}>
            <option value="">Gebäude wählen …</option>
            {available.map(def => <option key={def.id} value={def.id} disabled={!def.requirements?.canBuild}>
              {def.name} · {def.cost.toLocaleString('de-DE')} Cr{def.requirements?.canBuild ? '' : ` · ${def.requirements?.requiredLabel ?? (!def.requirements?.creditsOk ? 'zu wenig Credits' : 'gesperrt')}`}
            </option>)}
          </select>
        </label>
        <label className="rotation">
          <small>ROTATION</small>
          <div><button type="button" onClick={() => setRotationDeg(value => (value + 345) % 360)}>−15°</button><b>{rotationDeg}°</b><button type="button" onClick={() => setRotationDeg(value => (value + 15) % 360)}>+15°</button></div>
        </label>
        <button className="build-button" type="button" disabled={!selectedSpot || !selectedDef?.requirements?.canBuild || placing} onClick={placeBuilding}>
          {placing ? 'Bauauftrag …' : 'Bauen'}
        </button>
      </div>
      {buildMessage && <div className={buildMessage.startsWith('Bauauftrag') ? 'build-message ok' : 'build-message'}>{buildMessage}</div>}
    </section>

    <section className="jobs-card">
      <div className="section-title"><small>CORE STATE MACHINE</small><h2>Aktive Transporte</h2></div>
      {!activeJobs.length && <div className="empty">Noch kein aktiver Moon-Surface-Transport.</div>}
      <div className="job-grid">{activeJobs.map(job => {
        const progress = deriveSurfaceMissionProgress(job, now)
        const source = inventoryById.get(job.source_inventory_id)?.label ?? job.source_inventory_id.slice(0, 8)
        const destination = inventoryById.get(job.destination_inventory_id)?.label ?? job.destination_inventory_id.slice(0, 8)
        const percent = Math.round(progress.progress01 * 100)
        return <article className={`job ${progress.phase}`} key={job.id}>
          <div className="job-head"><strong>{job.vehicle_role ?? 'Surface-Fahrzeug'}</strong><span>{formatStatus(job.status)}</span></div>
          <div className="cargo">{job.amount} {job.resource}</div>
          <div className="endpoints"><span>{source}</span><b>→</b><span>{destination}</span></div>
          <div className="rail"><div style={{ width: `${percent}%` }} /></div>
          <div className="facts"><span><b>{percent}%</b> Fahrt</span><span><b>{progress.travelledKm == null ? '–' : progress.travelledKm.toFixed(2)} km</b> gefahren</span><span><b>{formatRemaining(progress.remainingSeconds)}</b> verbleibend</span></div>
        </article>
      })}</div>
    </section>

    <section className="chain-card">
      <div className="section-title"><small>KANONISCHE KETTE</small><h2>Shackleton-Warenfluss</h2></div>
      <div className="chain">{SHACKLETON_SURFACE_LOGISTICS_CHAIN.map((node, index) => <div className="chain-node" key={node.role}>
        <span>{index + 1}</span><div><strong>{node.label}</strong><small>{node.purpose}</small></div>
      </div>)}</div>
    </section>

    <style jsx>{`
      .moon-shell{min-height:100vh;background:transparent;color:#e8edf0;padding:28px;font-family:system-ui,sans-serif}.hero,.map-card,.jobs-card,.chain-card{max-width:1400px;margin:0 auto 18px}.hero{display:flex;justify-content:space-between;gap:24px;align-items:end}.hero small,.section-title small,.map-head small,.build-dock small{font-size:10px;letter-spacing:.16em;color:#c8a75a;font-weight:800}.hero h1{font-family:Georgia,serif;font-size:44px;font-weight:400;margin:3px 0}.hero p{max-width:760px;margin:0;color:#a5b1b8;font-size:13px}.terrain-state{min-width:250px;background:rgba(16,25,32,.88);border:1px solid #293943;border-radius:12px;padding:12px}.terrain-state span,.terrain-state small{display:block;color:#82929c;font-size:10px}.terrain-state b{display:block;color:#dfe7eb;margin:4px 0}.map-card,.jobs-card,.chain-card{background:rgba(10,19,25,.88);border:1px solid #354650;border-radius:16px;padding:16px}.map-head,.section-title{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:12px}.map-head h2,.section-title h2{font-family:Georgia,serif;font-weight:400;margin:2px 0 0;font-size:24px}.map-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}.map-actions span,.map-actions b{font-size:10px;padding:5px 8px;background:#15232b;border-radius:999px;color:#a7b4ba}.map-actions button,.rotation button{border:1px solid #405a67;background:#13232c;color:#dbe6eb;border-radius:7px;padding:5px 9px;cursor:pointer;font-weight:800}.map-wrap{position:relative}.map-card svg{width:100%;height:min(64vh,720px);display:block;border:1px solid #4a5960;border-radius:16px;touch-action:none;cursor:grab;user-select:none}.map-card svg:active{cursor:grabbing}.map-hint{position:absolute;left:12px;bottom:10px;padding:6px 8px;border-radius:7px;background:rgba(5,11,15,.76);color:#bac7cd;font:10px ui-monospace,monospace;pointer-events:none}.build-dock{display:grid;grid-template-columns:minmax(210px,.9fr) minmax(260px,1.6fr) auto auto;gap:12px;align-items:end;margin-top:12px;padding:12px;border:1px solid #344852;border-radius:12px;background:rgba(8,17,23,.88)}.build-location,.build-dock label{display:flex;flex-direction:column;gap:5px}.build-location strong{font-size:13px}.build-location span{font-size:10px;color:#91a0a8}.build-dock select{width:100%;background:#101c23;color:#e9f0f3;border:1px solid #40535d;border-radius:8px;padding:9px}.rotation div{display:flex;gap:6px;align-items:center}.rotation b{min-width:44px;text-align:center;font-size:11px}.build-button{height:38px;border:1px solid #b9984f;background:#c8a75a;color:#101820;border-radius:8px;padding:0 20px;font-weight:900;cursor:pointer}.build-button:disabled{opacity:.42;cursor:not-allowed}.build-message,.notice,.empty{margin-top:10px;padding:10px 12px;background:#2b1718;border:1px solid #704044;border-radius:8px;color:#f0b4b7;font-size:12px}.build-message.ok{background:#10271c;border-color:#346947;color:#9ee0b5}.job-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}.job{background:#111d24;border:1px solid #2d404a;border-radius:11px;padding:12px}.job-head,.endpoints,.facts{display:flex;justify-content:space-between;gap:10px}.job-head span{font-size:10px;color:#c8a75a}.cargo{font-size:22px;font-family:Georgia,serif;margin:9px 0}.endpoints,.facts{font-size:10px;color:#91a1aa}.rail{height:5px;background:#24343d;border-radius:99px;margin:10px 0;overflow:hidden}.rail div{height:100%;background:#c8a75a}.chain{display:flex;gap:8px;flex-wrap:wrap}.chain-node{display:flex;gap:8px;align-items:center;padding:8px 10px;background:#111d24;border:1px solid #2d404a;border-radius:9px;min-width:180px;flex:1}.chain-node>span{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#c8a75a;color:#101820;font-weight:900}.chain-node strong,.chain-node small{display:block}.chain-node small{color:#81939d;font-size:9px;margin-top:2px}@media(max-width:900px){.moon-shell{padding:14px}.hero{align-items:stretch;flex-direction:column}.terrain-state{min-width:0}.build-dock{grid-template-columns:1fr}.map-card svg{height:58vh}}
    `}</style>
  </main>
}
