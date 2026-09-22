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

export type MoonSurfaceEntity = {
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
  profile_id?: string | null
  owner_class?: string | null
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

type ElevationGrid = {
  stepM: number
  size: number
  values: (number | null)[]
}

type SpatialPayload = {
  location?: { id: string; slug: string; name: string }
  profile?: { id?: string; credits?: number }
  frame?: { origin_status?: string | null; terrain_dataset_id?: string | null } | null
  terrain?: {
    activeDataset?: { id?: string; dataset_name?: string; status?: string; resolution_m?: number | null } | null
    resolution?: { status?: string; zM?: number | null }
    elevationGrid?: ElevationGrid | null
  }
  entities?: MoonSurfaceEntity[]
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

type MapRoute = {
  job: TransportJob
  geometry: SurfaceRouteGeometry
  vehiclePoint: SurfaceRoutePoint
  progress01: number
}

type SelectedSpot = { xM: number; yM: number }
type Pan = { x: number; y: number }
type Viewport = { width: number; height: number }
type LayerKey = 'relief' | 'infrastructure' | 'noxia' | 'routes' | 'logistics'

type Props = {
  onOpenWorldObject?: (entity: MoonSurfaceEntity) => void
}

const ACTIVE = new Set(['reserved', 'loading', 'in_transit', 'arrived', 'unloading'])
const PAD = 54
const MIN_ZOOM = 0.7
const MAX_ZOOM = 24
const MIN_WORLD_SPAN_M = 600

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

function worldStatusLabel(status?: string | null) {
  if (status === 'active') return 'In Betrieb'
  if (status === 'built' || status === 'completed') return 'Fertig'
  return status || 'Fertig'
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

function inventoryPoint(inventory: Inventory, entities: MoonSurfaceEntity[]): SurfaceRoutePoint | null {
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

function actionLabel(entityId?: string | null) {
  if (entityId === 'landing_pad_moon') return 'Raumhafen öffnen'
  if (entityId === 'warehouse') return 'Warenhaus öffnen'
  if (entityId === 'surface_workshop') return 'Werkstatt öffnen'
  if (entityId === 'surface_comms') return 'Navigation öffnen'
  if (entityId === 'rover_yard') return 'Logistik öffnen'
  return 'Gebäude betreten'
}

function terrainWorldCorners(grid: ElevationGrid | null | undefined): SurfaceRoutePoint[] {
  if (!grid || !grid.size || !grid.stepM) return []
  const halfExtent = Math.max(grid.stepM, (grid.size - 1) * grid.stepM / 2)
  return [
    { xM: -halfExtent, yM: -halfExtent },
    { xM: halfExtent, yM: -halfExtent },
    { xM: -halfExtent, yM: halfExtent },
    { xM: halfExtent, yM: halfExtent },
  ]
}

export default function ShackletonSurfaceMap({ onOpenWorldObject }: Props) {
  const [spatial, setSpatial] = useState<SpatialPayload | null>(null)
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [jobs, setJobs] = useState<TransportJob[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 })
  const [viewport, setViewport] = useState<Viewport>({ width: 1280, height: 720 })
  const [selectedSpot, setSelectedSpot] = useState<SelectedSpot | null>(null)
  const [selectedBuildId, setSelectedBuildId] = useState('')
  const [selectedWorldObjectId, setSelectedWorldObjectId] = useState<string | null>(null)
  const [rotationDeg, setRotationDeg] = useState(0)
  const [placing, setPlacing] = useState(false)
  const [buildMenuOpen, setBuildMenuOpen] = useState(false)
  const [buildMessage, setBuildMessage] = useState<string | null>(null)
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>(defaultLayers)
  const [layersOpen, setLayersOpen] = useState(false)

  const mapRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; pan: Pan; moved: boolean } | null>(null)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const headers = { Authorization: `Bearer ${token}` }
      const spatialResponse = await fetch('/api/game/build/spatial?location=moon', { headers, cache: 'no-store' })
      const spatialPayload = await spatialResponse.json() as SpatialPayload
      if (!spatialResponse.ok || !spatialPayload.location?.id) throw new Error(spatialPayload.error ?? 'Moon-Standort nicht verfügbar')
      const logisticsResponse = await fetch(`/api/game/logistics?locationId=${encodeURIComponent(spatialPayload.location.id)}`, { headers, cache: 'no-store' })
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
    const map = mapRef.current
    if (!map) return
    const update = () => {
      const rect = map.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) setViewport({ width: Math.max(320, rect.width), height: Math.max(320, rect.height) })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(map)
    return () => observer.disconnect()
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
  const terrainGrid = spatial?.terrain?.elevationGrid ?? null

  const nodes = useMemo(() => inventories.filter(inventory => inventory.inventory_kind !== 'vehicle').flatMap(inventory => {
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
    ...terrainWorldCorners(terrainGrid),
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
  ], [terrainGrid, nodes, routes, entities, pendingBuilds])

  const worldBounds = useMemo(() => {
    if (!allPoints.length) return { centerX: 0, centerY: 0, spanX: MIN_WORLD_SPAN_M, spanY: MIN_WORLD_SPAN_M }
    const xs = allPoints.map(point => point.xM), ys = allPoints.map(point => point.yM)
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
    const spanX = Math.max(maxX - minX, MIN_WORLD_SPAN_M), spanY = Math.max(maxY - minY, MIN_WORLD_SPAN_M)
    return { centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, spanX: spanX * 1.16, spanY: spanY * 1.16 }
  }, [allPoints])

  const baseScale = useMemo(() => Math.min(
    Math.max(100, viewport.width - PAD * 2) / worldBounds.spanX,
    Math.max(100, viewport.height - PAD * 2) / worldBounds.spanY,
  ), [viewport, worldBounds])

  const project = useCallback((point: SurfaceRoutePoint) => ({
    x: viewport.width / 2 + (point.xM - worldBounds.centerX) * baseScale,
    y: viewport.height / 2 - (point.yM - worldBounds.centerY) * baseScale,
  }), [viewport, worldBounds, baseScale])

  const unproject = useCallback((x: number, y: number): SelectedSpot => ({
    xM: worldBounds.centerX + (x - viewport.width / 2) / baseScale,
    yM: worldBounds.centerY - (y - viewport.height / 2) / baseScale,
  }), [viewport, worldBounds, baseScale])

  const clientToBase = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const sx = (clientX - rect.left) / rect.width * viewport.width
    const sy = (clientY - rect.top) / rect.height * viewport.height
    return { x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom }
  }, [viewport, pan, zoom])

  function zoomAt(nextZoom: number, clientX?: number, clientY?: number) {
    const next = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
    const svg = svgRef.current
    if (!svg || clientX == null || clientY == null) {
      setZoom(next)
      return
    }
    const rect = svg.getBoundingClientRect()
    const mouseX = (clientX - rect.left) / rect.width * viewport.width
    const mouseY = (clientY - rect.top) / rect.height * viewport.height
    const ratio = next / zoom
    setPan(current => ({ x: mouseX - (mouseX - current.x) * ratio, y: mouseY - (mouseY - current.y) * ratio }))
    setZoom(next)
  }

  function resetView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  function onWheel(event: React.WheelEvent<SVGSVGElement>) {
    event.preventDefault()
    zoomAt(zoom * (event.deltaY < 0 ? 1.18 : 0.84), event.clientX, event.clientY)
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, pan, moved: false }
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.clientX, dy = event.clientY - drag.clientY
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
        body: JSON.stringify({ buildableId: selectedBuildId, location: 'moon', xM: selectedSpot.xM, yM: selectedSpot.yM, rotationDeg }),
      })
      const result = await response.json() as { error?: string }
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
  const selectedCanBuild = selectedDef ? (selectedDef.requirements?.canBuild ?? Number(spatial?.profile?.credits ?? 0) >= selectedDef.cost) : false
  const inventoryById = useMemo(() => new Map(inventories.map(item => [item.id, item])), [inventories])
  const visibleWidthM = Math.max(1, viewport.width / (baseScale * zoom))
  const scale = useMemo(() => {
    const targetM = visibleWidthM / 5
    const options = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
    const meters = options.reduce((best, value) => Math.abs(value - targetM) < Math.abs(best - targetM) ? value : best, options[0])
    return { meters, pixels: meters * baseScale * zoom }
  }, [visibleWidthM, baseScale, zoom])

  const selectedTerrain = useMemo(() => {
    if (!selectedSpot || !terrainGrid || !terrainGrid.values.length) return null
    const half = Math.floor(terrainGrid.size / 2)
    const col = Math.round(selectedSpot.xM / terrainGrid.stepM) + half
    const row = Math.round(-selectedSpot.yM / terrainGrid.stepM) + half
    if (row < 0 || row >= terrainGrid.size || col < 0 || col >= terrainGrid.size) return null
    const elevationM = terrainGrid.values[row * terrainGrid.size + col]
    return elevationM == null || !Number.isFinite(elevationM) ? null : { elevationM, resolutionM: terrainGrid.stepM }
  }, [selectedSpot, terrainGrid])

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
    {message && <div className="earth-notice">{message}</div>}
    <div className="earth-map" ref={mapRef}>
      <svg ref={svgRef} viewBox={`0 0 ${viewport.width} ${viewport.height}`} preserveAspectRatio="none" role="application" aria-label="Spielbare Shackleton-Mondkarte" onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { dragRef.current = null }}>
        <defs>
          <pattern id="moon-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d8d7d1" strokeWidth="0.7" opacity="0.15" /></pattern>
          <filter id="moon-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width={viewport.width} height={viewport.height} fill="#777a77" />
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          <rect width={viewport.width} height={viewport.height} fill="url(#moon-grid)" />
          {layers.relief && (() => {
            const grid = terrainGrid
            if (!grid || !grid.values.length || grid.size <= 0) return null
            const values = grid.values.filter((value): value is number => value != null && Number.isFinite(value))
            if (!values.length) return null
            const minZ = Math.min(...values), maxZ = Math.max(...values), zSpan = Math.max(1e-6, maxZ - minZ)
            const half = Math.floor(grid.size / 2), cell = grid.stepM * baseScale
            return <g pointerEvents="none">{grid.values.map((value, index) => {
              if (value == null || !Number.isFinite(value)) return null
              const row = Math.floor(index / grid.size) - half, col = (index % grid.size) - half
              const center = project({ xM: col * grid.stepM, yM: -row * grid.stepM })
              const t = (value - minZ) / zSpan, lightness = 39 + t * 27
              return <rect key={`elev-${index}`} x={center.x - cell / 2} y={center.y - cell / 2} width={cell + 1} height={cell + 1} fill={`hsl(42 3% ${lightness}%)`} />
            })}</g>
          })()}
          {layers.infrastructure && <><line x1={project({ xM: -400, yM: 0 }).x} y1={project({ xM: -400, yM: 0 }).y} x2={project({ xM: 400, yM: 0 }).x} y2={project({ xM: 400, yM: 0 }).y} stroke="#aaa18c" strokeWidth={1 / zoom} opacity=".22"/><line x1={project({ xM: 0, yM: -400 }).x} y1={project({ xM: 0, yM: -400 }).y} x2={project({ xM: 0, yM: 400 }).x} y2={project({ xM: 0, yM: 400 }).y} stroke="#aaa18c" strokeWidth={1 / zoom} opacity=".22"/></>}
          {layers.routes && routes.map(route => {
            const points = route.geometry.points.map(point => { const p = project(point); return `${p.x},${p.y}` }).join(' ')
            const vehicle = project(route.vehiclePoint)
            return <g key={route.job.id}><polyline points={points} fill="none" stroke="#826829" strokeWidth={4 / zoom} strokeLinejoin="round" strokeLinecap="round" opacity="0.9"/><circle cx={vehicle.x} cy={vehicle.y} r={8 / zoom} fill="#d7b44d" stroke="#fff5c9" strokeWidth={2 / zoom} filter="url(#moon-glow)"/></g>
          })}
          {layers.noxia && entities.map(entity => {
            const xM = finite(entity.x_m), yM = finite(entity.y_m)
            if (xM == null || yM == null) return null
            const p = project({ xM, yM }), width = Math.max(10 / zoom, Number(entity.footprint_width_m ?? 20) * baseScale), depth = Math.max(10 / zoom, Number(entity.footprint_depth_m ?? 20) * baseScale)
            const visual = getBuildingVisual(entity.entity_id ?? '', 'moon'), spriteScale = visual?.mapScale ?? 1.45, spriteW = Math.max(width * spriteScale, 24 / zoom), spriteH = Math.max(Math.max(depth, width * .68) * spriteScale, 20 / zoom), selected = entity.id === selectedWorldObjectId
            return <g key={entity.id} role="button" aria-label={`${entity.name ?? entity.entity_id} auswählen`} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); chooseWorldObject(entity.id) }} style={{ cursor: 'pointer' }} transform={`translate(${p.x} ${p.y}) rotate(${-Number(entity.rotation_deg ?? 0)})`}>
              <title>{entity.name ?? entity.entity_id}{entity.ownerLabel ? ` · ${entity.ownerLabel}` : ''}</title>
              <rect x={-Math.max(width, 26 / zoom) / 2} y={-Math.max(depth, 22 / zoom) / 2} width={Math.max(width, 26 / zoom)} height={Math.max(depth, 22 / zoom)} fill="transparent" pointerEvents="all"/>
              <ellipse cx={0} cy={depth * .20} rx={Math.max(width * .48, 5 / zoom)} ry={Math.max(depth * .22, 2.2 / zoom)} fill="#20231f" opacity=".22" pointerEvents="none"/>
              {selected && <rect x={-width / 2} y={-depth / 2} width={width} height={depth} rx={1 / zoom} fill="#eaf1df" fillOpacity=".08" stroke="#d4ad43" strokeWidth={2.5 / zoom} pointerEvents="none"/>}
              {visual?.mapAsset ? <image href={visual.mapAsset} x={-spriteW / 2} y={depth / 2 - spriteH} width={spriteW} height={spriteH} preserveAspectRatio="xMidYMax meet" pointerEvents="none"/> : <rect x={-width / 2} y={-depth / 2} width={width} height={depth} rx={1 / zoom} fill="#345f68" stroke="#183b43" strokeWidth={1.2 / zoom} pointerEvents="none"/>}
              {zoom >= 3 && <text pointerEvents="none" x={0} y={depth / 2 - spriteH - 5 / zoom} textAnchor="middle" fontSize={9 / zoom} fontWeight="800" fill="#17313c" paintOrder="stroke" stroke="#f5f2e8" strokeWidth={2 / zoom}>{entity.name ?? entity.entity_id}</text>}
            </g>
          })}
          {layers.noxia && pendingBuilds.map(build => {
            const xM = finite(build.x_m), yM = finite(build.y_m)
            if (xM == null || yM == null) return null
            const p = project({ xM, yM }), width = Math.max(9 / zoom, Number(build.footprint_width_m ?? 20) * baseScale), depth = Math.max(9 / zoom, Number(build.footprint_depth_m ?? 20) * baseScale)
            return <g key={build.id} transform={`translate(${p.x} ${p.y}) rotate(${-Number(build.rotation_deg ?? 0)})`} pointerEvents="none"><rect x={-width / 2} y={-depth / 2} width={width} height={depth} fill="#d9a63d" fillOpacity=".32" stroke="#7b5914" strokeWidth={1.5 / zoom} strokeDasharray={`${3 / zoom} ${2 / zoom}`}/></g>
          })}
          {layers.logistics && nodes.map(node => { const p = project(node.point); return <g key={node.inventory.id} pointerEvents="none"><circle cx={p.x} cy={p.y} r={5 / zoom} fill="#334d59" stroke="#f4f1e6" strokeWidth={1.2 / zoom}/>{zoom >= 2.2 && <text x={p.x + 8 / zoom} y={p.y - 6 / zoom} fill="#17313c" paintOrder="stroke" stroke="#f4f1e6" strokeWidth={2 / zoom} fontSize={9 / zoom} fontWeight="800">{node.inventory.label}</text>}</g> })}
          {selectedSpot && (() => {
            const p = project(selectedSpot), previewW = selectedDef ? Math.max(12 / zoom, selectedDef.footprint.widthM * baseScale) : 18 / zoom, previewD = selectedDef ? Math.max(12 / zoom, selectedDef.footprint.depthM * baseScale) : 18 / zoom
            const clearanceW = selectedDef ? previewW + selectedDef.footprint.clearanceM * 2 * baseScale : previewW, clearanceD = selectedDef ? previewD + selectedDef.footprint.clearanceM * 2 * baseScale : previewD
            return <g transform={`translate(${p.x} ${p.y}) rotate(${-rotationDeg})`} pointerEvents="none">{selectedDef && <rect x={-clearanceW / 2} y={-clearanceD / 2} width={clearanceW} height={clearanceD} fill="#f5d75f" fillOpacity=".08" stroke="#8a6b21" strokeWidth={1.2 / zoom} strokeDasharray={`${5 / zoom} ${3 / zoom}`}/>} {selectedDef ? <rect x={-previewW / 2} y={-previewD / 2} width={previewW} height={previewD} fill="#f2cc4d" fillOpacity=".28" stroke="#5c4510" strokeWidth={2 / zoom}/> : <><circle r={12 / zoom} fill="#f5d75f" fillOpacity=".22" stroke="#5c4510" strokeWidth={2 / zoom}/><circle r={3 / zoom} fill="#5c4510"/></>}</g>
          })()}
        </g>
      </svg>
      <div className="earth-map-tools"><div className="earth-compass" aria-label="Karte ist nach Norden ausgerichtet"><span>N</span><b>↑</b></div><div className="earth-scale"><span>{scale.meters >= 1000 ? `${scale.meters / 1000} km` : `${scale.meters} m`}</span><i style={{ width: `${Math.max(26, Math.min(150, scale.pixels))}px` }}/></div><div className="earth-camera-controls"><button type="button" onClick={resetView}>Zentrieren</button><button type="button" aria-label="Hineinzoomen" onClick={() => zoomAt(zoom * 1.35)}>+</button><button type="button" aria-label="Herauszoomen" onClick={() => zoomAt(zoom / 1.35)}>−</button></div></div>
      <div className="earth-layer-control"><button className="earth-layer-trigger" type="button" onClick={() => setLayersOpen(value => !value)}>☷ Layer</button>{layersOpen && <div className="earth-layer-menu">{([['relief','Relief / LOLA'],['infrastructure','Infrastruktur'],['noxia','NOXIA-Bauten'],['routes','Transportrouten'],['logistics','Logistikknoten']] as [LayerKey,string][]).map(([key,label]) => <button key={key} className={layers[key] ? 'active' : ''} type="button" onClick={() => toggleLayer(key)}><span>{layers[key] ? '●' : '○'}</span>{label}</button>)}<div className="earth-layer-disabled">○ Bebaubarkeit / Neigung · nächster Terrain-Schritt</div><div className="earth-layer-disabled">○ Geologie / Ressourcen · Daten folgen</div></div>}</div>
      {selectedSpot && <div className="earth-site-panel" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}><div className="earth-site-head"><div><small>AUSGEWÄHLTE STELLE</small><strong>{selectedTerrain ? 'LOLA-Gelände aufgelöst' : 'Geländedaten werden gesucht'}</strong></div><button type="button" onClick={() => { setSelectedSpot(null); setBuildMenuOpen(false); setSelectedBuildId(''); setRotationDeg(0); setBuildMessage(null) }}>×</button></div><div className="earth-analysis-level"><span>Informationsstand</span><b>{spatial?.terrain?.resolution?.status === 'resolved' ? 'Lunare Höhenmessung' : 'Grundbeobachtung'}</b></div><div className="earth-site-facts"><div><span>Position</span><b>{selectedSpot.xM.toFixed(0)} m E · {selectedSpot.yM.toFixed(0)} m N</b></div><div><span>Höhe</span><b>{selectedTerrain ? `${selectedTerrain.elevationM.toFixed(1)} m` : '–'}</b></div><div><span>Terrainquelle</span><b>{spatial?.terrain?.activeDataset?.dataset_name ?? spatial?.frame?.terrain_dataset_id ?? 'noch nicht aufgelöst'}</b></div><div><span>Terrainauflösung</span><b>{selectedTerrain ? `≈ ${selectedTerrain.resolutionM} m` : '–'}</b></div></div>{buildMessage && <div className="earth-build-message">{buildMessage}</div>}{!buildMenuOpen ? <button className="earth-build-open" type="button" onClick={() => { setBuildMenuOpen(true); setSelectedBuildId(''); setBuildMessage(null) }}>Bauen</button> : selectedDef ? <div className="earth-placement-editor"><div className="earth-build-picker-head"><b>{selectedDef.name}</b><button type="button" onClick={() => { setSelectedBuildId(''); setRotationDeg(0); setBuildMessage(null) }}>anderes Gebäude</button></div><div className="earth-placement-summary"><span>{selectedDef.footprint.widthM}×{selectedDef.footprint.depthM} m</span><b>{selectedDef.cost.toLocaleString('de-DE')} Cr</b></div><div className="earth-rotation-head"><span>Ausrichtung</span><b>{rotationDeg}°</b></div><div className="earth-rotation-presets">{[0,90,180,270].map(value => <button key={value} type="button" className={rotationDeg === value ? 'active' : ''} onClick={() => setRotationDeg(value)}>{value}°</button>)}</div><div className="earth-placement-actions"><button type="button" onClick={() => { setSelectedBuildId(''); setRotationDeg(0) }}>Zurück</button><button type="button" className="primary" disabled={placing || !selectedCanBuild} onClick={() => void placeBuilding()}>{placing ? 'Prüfe …' : 'Jetzt bauen'}</button></div></div> : <div className="earth-build-picker"><div className="earth-build-picker-head"><b>Gebäude wählen</b><button type="button" onClick={() => setBuildMenuOpen(false)}>zurück</button></div><div className="earth-build-options">{available.map(building => { const req = building.requirements, creditsOk = req?.creditsOk ?? Number(spatial?.profile?.credits ?? 0) >= building.cost, knowledgeOk = req?.knowledgeOk ?? true, canBuild = req?.canBuild ?? (creditsOk && knowledgeOk); return <button key={building.id} type="button" className={`earth-build-option ${canBuild ? '' : 'locked'}`} disabled={!canBuild || placing} onClick={() => { setSelectedBuildId(building.id); setRotationDeg(0); setBuildMessage(null) }}><span className="build-name"><strong>{building.name}</strong><em>{building.cost.toLocaleString('de-DE')} Cr</em></span><span className="build-meta">{building.footprint.widthM}×{building.footprint.depthM} m · {building.buildTimeTicks} Tick{building.buildTimeTicks === 1 ? '' : 's'}</span></button> })}</div></div>}</div>}
      {selectedWorldObject && <div className="earth-object-panel" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}><div className="earth-site-head"><div><small>GEBÄUDE</small><strong>{selectedWorldObject.name ?? selectedWorldObject.entity_id}</strong></div><button type="button" onClick={() => setSelectedWorldObjectId(null)}>×</button></div><div className="earth-object-state"><span>Status</span><b>{worldStatusLabel(selectedWorldObject.status)}</b></div><div className="earth-site-facts"><div><span>Eigentum</span><b>{selectedWorldObject.ownerLabel ?? (selectedWorldObject.isOwn ? 'Dein Gebäude' : 'Weltobjekt')}</b></div><div><span>Position</span><b>{Number(selectedWorldObject.x_m ?? 0).toFixed(0)} m E · {Number(selectedWorldObject.y_m ?? 0).toFixed(0)} m N</b></div><div><span>Ausrichtung</span><b>{normalizeRotation(Number(selectedWorldObject.rotation_deg ?? 0))}°</b></div><div><span>Footprint</span><b>{Number(selectedWorldObject.footprint_width_m ?? 20)}×{Number(selectedWorldObject.footprint_depth_m ?? 20)} m</b></div><div><span>Fundamenthöhe</span><b>{selectedWorldObject.z_m == null ? '–' : `${Number(selectedWorldObject.z_m).toFixed(1)} m`}</b></div></div><button className="earth-object-open" type="button" onClick={() => onOpenWorldObject?.(selectedWorldObject)}>{actionLabel(selectedWorldObject.entity_id)} →</button><small className="earth-object-note">Das Gebäude öffnet eine eigene Anlagenansicht. Funktionen, Personen und Interaktionen liegen dort – nicht in einem zweiten Kartenfenster.</small></div>}
      <div className="earth-help">{selectedWorldObject ? 'Gebäude gewählt · links öffnen' : selectedDef ? `${selectedDef.name} · ausrichten · Bau bestätigen` : selectedSpot ? 'Stelle gewählt · Gelände prüfen · Bauen' : 'Stelle anklicken · Mausrad: Zoom · Ziehen: Karte'}</div>
    </div>
    <div className="earth-foot"><span>{spatial?.terrain?.activeDataset?.dataset_name ?? 'LOLA-Terrain'}</span><span>Lokales Shackleton-ENU-Frame · metrisch isotroper Viewport · NOXIA-Weltobjekte</span></div>
    <section className="earth-lower-card"><div className="earth-section-title"><small>OBERFLÄCHENLOGISTIK</small><h2>Aktive Transporte</h2></div>{!activeJobs.length && <div className="earth-empty">Noch kein aktiver Moon-Surface-Transport.</div>}<div className="earth-job-grid">{activeJobs.map(job => { const progress = deriveSurfaceMissionProgress(job, now), source = inventoryById.get(job.source_inventory_id)?.label ?? job.source_inventory_id.slice(0,8), destination = inventoryById.get(job.destination_inventory_id)?.label ?? job.destination_inventory_id.slice(0,8), percent = Math.round(progress.progress01 * 100); return <article className="earth-job" key={job.id}><div className="earth-job-head"><strong>{job.vehicle_role ?? 'Surface-Fahrzeug'}</strong><span>{formatStatus(job.status)}</span></div><div className="earth-cargo">{job.amount} {job.resource}</div><div className="earth-endpoints"><span>{source}</span><b>→</b><span>{destination}</span></div><div className="earth-rail"><div style={{ width: `${percent}%` }}/></div><div className="earth-facts"><span><b>{percent}%</b> Fahrt</span><span><b>{progress.travelledKm == null ? '–' : progress.travelledKm.toFixed(2)} km</b> gefahren</span><span><b>{formatRemaining(progress.remainingSeconds)}</b> verbleibend</span></div></article> })}</div></section>
    <section className="earth-lower-card"><div className="earth-section-title"><small>KANONISCHE KETTE</small><h2>Shackleton-Warenfluss</h2></div><div className="earth-chain">{SHACKLETON_SURFACE_LOGISTICS_CHAIN.map((node,index) => <div className="earth-chain-node" key={node.role}><span>{index + 1}</span><div><strong>{node.label}</strong><small>{node.purpose}</small></div></div>)}</div></section>
    <style jsx>{`
      .earth-shell{min-height:100%;background:#eef0e8;color:#1f3440;font-family:system-ui,sans-serif;padding:0;box-sizing:border-box}.earth-map{position:relative;width:100%;height:calc(100dvh - var(--noxia-topbar-h,44px));min-height:520px;margin:0;overflow:hidden;background:#777a77;touch-action:none;cursor:grab}.earth-map:active{cursor:grabbing}.earth-map svg{width:100%;height:100%;display:block}.earth-map-tools{position:absolute;left:16px;top:14px;display:flex;align-items:flex-start;gap:10px;z-index:5;color:#17313c;text-shadow:0 1px 2px #fff,0 0 7px #f4f1e6}.earth-compass,.earth-scale{pointer-events:none}.earth-compass{width:30px;height:38px;display:grid;place-items:center;position:relative}.earth-compass span{position:absolute;top:0;font-size:10px;font-weight:900}.earth-compass b{font-size:26px;line-height:1;margin-top:8px}.earth-scale{min-width:76px;padding-top:2px}.earth-scale span{display:block;font-size:10px;font-weight:900;margin-bottom:3px;text-align:center}.earth-scale i{display:block;height:7px;border-left:2px solid #17313c;border-right:2px solid #17313c;border-bottom:3px solid #17313c;box-sizing:border-box}.earth-camera-controls{display:flex;gap:4px;pointer-events:auto}.earth-camera-controls button{border:1px solid #506b73;background:#f5f2e8e8;color:#17313c;border-radius:7px;padding:6px 9px;font-size:10px;font-weight:850;cursor:pointer;text-shadow:none}.earth-camera-controls button+button{min-width:31px;font-size:15px;padding:3px 7px}.earth-layer-control{position:absolute;right:14px;top:14px;z-index:6}.earth-layer-trigger{border:1px solid #47616d;background:#102632dc;color:#e9f0ed;border-radius:7px;padding:7px 10px;font-size:10px;font-weight:800;cursor:pointer}.earth-layer-menu{margin-top:6px;width:190px;background:#0b1c27ed;border:1px solid #405965;border-radius:9px;padding:6px;box-shadow:0 8px 28px #10202745}.earth-layer-menu button{width:100%;display:flex;gap:8px;align-items:center;border:0;background:transparent;color:#9fb2b8;padding:7px 8px;text-align:left;font-size:10px;border-radius:5px;cursor:pointer}.earth-layer-menu button.active{background:#173746;color:#f2e7ba}.earth-layer-disabled{padding:7px 8px;color:#64767c;font-size:9px;border-top:1px solid #263b44;margin-top:4px}.earth-site-panel,.earth-object-panel{position:absolute;left:14px;bottom:calc(var(--noxia-cockpit-clearance,76px) + 14px);z-index:7;width:min(420px,calc(100% - 28px));max-height:calc(100% - var(--noxia-cockpit-clearance,76px) - 58px);overflow:auto;background:#fffaf0f5;border:1px solid #a8893d;border-radius:11px;padding:13px;box-sizing:border-box;box-shadow:0 10px 34px #2b341f40;cursor:default;backdrop-filter:blur(8px)}.earth-object-panel{border-color:#567986}.earth-site-head{display:flex;justify-content:space-between;gap:12px}.earth-site-head small{display:block;color:#89691b;font-size:9px;font-weight:900;letter-spacing:.12em}.earth-object-panel .earth-site-head small{color:#466b78}.earth-site-head strong{display:block;font-size:15px;margin-top:2px}.earth-site-head button{border:0;background:none;font-size:20px;cursor:pointer}.earth-analysis-level,.earth-object-state{display:flex;justify-content:space-between;align-items:center;margin:9px 0;padding:7px 8px;background:#edf0e8;border-radius:6px;font-size:10px}.earth-analysis-level span,.earth-object-state span{color:#68777e}.earth-analysis-level b,.earth-object-state b{color:#335360}.earth-site-facts{display:grid;gap:5px}.earth-site-facts>div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #e4ddc8;padding:5px 2px;font-size:10px}.earth-site-facts span{color:#6c7879}.earth-site-facts b{text-align:right;font-weight:800}.earth-object-open,.earth-build-open{width:100%;margin-top:11px;border:1px solid #486d7a;background:#173f4e;color:#fff;border-radius:7px;padding:9px 12px;font-weight:900;cursor:pointer}.earth-build-open{border-color:#8d6f27;background:#d4ad43;color:#2e291a}.earth-object-note{display:block;margin-top:8px;color:#68777e;font-size:9px;line-height:1.4}.earth-build-message{margin-top:8px;padding:8px;background:#f6e9c2;border:1px solid #c8a452;border-radius:6px;font-size:10px}.earth-build-picker,.earth-placement-editor{margin-top:10px}.earth-build-picker-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.earth-build-picker-head button{border:0;background:none;color:#6d5b2b;font-size:10px;text-decoration:underline;cursor:pointer}.earth-build-options{display:grid;gap:6px;margin-top:8px;max-height:280px;overflow:auto}.earth-build-option{display:grid;gap:3px;border:1px solid #d5c899;background:#fffdf4;color:#263943;border-radius:7px;padding:8px;text-align:left;cursor:pointer}.earth-build-option.locked{opacity:.5;cursor:not-allowed}.build-name{display:flex;justify-content:space-between;gap:8px}.build-name em{font-style:normal;color:#8d6f27}.build-meta{font-size:9px}.earth-placement-summary,.earth-rotation-head{display:flex;justify-content:space-between;gap:10px;margin-top:8px;font-size:10px}.earth-rotation-presets,.earth-placement-actions{display:flex;gap:6px;align-items:center;margin-top:7px}.earth-rotation-presets button,.earth-placement-actions button{border:1px solid #b6aa84;background:#fffdf4;color:#4a4a3d;border-radius:6px;padding:6px 8px;cursor:pointer}.earth-rotation-presets button.active{background:#d4ad43;border-color:#8d6f27}.earth-placement-actions{justify-content:flex-end}.earth-placement-actions .primary{background:#d4ad43;border-color:#8d6f27;font-weight:900}.earth-placement-actions .primary:disabled{opacity:.45;cursor:not-allowed}.earth-help{position:absolute;left:14px;bottom:12px;background:#102632db;color:#eef3ef;border:1px solid #506873;border-radius:6px;padding:6px 9px;font-size:9px;pointer-events:none;z-index:5}.earth-foot{display:none}.earth-notice,.earth-empty{margin:0;padding:9px 11px;background:#f7e4d8;border:1px solid #c48a6c;border-radius:7px;color:#78462f;font-size:11px}.earth-lower-card{margin:14px;background:#f8f8f1;border:1px solid #b9c0b4;border-radius:12px;padding:14px;box-sizing:border-box}.earth-section-title small{font-size:9px;letter-spacing:.14em;color:#8a6b21;font-weight:900}.earth-section-title h2{font-family:Georgia,serif;font-weight:400;margin:2px 0 10px;font-size:21px}.earth-job-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:9px}.earth-job{background:#fffdf4;border:1px solid #d7d0b6;border-radius:9px;padding:10px}.earth-job-head,.earth-endpoints,.earth-facts{display:flex;justify-content:space-between;gap:10px}.earth-job-head span{font-size:9px;color:#8a6b21}.earth-cargo{font-family:Georgia,serif;font-size:20px;margin:7px 0}.earth-endpoints,.earth-facts{font-size:9px;color:#718083}.earth-rail{height:5px;background:#e3dfcf;border-radius:99px;margin:9px 0;overflow:hidden}.earth-rail div{height:100%;background:#b28d33}.earth-chain{display:flex;gap:8px;flex-wrap:wrap}.earth-chain-node{display:flex;gap:8px;align-items:center;padding:8px 10px;background:#fffdf4;border:1px solid #d7d0b6;border-radius:8px;min-width:180px;flex:1}.earth-chain-node>span{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#d4ad43;color:#2e291a;font-weight:900}.earth-chain-node strong,.earth-chain-node small{display:block}.earth-chain-node small{color:#778184;font-size:9px;margin-top:2px}@media(max-width:900px){.earth-map{height:calc(100dvh - var(--noxia-topbar-h,44px));min-height:480px}.earth-map-tools{gap:6px}.earth-camera-controls button:first-child{padding-inline:7px}.earth-site-panel,.earth-object-panel{width:calc(100% - 28px)}}
    `}</style>
  </div>
}
