'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { getBuildingVisual } from '@/lib/game/buildings/visuals'
import { analyzeLocalTerrainAt, reconstructLocalTerrain } from '@/lib/game/spatial/terrainReconstruction'
import { deriveSurfaceMissionProgress } from '@/lib/game/vehicles/surfaceProgress'
import { parseSurfaceRouteGeometry, pointAlongSurfaceRoute, type SurfaceRouteGeometry, type SurfaceRoutePoint } from '@/lib/game/vehicles/surfaceRouteGeometry'
import PlanetaryTerrainLayer from './PlanetaryTerrainLayer'

export type PlanetarySurfaceEntity = {
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

type BuildDef = {
  id: string
  name: string
  cost: number
  buildTimeTicks: number
  footprint: { widthM: number; depthM: number; clearanceM: number }
  requirements?: { knowledgeOk: boolean; creditsOk: boolean; canBuild: boolean }
}

type ElevationGrid = { stepM: number; size: number; values: (number | null)[] }
type PendingBuild = PlanetarySurfaceEntity & { buildable_id?: string | null }
type SpatialPayload = {
  location?: { id: string; slug: string; name: string }
  profile?: { id?: string; credits?: number }
  frame?: { body?: string; origin_status?: string | null; terrain_dataset_id?: string | null } | null
  terrain?: {
    activeDataset?: { id?: string; dataset_name?: string; status?: string; resolution_m?: number | null } | null
    resolution?: { status?: string; zM?: number | null }
    elevationGrid?: ElevationGrid | null
  }
  entities?: PlanetarySurfaceEntity[]
  builds?: PendingBuild[]
  available?: BuildDef[]
  error?: string
}

type Inventory = { id: string; inventory_kind: string; subject_type: string; subject_id: string | null; label: string; metadata?: Record<string, unknown> | null }
type TransportJob = { id: string; domain: string; source_inventory_id: string; destination_inventory_id: string; vehicle_role: string | null; resource: string; amount: number; status: string; route_snapshot?: Record<string, unknown> | null; started_at?: string | null; arrives_at?: string | null }
type LogisticsPayload = { inventories?: Inventory[]; jobs?: TransportJob[]; error?: string }
type MapRoute = { job: TransportJob; geometry: SurfaceRouteGeometry; vehiclePoint: SurfaceRoutePoint }
type Pan = { x: number; y: number }
type Viewport = { width: number; height: number }
type LayerKey = 'relief' | 'infrastructure' | 'noxia' | 'routes' | 'logistics'

export type PreparedCorridor = { id: string; points: SurfaceRoutePoint[]; kind?: 'prepared-track' | 'hardened-road' }

type Props = {
  locationSlug: string
  body: string
  mapLabel: string
  terrainLabel: string
  minimumWorldSpanM?: number
  corridors?: PreparedCorridor[]
  onOpenWorldObject?: (entity: PlanetarySurfaceEntity) => void
}

const ACTIVE = new Set(['reserved', 'loading', 'in_transit', 'arrived', 'unloading'])
const PAD = 54
const MIN_ZOOM = .7
const MAX_ZOOM = 28
const defaultLayers: Record<LayerKey, boolean> = { relief: true, infrastructure: true, noxia: true, routes: true, logistics: true }

function finite(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)) }
function normalizeRotation(value: number) { return ((Math.round(value) % 360) + 360) % 360 }
function statusLabel(status?: string | null) { return status === 'active' ? 'In Betrieb' : status === 'built' || status === 'completed' ? 'Fertig' : status || 'Fertig' }
function actionLabel(entityId?: string | null) {
  if (entityId === 'landing_pad_moon' || entityId === 'landing_pad') return 'Raumhafen öffnen'
  if (entityId === 'warehouse') return 'Warenhaus öffnen'
  if (entityId === 'surface_workshop' || entityId === 'shipyard') return 'Werkstatt öffnen'
  if (entityId === 'surface_comms' || entityId === 'command_center') return 'Navigation öffnen'
  if (entityId === 'rover_yard') return 'Logistik öffnen'
  return 'Gebäude betreten'
}
function cardinalDirection(azimuthDeg: number) {
  const labels = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW']
  return labels[Math.round(normalizeRotation(azimuthDeg) / 45) % 8]
}
function topographicSuitability(slopeDeg: number, reliefM: number) {
  if (slopeDeg <= 4 && reliefM <= 4) return { label: 'Günstig', className: 'good', note: 'Geringe Neigung; wenig Geländeanpassung zu erwarten.' }
  if (slopeDeg <= 8 && reliefM <= 10) return { label: 'Bedingt günstig', className: 'moderate', note: 'Pad oder leichte Nivellierung sinnvoll.' }
  if (slopeDeg <= 15) return { label: 'Aufwendig', className: 'difficult', note: 'Erhöhter Fundament- und Nivellierungsaufwand.' }
  return { label: 'Steil', className: 'critical', note: 'Topographisch kritisch; alternativen Bauplatz prüfen.' }
}

export default function PlanetarySurfaceMap({ locationSlug, body, mapLabel, terrainLabel, minimumWorldSpanM = 600, corridors = [], onOpenWorldObject }: Props) {
  const [spatial, setSpatial] = useState<SpatialPayload | null>(null)
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [jobs, setJobs] = useState<TransportJob[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 })
  const [viewport, setViewport] = useState<Viewport>({ width: 1280, height: 720 })
  const [selectedSpot, setSelectedSpot] = useState<SurfaceRoutePoint | null>(null)
  const [selectedWorldObjectId, setSelectedWorldObjectId] = useState<string | null>(null)
  const [selectedBuildId, setSelectedBuildId] = useState('')
  const [rotationDeg, setRotationDeg] = useState(0)
  const [buildMenuOpen, setBuildMenuOpen] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [buildMessage, setBuildMessage] = useState<string | null>(null)
  const [layers, setLayers] = useState(defaultLayers)
  const [layersOpen, setLayersOpen] = useState(false)
  const mapRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; pan: Pan; moved: boolean } | null>(null)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const headers = { Authorization: `Bearer ${token}` }
      const spatialResponse = await fetch(`/api/game/build/spatial?location=${encodeURIComponent(locationSlug)}`, { headers, cache: 'no-store' })
      const nextSpatial = await spatialResponse.json() as SpatialPayload
      if (!spatialResponse.ok || !nextSpatial.location?.id) throw new Error(nextSpatial.error ?? 'Standort nicht verfügbar')
      const logisticsResponse = await fetch(`/api/game/logistics?locationId=${encodeURIComponent(nextSpatial.location.id)}`, { headers, cache: 'no-store' })
      const logistics = await logisticsResponse.json() as LogisticsPayload
      if (!logisticsResponse.ok) throw new Error(logistics.error ?? 'Logistik nicht verfügbar')
      setSpatial(nextSpatial)
      setInventories(logistics.inventories ?? [])
      setJobs(logistics.jobs ?? [])
      setMessage(null)
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }, [locationSlug])

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 15_000); return () => window.clearInterval(timer) }, [load])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const update = () => { const rect = map.getBoundingClientRect(); if (rect.width > 0 && rect.height > 0) setViewport({ width: Math.max(320, rect.width), height: Math.max(320, rect.height) }) }
    update(); const observer = new ResizeObserver(update); observer.observe(map); return () => observer.disconnect()
  }, [])

  const entities = spatial?.entities ?? []
  const pendingBuilds = spatial?.builds ?? []
  const available = spatial?.available ?? []
  const terrainGrid = spatial?.terrain?.elevationGrid ?? null
  const terrainSurface = useMemo(() => terrainGrid ? reconstructLocalTerrain(terrainGrid, { upsampleFactor: 4, maxHoleRadiusCells: 1, minNeighbourCount: 3, sunAzimuthDeg: 315, sunAltitudeDeg: body === 'moon' ? 16 : 24 }) : null, [terrainGrid, body])
  const selectedWorldObject = entities.find(entity => entity.id === selectedWorldObjectId) ?? null
  const selectedDef = available.find(def => def.id === selectedBuildId) ?? null

  const inventoryPoint = useCallback((inventory: Inventory): SurfaceRoutePoint | null => {
    const metadata = inventory.metadata ?? {}
    const x = finite(metadata.xM ?? metadata.x_m), y = finite(metadata.yM ?? metadata.y_m)
    if (x != null && y != null) return { xM: x, yM: y }
    const entity = entities.find(item => item.id === inventory.subject_id || item.entity_id === inventory.subject_id)
    const ex = finite(entity?.x_m), ey = finite(entity?.y_m)
    return ex != null && ey != null ? { xM: ex, yM: ey } : null
  }, [entities])

  const nodes = useMemo(() => inventories.filter(item => item.inventory_kind !== 'vehicle').flatMap(inventory => { const point = inventoryPoint(inventory); return point ? [{ inventory, point }] : [] }), [inventories, inventoryPoint])
  const activeJobs = useMemo(() => jobs.filter(job => job.domain === 'surface' && ACTIVE.has(job.status)), [jobs])
  const routes = useMemo<MapRoute[]>(() => activeJobs.flatMap(job => { const geometry = parseSurfaceRouteGeometry(job.route_snapshot); if (!geometry) return []; const progress = deriveSurfaceMissionProgress(job, now); return [{ job, geometry, vehiclePoint: pointAlongSurfaceRoute(geometry, progress.progress01) }] }), [activeJobs, now])

  const allPoints = useMemo<SurfaceRoutePoint[]>(() => {
    const points: SurfaceRoutePoint[] = []
    if (terrainGrid?.size && terrainGrid.stepM) {
      const half = (terrainGrid.size - 1) * terrainGrid.stepM / 2
      points.push({ xM: -half, yM: -half }, { xM: half, yM: -half }, { xM: -half, yM: half }, { xM: half, yM: half })
    }
    for (const entity of [...entities, ...pendingBuilds]) { const x = finite(entity.x_m), y = finite(entity.y_m); if (x != null && y != null) points.push({ xM: x, yM: y }) }
    for (const node of nodes) points.push(node.point)
    for (const route of routes) points.push(...route.geometry.points)
    for (const corridor of corridors) points.push(...corridor.points)
    return points
  }, [terrainGrid, entities, pendingBuilds, nodes, routes, corridors])

  const worldBounds = useMemo(() => {
    if (!allPoints.length) return { centerX: 0, centerY: 0, spanX: minimumWorldSpanM, spanY: minimumWorldSpanM }
    const xs = allPoints.map(point => point.xM), ys = allPoints.map(point => point.yM)
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
    return { centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, spanX: Math.max(maxX - minX, minimumWorldSpanM) * 1.16, spanY: Math.max(maxY - minY, minimumWorldSpanM) * 1.16 }
  }, [allPoints, minimumWorldSpanM])
  const baseScale = useMemo(() => Math.min(Math.max(100, viewport.width - PAD * 2) / worldBounds.spanX, Math.max(100, viewport.height - PAD * 2) / worldBounds.spanY), [viewport, worldBounds])
  const project = useCallback((point: SurfaceRoutePoint) => ({ x: viewport.width / 2 + (point.xM - worldBounds.centerX) * baseScale, y: viewport.height / 2 - (point.yM - worldBounds.centerY) * baseScale }), [viewport, worldBounds, baseScale])
  const unproject = useCallback((x: number, y: number) => ({ xM: worldBounds.centerX + (x - viewport.width / 2) / baseScale, yM: worldBounds.centerY - (y - viewport.height / 2) / baseScale }), [viewport, worldBounds, baseScale])

  const clientToBase = (clientX: number, clientY: number) => {
    const svg = svgRef.current; if (!svg) return null
    const rect = svg.getBoundingClientRect(), sx = (clientX - rect.left) / rect.width * viewport.width, sy = (clientY - rect.top) / rect.height * viewport.height
    return { x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom }
  }
  const zoomAt = (nextZoom: number, clientX?: number, clientY?: number) => {
    const next = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM), svg = svgRef.current
    if (!svg || clientX == null || clientY == null) { setZoom(next); return }
    const rect = svg.getBoundingClientRect(), mx = (clientX - rect.left) / rect.width * viewport.width, my = (clientY - rect.top) / rect.height * viewport.height, ratio = next / zoom
    setPan(current => ({ x: mx - (mx - current.x) * ratio, y: my - (my - current.y) * ratio })); setZoom(next)
  }
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => { if (event.button !== 0 && event.pointerType === 'mouse') return; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, pan, moved: false } }
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => { const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return; const dx = event.clientX - drag.clientX, dy = event.clientY - drag.clientY; if (Math.hypot(dx, dy) > 3) drag.moved = true; setPan({ x: drag.pan.x + dx, y: drag.pan.y + dy }) }
  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current; dragRef.current = null; if (!drag || drag.pointerId !== event.pointerId) return
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch {}
    if (drag.moved) return
    const base = clientToBase(event.clientX, event.clientY); if (!base) return
    const spot = unproject(base.x, base.y); setSelectedSpot({ xM: Math.round(spot.xM), yM: Math.round(spot.yM) }); setSelectedWorldObjectId(null); setBuildMenuOpen(false); setSelectedBuildId(''); setRotationDeg(0); setBuildMessage(null)
  }

  const selectedTerrain = useMemo(() => {
    if (!selectedSpot || !terrainSurface) return null
    return analyzeLocalTerrainAt(terrainSurface, selectedSpot.xM, selectedSpot.yM, 2)
  }, [selectedSpot, terrainSurface])
  const terrainSuitability = selectedTerrain ? topographicSuitability(selectedTerrain.cell.slopeDeg, selectedTerrain.localReliefM) : null

  const placeBuilding = async () => {
    if (!selectedSpot || !selectedBuildId || placing) return
    setPlacing(true); setBuildMessage('Bauauftrag wird geprüft …')
    try {
      const token = await getToken(); if (!token) throw new Error('Nicht angemeldet')
      const response = await fetch('/api/game/build/spatial', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ buildableId: selectedBuildId, location: locationSlug, xM: selectedSpot.xM, yM: selectedSpot.yM, rotationDeg }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'Bauauftrag konnte nicht angelegt werden')
      setBuildMessage(`${selectedDef?.name ?? 'Gebäude'}: Bauauftrag angelegt`); setBuildMenuOpen(false); setSelectedBuildId(''); setRotationDeg(0); await load()
    } catch (error) { setBuildMessage(error instanceof Error ? error.message : String(error)) } finally { setPlacing(false) }
  }

  const visibleWidthM = Math.max(1, viewport.width / (baseScale * zoom))
  const targetScaleM = visibleWidthM / 5
  const scaleOptions = [1,2,5,10,20,50,100,200,500,1000,2000,5000]
  const scaleM = scaleOptions.reduce((best, value) => Math.abs(value - targetScaleM) < Math.abs(best - targetScaleM) ? value : best, 100)

  return <div className="planetary-shell">
    {message && <div className="planetary-notice">{message}</div>}
    <div className="planetary-map" ref={mapRef}>
      <svg ref={svgRef} viewBox={`0 0 ${viewport.width} ${viewport.height}`} preserveAspectRatio="none" role="application" aria-label={mapLabel} onWheel={event => { event.preventDefault(); zoomAt(zoom * (event.deltaY < 0 ? 1.18 : .84), event.clientX, event.clientY) }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { dragRef.current = null }}>
        <defs>
          <pattern id={`planetary-grid-${body}`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e1e1dc" strokeWidth=".7" opacity=".05"/></pattern>
          <filter id={`planetary-glow-${body}`}><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width={viewport.width} height={viewport.height} fill={body === 'mars' ? '#705448' : body === 'earth' ? '#59625a' : '#4e504d'}/>
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {layers.relief && <PlanetaryTerrainLayer body={body} grid={terrainGrid} project={project} pixelsPerMeter={baseScale} zoom={zoom} showContours showSlope/>}
          <rect width={viewport.width} height={viewport.height} fill={`url(#planetary-grid-${body})`} pointerEvents="none"/>
          {layers.infrastructure && corridors.map(corridor => {
            const points = corridor.points.map(point => { const p = project(point); return `${p.x},${p.y}` }).join(' ')
            const road = corridor.kind === 'hardened-road'
            return <g key={corridor.id} pointerEvents="none"><polyline points={points} fill="none" stroke="#252723" strokeWidth={(road ? 12 : 7) / zoom} strokeLinecap="round" strokeLinejoin="round" opacity=".42"/><polyline points={points} fill="none" stroke={road ? '#a59e8b' : '#8a8577'} strokeWidth={(road ? 7 : 4) / zoom} strokeLinecap="round" strokeLinejoin="round" opacity=".78"/></g>
          })}
          {layers.routes && routes.map(route => { const points = route.geometry.points.map(point => { const p = project(point); return `${p.x},${p.y}` }).join(' '), vehicle = project(route.vehiclePoint); return <g key={route.job.id}><polyline points={points} fill="none" stroke="#c09a3a" strokeWidth={3 / zoom} strokeDasharray={`${7 / zoom} ${5 / zoom}`} opacity=".75"/><circle cx={vehicle.x} cy={vehicle.y} r={7 / zoom} fill="#d7b44d" stroke="#fff5c9" strokeWidth={2 / zoom} filter={`url(#planetary-glow-${body})`}/></g> })}
          {layers.noxia && entities.map(entity => {
            const xM = finite(entity.x_m), yM = finite(entity.y_m); if (xM == null || yM == null) return null
            const p = project({ xM, yM }), width = Math.max(10 / zoom, Number(entity.footprint_width_m ?? 20) * baseScale), depth = Math.max(10 / zoom, Number(entity.footprint_depth_m ?? 20) * baseScale)
            const padMargin = Math.max(4 * baseScale, 3 / zoom), padW = width + padMargin * 2, padD = depth + padMargin * 2
            const visual = getBuildingVisual(entity.entity_id ?? '', locationSlug), spriteScale = visual?.mapScale ?? 1.45, spriteW = Math.max(width * spriteScale, 24 / zoom), spriteH = Math.max(Math.max(depth, width * .68) * spriteScale, 20 / zoom), selected = entity.id === selectedWorldObjectId
            return <g key={entity.id} role="button" aria-label={`${entity.name ?? entity.entity_id} auswählen`} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setSelectedWorldObjectId(entity.id); setSelectedSpot(null); setBuildMenuOpen(false); setSelectedBuildId('') }} style={{ cursor: 'pointer' }} transform={`translate(${p.x} ${p.y}) rotate(${-Number(entity.rotation_deg ?? 0)})`}>
              <rect x={-padW/2} y={-padD/2} width={padW} height={padD} rx={Math.max(2/zoom,2)} fill={body === 'moon' ? '#77776f' : '#72766d'} stroke={body === 'moon' ? '#aaa797' : '#9aa090'} strokeWidth={Math.max(.7/zoom,.55)} opacity=".88" pointerEvents="none"/>
              <path d={`M ${-padW/2} ${padD/2} L ${padW/2} ${padD/2}`} stroke="#2a2c28" strokeWidth={Math.max(2/zoom,1)} opacity=".28" pointerEvents="none"/>
              <ellipse cx={0} cy={depth * .2} rx={Math.max(width * .48, 5 / zoom)} ry={Math.max(depth * .22, 2.2 / zoom)} fill="#171916" opacity=".32" pointerEvents="none"/>
              {selected && <rect x={-padW/2} y={-padD/2} width={padW} height={padD} fill="#fff4bd" fillOpacity=".08" stroke="#e2b946" strokeWidth={2.5/zoom}/>} 
              {visual?.mapAsset ? <image href={visual.mapAsset} x={-spriteW/2} y={depth/2-spriteH} width={spriteW} height={spriteH} preserveAspectRatio="xMidYMax meet" pointerEvents="none"/> : <rect x={-width/2} y={-depth/2} width={width} height={depth} rx={2/zoom} fill="#345f68" stroke="#183b43" strokeWidth={1.2/zoom}/>} 
              <rect x={-Math.max(padW,26/zoom)/2} y={-Math.max(padD,22/zoom)/2} width={Math.max(padW,26/zoom)} height={Math.max(padD,22/zoom)} fill="transparent" pointerEvents="all"/>
            </g>
          })}
          {layers.noxia && pendingBuilds.map(build => { const x = finite(build.x_m), y = finite(build.y_m); if (x == null || y == null) return null; const p=project({xM:x,yM:y}), w=Number(build.footprint_width_m??20)*baseScale,d=Number(build.footprint_depth_m??20)*baseScale; return <g key={build.id} transform={`translate(${p.x} ${p.y}) rotate(${-Number(build.rotation_deg??0)})`}><rect x={-w/2} y={-d/2} width={w} height={d} fill="#d9a63d" fillOpacity=".3" stroke="#f0c45a" strokeWidth={1.5/zoom} strokeDasharray={`${4/zoom} ${3/zoom}`}/></g> })}
          {layers.logistics && nodes.map(node => { const p=project(node.point); return <circle key={node.inventory.id} cx={p.x} cy={p.y} r={4/zoom} fill="#314d57" stroke="#f4f1e6" strokeWidth={1/zoom}/> })}
          {selectedSpot && (() => { const p=project(selectedSpot), w=selectedDef?selectedDef.footprint.widthM*baseScale:18/zoom,d=selectedDef?selectedDef.footprint.depthM*baseScale:18/zoom; return <g transform={`translate(${p.x} ${p.y}) rotate(${-rotationDeg})`} pointerEvents="none">{selectedDef?<rect x={-w/2} y={-d/2} width={w} height={d} fill="#f2cc4d" fillOpacity=".28" stroke="#f6d66c" strokeWidth={2/zoom}/>:<circle r={10/zoom} fill="#f5d75f" fillOpacity=".25" stroke="#f6d66c" strokeWidth={2/zoom}/>}</g> })()}
        </g>
      </svg>

      <div className="planetary-tools"><div className="compass"><span>N</span><b>↑</b></div><div className="scale"><span>{scaleM >= 1000 ? `${scaleM/1000} km` : `${scaleM} m`}</span><i style={{width:`${Math.max(26,Math.min(150,scaleM*baseScale*zoom))}px`}}/></div><div className="camera"><button onClick={resetView}>Zentrieren</button><button onClick={()=>zoomAt(zoom*1.35)}>+</button><button onClick={()=>zoomAt(zoom/1.35)}>−</button></div></div>
      <div className="layers"><button className="layer-trigger" onClick={()=>setLayersOpen(value=>!value)}>☷ Layer</button>{layersOpen&&<div className="layer-menu">{([['relief','Relief · Konturen · Hang'],['infrastructure','Infrastruktur'],['noxia','NOXIA-Bauten'],['routes','Transportrouten'],['logistics','Logistikknoten']] as [LayerKey,string][]).map(([key,label])=><button key={key} className={layers[key]?'active':''} onClick={()=>setLayers(current=>({...current,[key]:!current[key]}))}><span>{layers[key]?'●':'○'}</span>{label}</button>)}</div>}</div>

      {selectedSpot && <aside className="site-panel"><div className="panel-head"><div><small>AUSGEWÄHLTE STELLE</small><strong>{selectedTerrain?'Topographie analysiert':'Terrain noch nicht aufgelöst'}</strong></div><button onClick={()=>{setSelectedSpot(null);setBuildMenuOpen(false);setSelectedBuildId('')}}>×</button></div>{terrainSuitability&&<div className={`terrain-assessment ${terrainSuitability.className}`}><span>Topographische Vorprüfung</span><b>{terrainSuitability.label}</b><small>{terrainSuitability.note}</small></div>}<div className="facts"><div><span>Position</span><b>{selectedSpot.xM.toFixed(0)} m E · {selectedSpot.yM.toFixed(0)} m N</b></div><div><span>Höhe</span><b>{selectedTerrain?`${selectedTerrain.cell.elevationM.toFixed(1)} m`:'–'}</b></div><div><span>Hangneigung</span><b>{selectedTerrain?`${selectedTerrain.cell.slopeDeg.toFixed(1)}°`:'–'}</b></div><div><span>Gefälle</span><b>{selectedTerrain?`${cardinalDirection(selectedTerrain.cell.downhillAzimuthDeg)} · ${selectedTerrain.cell.downhillAzimuthDeg.toFixed(0)}°`:'–'}</b></div><div><span>Lokales Relief</span><b>{selectedTerrain?`${selectedTerrain.localReliefM.toFixed(1)} m / ~${Math.round(selectedTerrain.sampleRadiusM*2)} m`:'–'}</b></div><div><span>Terrainauflösung</span><b>{terrainGrid?`Quelle ≈ ${terrainGrid.stepM} m · Darstellung ≈ ${terrainSurface?.stepM.toFixed(1) ?? '–'} m`:'–'}</b></div><div><span>Quelle</span><b>{spatial?.terrain?.activeDataset?.dataset_name??terrainLabel}</b></div></div><div className="terrain-note">Die Vorprüfung bewertet nur die lokale Topographie. Die verbindliche Baufreigabe erfolgt erst beim Bauauftrag durch die vorhandene Buildability-/Kollisionsprüfung.</div>{buildMessage&&<div className="notice">{buildMessage}</div>}{!buildMenuOpen?<button className="primary" onClick={()=>setBuildMenuOpen(true)}>Bauen</button>:selectedDef?<div className="editor"><div><b>{selectedDef.name}</b><span>{selectedDef.cost.toLocaleString('de-DE')} Cr</span></div><div className="rotation"><button onClick={()=>setRotationDeg(normalizeRotation(rotationDeg-15))}>−15°</button><b>{rotationDeg}°</b><button onClick={()=>setRotationDeg(normalizeRotation(rotationDeg+15))}>+15°</button></div><button className="primary" disabled={placing||!(selectedDef.requirements?.canBuild??true)} onClick={()=>void placeBuilding()}>{placing?'Prüfe …':'Jetzt bauen'}</button><button className="link" onClick={()=>setSelectedBuildId('')}>anderes Gebäude</button></div>:<div className="build-list">{available.map(def=><button key={def.id} disabled={!(def.requirements?.canBuild??true)} onClick={()=>{setSelectedBuildId(def.id);setRotationDeg(0)}}><strong>{def.name}</strong><span>{def.footprint.widthM}×{def.footprint.depthM} m · {def.cost.toLocaleString('de-DE')} Cr</span></button>)}</div>}</aside>}
      {selectedWorldObject && <aside className="object-panel"><div className="panel-head"><div><small>GEBÄUDE</small><strong>{selectedWorldObject.name??selectedWorldObject.entity_id}</strong></div><button onClick={()=>setSelectedWorldObjectId(null)}>×</button></div><div className="facts"><div><span>Status</span><b>{statusLabel(selectedWorldObject.status)}</b></div><div><span>Eigentum</span><b>{selectedWorldObject.ownerLabel??(selectedWorldObject.isOwn?'Dein Gebäude':'Weltobjekt')}</b></div><div><span>Position</span><b>{Number(selectedWorldObject.x_m??0).toFixed(0)} m E · {Number(selectedWorldObject.y_m??0).toFixed(0)} m N</b></div></div><button className="primary" onClick={()=>onOpenWorldObject?.(selectedWorldObject)}>{actionLabel(selectedWorldObject.entity_id)} →</button></aside>}
      <div className="help">{selectedWorldObject?'Gebäude gewählt · links öffnen':selectedSpot?'Stelle gewählt · Topographie prüfen · Bauen':'Stelle anklicken · Mausrad: Zoom · Ziehen: Karte'}</div>
    </div>

    <style jsx>{`
      .planetary-shell{height:100%;min-height:0;color:#1f3440;font-family:system-ui,sans-serif}.planetary-map{position:relative;width:100%;height:calc(100dvh - var(--noxia-topbar-h,44px));min-height:520px;overflow:hidden;background:#4e504d;touch-action:none;cursor:grab}.planetary-map:active{cursor:grabbing}.planetary-map svg{width:100%;height:100%;display:block}.planetary-notice{position:absolute;z-index:20;left:50%;top:14px;transform:translateX(-50%);padding:8px 12px;border-radius:7px;background:#f7e4d8;border:1px solid #c48a6c;color:#78462f}.planetary-tools{position:absolute;left:16px;top:14px;z-index:8;display:flex;align-items:flex-start;gap:10px;color:#edf3f0;text-shadow:0 1px 4px #000}.compass{width:30px;height:38px;display:grid;place-items:center;position:relative}.compass span{position:absolute;top:0;font-size:10px;font-weight:900}.compass b{font-size:26px;line-height:1;margin-top:8px}.scale{min-width:76px;padding-top:2px}.scale span{display:block;font-size:10px;font-weight:900;margin-bottom:3px;text-align:center}.scale i{display:block;height:7px;border-left:2px solid currentColor;border-right:2px solid currentColor;border-bottom:3px solid currentColor}.camera{display:flex;gap:4px}.camera button,.layer-trigger{border:1px solid #56696c;background:#f5f2e8eb;color:#17313c;border-radius:7px;padding:6px 9px;font-size:10px;font-weight:850;cursor:pointer}.camera button+button{min-width:31px;font-size:15px;padding:3px 7px}.layers{position:absolute;right:14px;top:14px;z-index:9}.layer-trigger{background:#102632e8;color:#eef3ef}.layer-menu{margin-top:6px;width:210px;padding:6px;background:#0b1c27ed;border:1px solid #405965;border-radius:9px}.layer-menu button{width:100%;display:flex;gap:8px;border:0;background:transparent;color:#9fb2b8;padding:7px 8px;text-align:left;border-radius:5px;cursor:pointer}.layer-menu button.active{background:#173746;color:#f2e7ba}.site-panel,.object-panel{position:absolute;left:14px;bottom:calc(var(--noxia-cockpit-clearance,76px) + 14px);z-index:10;width:min(440px,calc(100% - 28px));max-height:calc(100% - var(--noxia-cockpit-clearance,76px) - 58px);overflow:auto;padding:13px;box-sizing:border-box;border:1px solid #a8893d;border-radius:11px;background:#fffaf0f5;box-shadow:0 10px 34px #0005;backdrop-filter:blur(8px)}.object-panel{border-color:#567986}.panel-head{display:flex;justify-content:space-between;gap:12px}.panel-head small{display:block;color:#89691b;font-size:9px;font-weight:900;letter-spacing:.12em}.panel-head strong{display:block;margin-top:2px;font-size:15px}.panel-head>button{border:0;background:none;font-size:20px;cursor:pointer}.terrain-assessment{display:grid;grid-template-columns:1fr auto;gap:2px 10px;margin-top:10px;padding:9px;border-radius:7px;border:1px solid #b9b090;background:#f3efe1}.terrain-assessment span{font-size:9px;color:#6e756f}.terrain-assessment b{font-size:11px}.terrain-assessment small{grid-column:1/-1;font-size:9px;color:#65706d}.terrain-assessment.good{border-color:#819b78;background:#edf4e8}.terrain-assessment.moderate{border-color:#b7a56f;background:#f5f0dc}.terrain-assessment.difficult{border-color:#ba8c59;background:#f7e8d8}.terrain-assessment.critical{border-color:#b36c5d;background:#f5ddd8}.facts{display:grid;gap:5px;margin-top:9px}.facts>div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #e4ddc8;padding:5px 2px;font-size:10px}.facts span{color:#6c7879}.facts b{text-align:right}.terrain-note{margin-top:8px;padding:7px 8px;border-radius:6px;background:#edf0e8;color:#68777e;font-size:9px;line-height:1.4}.primary{width:100%;margin-top:11px;border:1px solid #486d7a;background:#173f4e;color:#fff;border-radius:7px;padding:9px 12px;font-weight:900;cursor:pointer}.primary:disabled{opacity:.5}.notice{margin-top:8px;padding:8px;background:#f6e9c2;border:1px solid #c8a452;border-radius:6px;font-size:10px}.build-list{display:grid;gap:6px;margin-top:10px;max-height:280px;overflow:auto}.build-list button{display:grid;gap:3px;text-align:left;padding:8px;border:1px solid #d5c899;border-radius:7px;background:#fffdf4;color:#263943;cursor:pointer}.build-list button:disabled{opacity:.45}.build-list span{font-size:9px}.editor{display:grid;gap:8px;margin-top:10px}.editor>div:first-child,.rotation{display:flex;justify-content:space-between;align-items:center;gap:8px}.rotation button,.link{border:1px solid #b6aa84;background:#fffdf4;border-radius:6px;padding:6px 8px;cursor:pointer}.link{border:0;text-decoration:underline;color:#6d5b2b}.help{position:absolute;left:14px;bottom:12px;z-index:8;padding:6px 9px;border:1px solid #506873;border-radius:6px;background:#102632db;color:#eef3ef;font-size:9px;pointer-events:none}@media(max-width:900px){.planetary-map{min-height:480px}.planetary-tools{gap:6px}.site-panel,.object-panel{width:calc(100% - 28px)}}
    `}</style>
  </div>
}
