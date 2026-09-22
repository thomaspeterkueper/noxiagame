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
  z_m?: number | null
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
  z_m?: number | null
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
    activeDataset?: { id?: string; dataset_name?: string; status?: string; resolution_m?: number | null } | null
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
type LayerKey = 'relief' | 'infrastructure' | 'noxia' | 'routes' | 'logistics'

const ACTIVE = new Set(['reserved', 'loading', 'in_transit', 'arrived', 'unloading'])
const VIEW_W = 1000
const VIEW_H = 1000
const PAD = 54
const MIN_ZOOM = 0.7
const MAX_ZOOM = 8
const defaultLayers: Record<LayerKey, boolean> = {
  relief: true,
  infrastructure: true,
  noxia: true,
  routes: true,
  logistics: true,
}

function finite(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizeRotation(value: number) {
  return ((Math.round(value) % 360) + 360) % 360
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

function worldStatusLabel(status?: string | null) {
  if (status === 'active') return 'In Betrieb'
  if (status === 'built' || status === 'completed') return 'Fertig'
  return status || 'Fertig'
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
  const [selectedWorldObjectId, setSelectedWorldObjectId] = useState<string | null>(null)
  const [rotationDeg, setRotationDeg] = useState(0)
  const [placing, setPlacing] = useState(false)
  const [buildMenuOpen, setBuildMenuOpen] = useState(false)
  const [buildMessage, setBuildMessage] = useState<string | null>(null)
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>(defaultLayers)
  const [layersOpen, setLayersOpen] = useState(false)
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

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (selectedBuildId) {
        setSelectedBuildId('')
        setRotationDeg(0)
        setBuildMessage(null)
        return
      }
      if (buildMenuOpen) {
        setBuildMenuOpen(false)
        return
      }
      if (selectedWorldObjectId) {
        setSelectedWorldObjectId(null)
        return
      }
      setSelectedSpot(null)
      setBuildMessage(null)
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [buildMenuOpen, selectedBuildId, selectedWorldObjectId])

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
    if (!allPoints.length) return { minX: -300, minY: -300, spanX: 600, spanY: 600 }
    const xs = allPoints.map(point => point.xM)
    const ys = allPoints.map(point => point.yM)
    const rawMinX = Math.min(...xs), rawMaxX = Math.max(...xs)
    const rawMinY = Math.min(...ys), rawMaxY = Math.max(...ys)
    const rawSpanX = Math.max(rawMaxX - rawMinX, 600)
    const rawSpanY = Math.max(rawMaxY - rawMinY, 600)
    const marginX = Math.max(120, rawSpanX * 0.22)
    const marginY = Math.max(120, rawSpanY * 0.22)
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
    setSelectedWorldObjectId(null)
    setBuildMenuOpen(false)
    setSelectedBuildId('')
    setRotationDeg(0)
    setBuildMessage(null)
  }

  async function placeBuilding() {
    if (!selectedSpot || !selectedBuildId || placing) return
    setPlacing(true)
    setBuildMessage('Bauauftrag wird geprüft …')
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
      const selected = available.find(def => def.id === selectedBuildId)
      setBuildMessage(`${selected?.name ?? 'Gebäude'}: Bauauftrag bei ${rotationDeg}° angelegt`)
      setBuildMenuOpen(false)
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
  const selectedWorldObject = entities.find(entity => entity.id === selectedWorldObjectId) ?? null
  const selectedCanBuild = selectedDef
    ? (selectedDef.requirements?.canBuild ?? Number(spatial?.profile?.credits ?? 0) >= selectedDef.cost)
    : false
  const inventoryById = useMemo(() => new Map(inventories.map(item => [item.id, item])), [inventories])
  const pxPerMeterX = (VIEW_W - PAD * 2) / bounds.spanX
  const pxPerMeterY = (VIEW_H - PAD * 2) / bounds.spanY
  const visibleWidthM = bounds.spanX / zoom
  const scale = useMemo(() => {
    const targetM = visibleWidthM / 5
    const options = [2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
    const meters = options.reduce((best, value) => Math.abs(value - targetM) < Math.abs(best - targetM) ? value : best, options[0])
    return { meters, pixels: meters / bounds.spanX * (VIEW_W - PAD * 2) * zoom }
  }, [bounds.spanX, visibleWidthM, zoom])

  const selectedTerrain = useMemo(() => {
    if (!selectedSpot) return null
    const grid = spatial?.terrain?.elevationGrid
    if (!grid || !grid.values.length) return null
    const half = Math.floor(grid.size / 2)
    const col = Math.round(selectedSpot.xM / grid.stepM) + half
    const row = Math.round(-selectedSpot.yM / grid.stepM) + half
    if (row < 0 || row >= grid.size || col < 0 || col >= grid.size) return null
    const elevationM = grid.values[row * grid.size + col]
    return elevationM == null || !Number.isFinite(elevationM) ? null : { elevationM, resolutionM: grid.stepM }
  }, [selectedSpot, spatial?.terrain?.elevationGrid])

  function chooseWorldObject(entityId: string) {
    setSelectedWorldObjectId(entityId)
    setSelectedSpot(null)
    setBuildMenuOpen(false)
    setSelectedBuildId('')
    setRotationDeg(0)
    setBuildMessage(null)
  }

  function toggleLayer(key: LayerKey) {
    setLayers(current => ({ ...current, [key]: !current[key] }))
  }

  return <div className="earth-shell">
    <div className="earth-head">
      <div>
        <small>NOXIA MOON · SHACKLETON</small>
        <h1>Mondoberfläche · Shackleton</h1>
        <p>Stelle wählen, Gelände prüfen, Gebäude metrisch ausrichten und bauen. Bedienung und Cockpit entsprechen der Erdoberfläche; nur Landschaft und lunare Datenebenen unterscheiden sich.</p>
      </div>
      <div className="earth-actions">
        <button type="button" onClick={() => toggleLayer('noxia')}>{layers.noxia ? 'Bauten ausblenden' : 'Bauten einblenden'}</button>
        <div className="earth-credits"><b>{Number(spatial?.profile?.credits ?? 0).toLocaleString('de-DE')}</b><span>Credits</span></div>
        <div className="earth-stats"><b>{entities.length}</b><span>NOXIA-Bauten</span></div>
      </div>
    </div>

    {message && <div className="earth-notice">{message}</div>}

    <div className="earth-map">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
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
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e2d8" strokeWidth="0.7" opacity="0.24" />
          </pattern>
          <filter id="moon-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} fill="#767a78" />
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          <rect width={VIEW_W} height={VIEW_H} fill="url(#moon-grid)" />

          {layers.relief && (() => {
            const grid = spatial?.terrain?.elevationGrid
            if (!grid || !grid.values.length) return null
            const values = grid.values.filter((value): value is number => value != null && Number.isFinite(value))
            if (!values.length) return null
            const minZ = Math.min(...values)
            const maxZ = Math.max(...values)
            const span = Math.max(1e-6, maxZ - minZ)
            const half = Math.floor(grid.size / 2)
            const cellW = grid.stepM * pxPerMeterX
            const cellH = grid.stepM * pxPerMeterY
            return <g pointerEvents="none">
              {grid.values.map((value, index) => {
                if (value == null || !Number.isFinite(value)) return null
                const row = Math.floor(index / grid.size) - half
                const col = (index % grid.size) - half
                const center = project({ xM: col * grid.stepM, yM: -row * grid.stepM })
                const t = (value - minZ) / span
                const lightness = 35 + t * 38
                return <rect
                  key={`elev-${index}`}
                  x={center.x - cellW / 2}
                  y={center.y - cellH / 2}
                  width={cellW + 0.8}
                  height={cellH + 0.8}
                  fill={`hsl(45 4% ${lightness}%)`}
                />
              })}
            </g>
          })()}

          {layers.infrastructure && <>
            <line x1={project({ xM: -300, yM: 0 }).x} y1={project({ xM: -300, yM: 0 }).y} x2={project({ xM: 300, yM: 0 }).x} y2={project({ xM: 300, yM: 0 }).y} stroke="#9b927d" strokeWidth={1 / zoom} opacity=".35" />
            <line x1={project({ xM: 0, yM: -300 }).x} y1={project({ xM: 0, yM: -300 }).y} x2={project({ xM: 0, yM: 300 }).x} y2={project({ xM: 0, yM: 300 }).y} stroke="#9b927d" strokeWidth={1 / zoom} opacity=".35" />
          </>}

          {layers.routes && routes.map(route => {
            const points = route.geometry.points.map(point => {
              const p = project(point)
              return `${p.x},${p.y}`
            }).join(' ')
            const vehicle = project(route.vehiclePoint)
            return <g key={route.job.id}>
              <polyline points={points} fill="none" stroke="#826829" strokeWidth={4 / zoom} strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
              <circle cx={vehicle.x} cy={vehicle.y} r={8 / zoom} fill="#d7b44d" stroke="#fff5c9" strokeWidth={2 / zoom} filter="url(#moon-glow)" />
            </g>
          })}

          {layers.noxia && entities.map(entity => {
            const xM = finite(entity.x_m), yM = finite(entity.y_m)
            if (xM == null || yM == null) return null
            const p = project({ xM, yM })
            const width = Math.max(8 / zoom, Number(entity.footprint_width_m ?? 20) * pxPerMeterX)
            const depth = Math.max(8 / zoom, Number(entity.footprint_depth_m ?? 20) * pxPerMeterY)
            const visual = getBuildingVisual(entity.entity_id ?? '', 'moon')
            const spriteScale = visual?.mapScale ?? 1.7
            const spriteW = Math.max(width * spriteScale, 22 / zoom)
            const spriteH = Math.max(Math.max(depth, width * .72) * spriteScale, 18 / zoom)
            const selected = entity.id === selectedWorldObjectId
            return <g
              key={entity.id}
              role="button"
              aria-label={`${entity.name ?? entity.entity_id} auswählen`}
              onPointerDown={event => event.stopPropagation()}
              onClick={event => { event.stopPropagation(); chooseWorldObject(entity.id) }}
              style={{ cursor: 'pointer' }}
              transform={`translate(${p.x} ${p.y}) rotate(${-Number(entity.rotation_deg ?? 0)})`}
            >
              <title>{entity.name ?? entity.entity_id}{entity.ownerLabel ? ` · ${entity.ownerLabel}` : ''}</title>
              <rect x={-Math.max(width, 24 / zoom) / 2} y={-Math.max(depth, 20 / zoom) / 2} width={Math.max(width, 24 / zoom)} height={Math.max(depth, 20 / zoom)} fill="transparent" pointerEvents="all" />
              <ellipse cx={0} cy={depth * .18} rx={Math.max(width * .58, 5 / zoom)} ry={Math.max(depth * .32, 2.4 / zoom)} fill="#232824" opacity=".28" pointerEvents="none" />
              <rect x={-width / 2} y={-depth / 2} width={width} height={depth} rx={1 / zoom} fill="#eaf1df" fillOpacity=".22" stroke={selected ? '#d4ad43' : '#173f49'} strokeWidth={(selected ? 2.8 : 1.5) / zoom} pointerEvents="none" />
              {visual?.mapAsset
                ? <image href={visual.mapAsset} x={-spriteW / 2} y={-spriteH * .72} width={spriteW} height={spriteH} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />
                : <rect x={-width / 2} y={-depth / 2} width={width} height={depth} rx={1 / zoom} fill="#1f5967" pointerEvents="none" />}
              {zoom >= 3 && <text pointerEvents="none" x={0} y={-spriteH * .58 - 5 / zoom} textAnchor="middle" fontSize={9 / zoom} fontWeight="800" fill="#17313c" paintOrder="stroke" stroke="#f5f2e8" strokeWidth={2 / zoom}>{entity.name ?? entity.entity_id}</text>}
            </g>
          })}

          {layers.noxia && pendingBuilds.map(build => {
            const xM = finite(build.x_m), yM = finite(build.y_m)
            if (xM == null || yM == null) return null
            const p = project({ xM, yM })
            const width = Math.max(9 / zoom, Number(build.footprint_width_m ?? 20) * pxPerMeterX)
            const depth = Math.max(9 / zoom, Number(build.footprint_depth_m ?? 20) * pxPerMeterY)
            return <g key={build.id} transform={`translate(${p.x} ${p.y}) rotate(${-Number(build.rotation_deg ?? 0)})`} pointerEvents="none">
              <rect x={-width / 2} y={-depth / 2} width={width} height={depth} fill="#d9a63d" fillOpacity=".38" stroke="#7b5914" strokeWidth={1.5 / zoom} strokeDasharray={`${3 / zoom} ${2 / zoom}`} />
              {zoom >= 3 && <text x={0} y={-depth / 2 - 5 / zoom} textAnchor="middle" fontSize={9 / zoom} fontWeight="800" fill="#4a3a12" paintOrder="stroke" stroke="#f5f2e8" strokeWidth={2 / zoom}>{build.name ?? build.buildable_id} · Bau</text>}
            </g>
          })}

          {layers.logistics && nodes.map(node => {
            const p = project(node.point)
            return <g key={node.inventory.id} pointerEvents="none">
              <circle cx={p.x} cy={p.y} r={5 / zoom} fill="#334d59" stroke="#f4f1e6" strokeWidth={1.2 / zoom} />
              {zoom >= 2.2 && <text x={p.x + 8 / zoom} y={p.y - 6 / zoom} fill="#17313c" paintOrder="stroke" stroke="#f4f1e6" strokeWidth={2 / zoom} fontSize={9 / zoom} fontWeight="800">{node.inventory.label}</text>}
            </g>
          })}

          {selectedSpot && (() => {
            const p = project(selectedSpot)
            const previewW = selectedDef ? Math.max(12 / zoom, selectedDef.footprint.widthM * pxPerMeterX) : 18 / zoom
            const previewD = selectedDef ? Math.max(12 / zoom, selectedDef.footprint.depthM * pxPerMeterY) : 18 / zoom
            const clearanceW = selectedDef ? previewW + selectedDef.footprint.clearanceM * 2 * pxPerMeterX : previewW
            const clearanceD = selectedDef ? previewD + selectedDef.footprint.clearanceM * 2 * pxPerMeterY : previewD
            return <g transform={`translate(${p.x} ${p.y}) rotate(${-rotationDeg})`} pointerEvents="none">
              {selectedDef && <rect x={-clearanceW / 2} y={-clearanceD / 2} width={clearanceW} height={clearanceD} fill="#f5d75f" fillOpacity=".08" stroke="#8a6b21" strokeWidth={1.2 / zoom} strokeDasharray={`${5 / zoom} ${3 / zoom}`} />}
              {selectedDef && <rect x={-previewW / 2} y={-previewD / 2} width={previewW} height={previewD} fill="#f2cc4d" fillOpacity=".28" stroke="#5c4510" strokeWidth={2 / zoom} />}
              {!selectedDef && <><circle r={12 / zoom} fill="#f5d75f" fillOpacity=".22" stroke="#5c4510" strokeWidth={2 / zoom}/><circle r={3 / zoom} fill="#5c4510"/></>}
            </g>
          })()}
        </g>
      </svg>

      <div className="earth-map-tools">
        <div className="earth-compass" aria-label="Karte ist nach Norden ausgerichtet"><span>N</span><b>↑</b></div>
        <div className="earth-scale"><span>{scale.meters >= 1000 ? `${scale.meters / 1000} km` : `${scale.meters} m`}</span><i style={{ width: `${Math.max(26, Math.min(150, scale.pixels))}px` }} /></div>
        <button className="earth-focus" type="button" onClick={resetView}>Shackleton<small>Übersicht</small></button>
      </div>

      <div className="earth-layer-control">
        <button className="earth-layer-trigger" type="button" onClick={() => setLayersOpen(value => !value)}>☷ Layer</button>
        {layersOpen && <div className="earth-layer-menu">
          {([
            ['relief', 'Relief / LOLA'],
            ['infrastructure', 'Infrastruktur'],
            ['noxia', 'NOXIA-Bauten'],
            ['routes', 'Transportrouten'],
            ['logistics', 'Logistikknoten'],
          ] as [LayerKey, string][]).map(([key, label]) => <button key={key} className={layers[key] ? 'active' : ''} type="button" onClick={() => toggleLayer(key)}><span>{layers[key] ? '●' : '○'}</span>{label}</button>)}
          <div className="earth-layer-disabled">○ Bebaubarkeit / Neigung · nächster Terrain-Schritt</div>
          <div className="earth-layer-disabled">○ Geologie / Ressourcen · Daten folgen</div>
        </div>}
      </div>

      {selectedSpot && <div className="earth-site-panel" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
        <div className="earth-site-head"><div><small>AUSGEWÄHLTE STELLE</small><strong>{selectedTerrain ? 'LOLA-Gelände aufgelöst' : 'Geländedaten werden gesucht'}</strong></div><button type="button" onClick={() => { setSelectedSpot(null); setBuildMenuOpen(false); setSelectedBuildId(''); setRotationDeg(0); setBuildMessage(null) }}>×</button></div>
        <div className="earth-analysis-level"><span>Informationsstand</span><b>{spatial?.terrain?.resolution?.status === 'resolved' ? 'Lunare Höhenmessung' : 'Grundbeobachtung'}</b></div>
        <div className="earth-site-facts">
          <div><span>Position</span><b>{selectedSpot.xM.toFixed(0)} m E · {selectedSpot.yM.toFixed(0)} m N</b></div>
          <div><span>Höhe</span><b>{selectedTerrain ? `${selectedTerrain.elevationM.toFixed(1)} m` : '–'}</b></div>
          <div><span>Terrainquelle</span><b>{spatial?.terrain?.activeDataset?.dataset_name ?? spatial?.frame?.terrain_dataset_id ?? 'noch nicht aufgelöst'}</b></div>
          <div><span>Terrainauflösung</span><b>{selectedTerrain ? `≈ ${selectedTerrain.resolutionM} m` : '–'}</b></div>
          <div className="unknown-info"><span>Geologie / Ressourcen</span><b>noch keine validierte Datenebene angebunden</b></div>
        </div>
        {buildMessage && <div className="earth-build-message">{buildMessage}</div>}
        {!buildMenuOpen
          ? <button className="earth-build-open" type="button" onClick={() => { setBuildMenuOpen(true); setSelectedBuildId(''); setBuildMessage(null) }}>Bauen</button>
          : selectedDef
            ? <div className="earth-placement-editor">
                <div className="earth-build-picker-head"><b>{selectedDef.name}</b><button type="button" onClick={() => { setSelectedBuildId(''); setRotationDeg(0); setBuildMessage(null) }}>anderes Gebäude</button></div>
                <div className="earth-placement-summary"><span>{selectedDef.footprint.widthM}×{selectedDef.footprint.depthM} m</span><b>{selectedDef.cost.toLocaleString('de-DE')} Cr</b></div>
                <div className="earth-rotation-head"><span>Ausrichtung</span><b>{rotationDeg}°</b></div>
                <div className="earth-rotation-presets">{[0, 90, 180, 270].map(value => <button key={value} type="button" className={rotationDeg === value ? 'active' : ''} onClick={() => setRotationDeg(value)}>{value}°</button>)}</div>
                <div className="earth-rotation-fine"><button type="button" onClick={() => setRotationDeg(value => normalizeRotation(value - 15))}>−15°</button><input aria-label="Gebäuderotation" type="range" min="0" max="359" step="1" value={rotationDeg} onChange={event => setRotationDeg(normalizeRotation(Number(event.currentTarget.value)))}/><button type="button" onClick={() => setRotationDeg(value => normalizeRotation(value + 15))}>+15°</button></div>
                <small className="earth-preview-note">Gelb: metrischer Footprint · gestrichelt: lokaler Freiraum. Die gespeicherte Rotation wird vom Weltobjekt übernommen.</small>
                <div className="earth-placement-actions"><button type="button" onClick={() => { setSelectedBuildId(''); setRotationDeg(0) }}>Zurück</button><button type="button" className="primary" disabled={placing || !selectedCanBuild} onClick={() => void placeBuilding()}>{placing ? 'Prüfe …' : 'Jetzt bauen'}</button></div>
              </div>
            : <div className="earth-build-picker">
                <div className="earth-build-picker-head"><b>Gebäude wählen</b><button type="button" onClick={() => setBuildMenuOpen(false)}>zurück</button></div>
                <div className="earth-build-options">{available.map(building => {
                  const req = building.requirements
                  const creditsOk = req?.creditsOk ?? Number(spatial?.profile?.credits ?? 0) >= building.cost
                  const knowledgeOk = req?.knowledgeOk ?? true
                  const canBuild = req?.canBuild ?? (creditsOk && knowledgeOk)
                  return <button key={building.id} type="button" className={`earth-build-option ${canBuild ? '' : 'locked'}`} disabled={!canBuild || placing} onClick={() => { setSelectedBuildId(building.id); setRotationDeg(0); setBuildMessage(null) }}><span className="build-name"><strong>{building.name}</strong><em>{building.cost.toLocaleString('de-DE')} Cr</em></span><span className="build-meta">{building.footprint.widthM}×{building.footprint.depthM} m · {building.buildTimeTicks} Tick{building.buildTimeTicks === 1 ? '' : 's'}</span><span className={creditsOk ? 'req-ok' : 'req-no'}>{creditsOk ? '✓' : '×'} Credits</span><span className={knowledgeOk ? 'req-ok' : 'req-no'}>{knowledgeOk ? '✓' : '×'} {req?.requiredLabel ? `Wissen: ${req.requiredLabel}` : 'keine zusätzliche Wissensvoraussetzung'}</span></button>
                })}</div>
              </div>}
        <small className="earth-terrain-note">Die Fundamenthöhe wird aus dem validierten Shackleton-LOLA-Sampler übernommen. Bebaubarkeit und Neigung werden als nächste gemeinsame Planetary-Surface-Ebene ergänzt.</small>
      </div>}

      {selectedWorldObject && <div className="earth-object-panel" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
        <div className="earth-site-head"><div><small>WELTOBJEKT</small><strong>{selectedWorldObject.name ?? selectedWorldObject.entity_id}</strong></div><button type="button" onClick={() => setSelectedWorldObjectId(null)}>×</button></div>
        <div className="earth-object-state"><span>Status</span><b>{worldStatusLabel(selectedWorldObject.status)}</b></div>
        <div className="earth-site-facts">
          <div><span>Eigentum</span><b>{selectedWorldObject.ownerLabel ?? (selectedWorldObject.isOwn ? 'Dein Gebäude' : 'Weltobjekt')}</b></div>
          <div><span>Position</span><b>{Number(selectedWorldObject.x_m ?? 0).toFixed(0)} m E · {Number(selectedWorldObject.y_m ?? 0).toFixed(0)} m N</b></div>
          <div><span>Ausrichtung</span><b>{normalizeRotation(Number(selectedWorldObject.rotation_deg ?? 0))}°</b></div>
          <div><span>Footprint</span><b>{Number(selectedWorldObject.footprint_width_m ?? 20)}×{Number(selectedWorldObject.footprint_depth_m ?? 20)} m</b></div>
          <div><span>Fundamenthöhe</span><b>{selectedWorldObject.z_m == null ? '–' : `${Number(selectedWorldObject.z_m).toFixed(1)} m`}</b></div>
        </div>
        <div className="earth-object-ready">Das Objekt ist Teil desselben persistenten Weltmodells wie auf der Erde. Gebäudefunktionen werden typabhängig angebunden.</div>
      </div>}

      <div className="earth-help">{selectedWorldObject ? 'Weltobjekt gewählt · Details links' : selectedDef ? `${selectedDef.name} · ausrichten · Bau bestätigen` : selectedSpot ? 'Stelle gewählt · Gelände prüfen · Bauen' : 'Stelle anklicken · Mausrad: Zoom · Ziehen: Karte'}</div>
    </div>

    <div className="earth-foot"><span>{spatial?.terrain?.activeDataset?.dataset_name ?? 'LOLA-Terrain'}</span><span>Lokales Shackleton-ENU-Frame · reale Höhenwerte · NOXIA-Weltobjekte</span></div>

    <section className="earth-lower-card">
      <div className="earth-section-title"><small>OBERFLÄCHENLOGISTIK</small><h2>Aktive Transporte</h2></div>
      {!activeJobs.length && <div className="earth-empty">Noch kein aktiver Moon-Surface-Transport.</div>}
      <div className="earth-job-grid">{activeJobs.map(job => {
        const progress = deriveSurfaceMissionProgress(job, now)
        const source = inventoryById.get(job.source_inventory_id)?.label ?? job.source_inventory_id.slice(0, 8)
        const destination = inventoryById.get(job.destination_inventory_id)?.label ?? job.destination_inventory_id.slice(0, 8)
        const percent = Math.round(progress.progress01 * 100)
        return <article className="earth-job" key={job.id}>
          <div className="earth-job-head"><strong>{job.vehicle_role ?? 'Surface-Fahrzeug'}</strong><span>{formatStatus(job.status)}</span></div>
          <div className="earth-cargo">{job.amount} {job.resource}</div>
          <div className="earth-endpoints"><span>{source}</span><b>→</b><span>{destination}</span></div>
          <div className="earth-rail"><div style={{ width: `${percent}%` }} /></div>
          <div className="earth-facts"><span><b>{percent}%</b> Fahrt</span><span><b>{progress.travelledKm == null ? '–' : progress.travelledKm.toFixed(2)} km</b> gefahren</span><span><b>{formatRemaining(progress.remainingSeconds)}</b> verbleibend</span></div>
        </article>
      })}</div>
    </section>

    <section className="earth-lower-card">
      <div className="earth-section-title"><small>KANONISCHE KETTE</small><h2>Shackleton-Warenfluss</h2></div>
      <div className="earth-chain">{SHACKLETON_SURFACE_LOGISTICS_CHAIN.map((node, index) => <div className="earth-chain-node" key={node.role}><span>{index + 1}</span><div><strong>{node.label}</strong><small>{node.purpose}</small></div></div>)}</div>
    </section>

    <style jsx>{`
      .earth-shell{min-height:100%;background:#eef0e8;color:#1f3440;font-family:system-ui,sans-serif;padding:14px;box-sizing:border-box}
      .earth-head{display:flex;justify-content:space-between;gap:20px;align-items:end;max-width:1500px;margin:0 auto 12px}.earth-head small{letter-spacing:.16em;font-weight:800;color:#597284}.earth-head h1{font-family:Georgia,serif;font-weight:400;margin:5px 0 4px;font-size:26px}.earth-head p{margin:0;color:#68777e;font-size:12px;max-width:850px}
      .earth-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.earth-actions button{border:1px solid #a8893d;background:#fffaf0;color:#735918;border-radius:7px;padding:8px 11px;font-weight:750;cursor:pointer}.earth-credits,.earth-stats{text-align:right}.earth-credits b,.earth-stats b{display:block;font-size:22px;color:#b28d33}.earth-credits span,.earth-stats span{font-size:9px;text-transform:uppercase;letter-spacing:.12em}
      .earth-map{position:relative;max-width:1500px;height:calc(100vh - 245px);min-height:560px;margin:auto;border:1px solid #a9b2a5;border-radius:12px;overflow:hidden;background:#777a77;box-shadow:0 16px 45px #41503a24;touch-action:none;cursor:grab}.earth-map:active{cursor:grabbing}.earth-map svg{width:100%;height:100%;display:block}
      .earth-map-tools{position:absolute;left:16px;top:14px;display:flex;align-items:flex-start;gap:12px;color:#17313c;text-shadow:0 1px 2px #fff,0 0 7px #f4f1e6}.earth-compass,.earth-scale{pointer-events:none}.earth-compass{width:30px;height:38px;display:grid;place-items:center;position:relative;color:#17313c}.earth-compass span{position:absolute;top:0;font-size:10px;font-weight:900}.earth-compass b{font-size:26px;line-height:1;margin-top:8px}.earth-scale{min-width:72px;padding-top:2px;color:#17313c}.earth-scale span{display:block;font-size:10px;font-weight:900;margin-bottom:3px;text-align:center}.earth-scale i{display:block;height:7px;border-left:2px solid #17313c;border-right:2px solid #17313c;border-bottom:3px solid #17313c;box-sizing:border-box;filter:drop-shadow(0 1px 1px #fff)}.earth-focus{pointer-events:auto;border:1px solid #506b73;background:#f5f2e8dd;color:#17313c;border-radius:7px;padding:5px 8px;font-size:10px;font-weight:800;cursor:pointer;text-shadow:none;display:grid;gap:1px}.earth-focus small{font-size:8px;font-weight:700;color:#738087}
      .earth-layer-control{position:absolute;right:14px;top:14px;z-index:4}.earth-layer-trigger{border:1px solid #47616d;background:#102632dc;color:#e9f0ed;border-radius:7px;padding:7px 10px;font-size:10px;font-weight:800;cursor:pointer;backdrop-filter:blur(4px)}.earth-layer-menu{margin-top:6px;width:190px;background:#0b1c27ed;border:1px solid #405965;border-radius:9px;padding:6px;box-shadow:0 8px 28px #10202745;backdrop-filter:blur(8px)}.earth-layer-menu button{width:100%;display:flex;gap:8px;align-items:center;border:0;background:transparent;color:#9fb2b8;padding:7px 8px;text-align:left;font-size:10px;border-radius:5px;cursor:pointer}.earth-layer-menu button:hover,.earth-layer-menu button.active{background:#173746;color:#f2e7ba}.earth-layer-menu button span{width:12px;color:#d4ad43}.earth-layer-disabled{padding:7px 8px;color:#64767c;font-size:9px;border-top:1px solid #263b44;margin-top:4px}
      .earth-site-panel,.earth-object-panel{position:absolute;left:14px;bottom:44px;z-index:6;width:min(390px,calc(100% - 28px));max-height:calc(100% - 78px);overflow:auto;background:#fffaf0f4;border:1px solid #a8893d;border-radius:11px;padding:12px;box-sizing:border-box;box-shadow:0 10px 34px #2b341f40;cursor:default;backdrop-filter:blur(8px)}.earth-object-panel{border-color:#567986}.earth-site-head{display:flex;justify-content:space-between;gap:12px}.earth-site-head small{display:block;color:#89691b;font-size:9px;font-weight:900;letter-spacing:.12em}.earth-object-panel .earth-site-head small{color:#466b78}.earth-site-head strong{display:block;font-size:15px;margin-top:2px}.earth-site-head button{border:0;background:none;font-size:20px;cursor:pointer}.earth-analysis-level,.earth-object-state{display:flex;justify-content:space-between;align-items:center;margin:9px 0;padding:7px 8px;background:#edf0e8;border-radius:6px;font-size:10px}.earth-analysis-level span,.earth-object-state span{color:#68777e}.earth-analysis-level b,.earth-object-state b{color:#335360}.earth-site-facts{display:grid;gap:5px}.earth-site-facts>div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #e4ddc8;padding:5px 2px;font-size:10px}.earth-site-facts span{color:#6c7879}.earth-site-facts b{text-align:right;font-weight:800}.earth-site-facts .unknown-info b{color:#8d7760}
      .earth-build-open{width:100%;margin-top:10px;border:1px solid #8d6f27;background:#d4ad43;color:#2e291a;border-radius:7px;padding:9px 12px;font-weight:900;cursor:pointer}.earth-build-message{margin-top:8px;padding:8px;background:#f6e9c2;border:1px solid #c8a452;border-radius:6px;font-size:10px}.earth-build-picker,.earth-placement-editor{margin-top:10px}.earth-build-picker-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.earth-build-picker-head button{border:0;background:none;color:#6d5b2b;font-size:10px;text-decoration:underline;cursor:pointer}.earth-build-options{display:grid;gap:6px;margin-top:8px;max-height:260px;overflow:auto}.earth-build-option{display:grid;gap:3px;border:1px solid #d5c899;background:#fffdf4;color:#263943;border-radius:7px;padding:8px;text-align:left;cursor:pointer}.earth-build-option.locked{opacity:.5;cursor:not-allowed}.build-name{display:flex;justify-content:space-between;gap:8px}.build-name em{font-style:normal;color:#8d6f27}.build-meta,.req-ok,.req-no{font-size:9px}.req-ok{color:#3c7650}.req-no{color:#9a4848}.earth-placement-summary,.earth-rotation-head{display:flex;justify-content:space-between;gap:10px;margin-top:8px;font-size:10px}.earth-rotation-presets,.earth-rotation-fine,.earth-placement-actions{display:flex;gap:6px;align-items:center;margin-top:7px}.earth-rotation-presets button,.earth-rotation-fine button,.earth-placement-actions button{border:1px solid #b6aa84;background:#fffdf4;color:#4a4a3d;border-radius:6px;padding:6px 8px;cursor:pointer}.earth-rotation-presets button.active{background:#d4ad43;border-color:#8d6f27}.earth-rotation-fine input{flex:1}.earth-placement-actions{justify-content:flex-end}.earth-placement-actions .primary{background:#d4ad43;border-color:#8d6f27;font-weight:900}.earth-placement-actions .primary:disabled{opacity:.45;cursor:not-allowed}.earth-preview-note,.earth-terrain-note{display:block;color:#7b7464;font-size:9px;line-height:1.35;margin-top:7px}.earth-object-ready{margin-top:10px;padding:8px;background:#edf0e8;border-radius:6px;color:#66757a;font-size:10px;line-height:1.4}
      .earth-help{position:absolute;left:14px;bottom:12px;background:#102632db;color:#eef3ef;border:1px solid #506873;border-radius:6px;padding:6px 9px;font-size:9px;pointer-events:none;backdrop-filter:blur(4px)}.earth-foot{max-width:1500px;margin:6px auto 14px;display:flex;justify-content:space-between;gap:12px;color:#7a8586;font-size:9px}.earth-notice,.earth-empty{max-width:1500px;margin:0 auto 10px;padding:9px 11px;background:#f7e4d8;border:1px solid #c48a6c;border-radius:7px;color:#78462f;font-size:11px}
      .earth-lower-card{max-width:1500px;margin:0 auto 14px;background:#f8f8f1;border:1px solid #b9c0b4;border-radius:12px;padding:14px;box-sizing:border-box}.earth-section-title small{font-size:9px;letter-spacing:.14em;color:#8a6b21;font-weight:900}.earth-section-title h2{font-family:Georgia,serif;font-weight:400;margin:2px 0 10px;font-size:21px}.earth-job-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:9px}.earth-job{background:#fffdf4;border:1px solid #d7d0b6;border-radius:9px;padding:10px}.earth-job-head,.earth-endpoints,.earth-facts{display:flex;justify-content:space-between;gap:10px}.earth-job-head span{font-size:9px;color:#8a6b21}.earth-cargo{font-family:Georgia,serif;font-size:20px;margin:7px 0}.earth-endpoints,.earth-facts{font-size:9px;color:#718083}.earth-rail{height:5px;background:#e3dfcf;border-radius:99px;margin:9px 0;overflow:hidden}.earth-rail div{height:100%;background:#b28d33}.earth-chain{display:flex;gap:8px;flex-wrap:wrap}.earth-chain-node{display:flex;gap:8px;align-items:center;padding:8px 10px;background:#fffdf4;border:1px solid #d7d0b6;border-radius:8px;min-width:180px;flex:1}.earth-chain-node>span{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#d4ad43;color:#2e291a;font-weight:900}.earth-chain-node strong,.earth-chain-node small{display:block}.earth-chain-node small{color:#778184;font-size:9px;margin-top:2px}
      @media(max-width:900px){.earth-shell{padding:10px}.earth-head{align-items:stretch;flex-direction:column}.earth-map{height:68vh;min-height:520px}.earth-actions{justify-content:space-between}.earth-foot{flex-direction:column}.earth-site-panel,.earth-object-panel{width:calc(100% - 28px)}}
    `}</style>
  </div>
}
