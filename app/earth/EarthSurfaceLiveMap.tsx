'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { deriveSurfaceMissionProgress } from '@/lib/game/vehicles/surfaceProgress'
import {
  parseSurfaceRouteGeometry,
  pointAlongSurfaceRoute,
  type SurfaceRouteGeometry,
  type SurfaceRoutePoint,
} from '@/lib/game/vehicles/surfaceRouteGeometry'

type SpatialEntity = {
  id: string
  entity_id?: string | null
  name?: string | null
  x_m?: number | null
  y_m?: number | null
}

type SpatialPayload = {
  location?: { id: string; slug: string; name: string }
  entities?: SpatialEntity[]
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
  remainingSeconds: number | null
}

const ACTIVE = new Set(['reserved', 'loading', 'in_transit', 'arrived', 'unloading'])
const VIEW_W = 1000
const VIEW_H = 520
const PAD = 54

function finite(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
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

function formatRemaining(seconds: number | null) {
  if (seconds == null) return '–'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

export default function EarthSurfaceLiveMap() {
  const [spatial, setSpatial] = useState<SpatialPayload | null>(null)
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [jobs, setJobs] = useState<TransportJob[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null

    const load = async () => {
      try {
        const token = await getToken()
        if (!token) throw new Error('Nicht angemeldet')
        const headers = { Authorization: `Bearer ${token}` }
        const spatialResponse = await fetch('/api/game/build/spatial?location=earth', { headers, cache: 'no-store' })
        const spatialPayload = await spatialResponse.json() as SpatialPayload
        if (!spatialResponse.ok || !spatialPayload.location?.id) throw new Error(spatialPayload.error ?? 'Earth-Standort nicht verfügbar')

        const logisticsResponse = await fetch(`/api/game/logistics?locationId=${encodeURIComponent(spatialPayload.location.id)}`, {
          headers,
          cache: 'no-store',
        })
        const logisticsPayload = await logisticsResponse.json() as LogisticsPayload
        if (!logisticsResponse.ok) throw new Error(logisticsPayload.error ?? 'Earth-Logistik nicht verfügbar')
        if (cancelled) return
        setSpatial(spatialPayload)
        setInventories(logisticsPayload.inventories ?? [])
        setJobs(logisticsPayload.jobs ?? [])
        setMessage(null)
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : String(error))
      }
    }

    void load()
    timer = window.setInterval(() => void load(), 15_000)
    return () => {
      cancelled = true
      if (timer != null) window.clearInterval(timer)
    }
  }, [])

  const entities = spatial?.entities ?? []
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
    return [{
      job,
      geometry,
      progress01: progress.progress01,
      remainingSeconds: progress.remainingSeconds,
      vehiclePoint: pointAlongSurfaceRoute(geometry, progress.progress01),
    }]
  }), [activeJobs, now])

  const allPoints = useMemo(() => [
    ...nodes.map(node => node.point),
    ...routes.flatMap(route => route.geometry.points),
  ], [nodes, routes])

  const bounds = useMemo(() => {
    if (!allPoints.length) return null
    const xs = allPoints.map(point => point.xM)
    const ys = allPoints.map(point => point.yM)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    return {
      minX,
      minY,
      spanX: Math.max(maxX - minX, 100),
      spanY: Math.max(maxY - minY, 100),
    }
  }, [allPoints])

  const project = (point: SurfaceRoutePoint) => {
    if (!bounds) return { x: VIEW_W / 2, y: VIEW_H / 2 }
    return {
      x: PAD + ((point.xM - bounds.minX) / bounds.spanX) * (VIEW_W - PAD * 2),
      y: VIEW_H - PAD - ((point.yM - bounds.minY) / bounds.spanY) * (VIEW_H - PAD * 2),
    }
  }

  const inventoryById = useMemo(() => new Map(inventories.map(item => [item.id, item])), [inventories])

  return <section className="earth-live-map">
    <header>
      <div><small>EARTH · SURFACE VEHICLES · CORE LIVE</small><h2>Fahrzeuge auf realer Route</h2><p>Nur persistierte Route-Geometrie und Core-Zeitstempel; keine lokale Bewegungs-Simulation.</p></div>
      <div className="counts"><b>{routes.length}</b><span>sichtbare Fahrten</span></div>
    </header>

    {message && <div className="notice error">{message}</div>}

    {bounds ? <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="Earth Surface Fahrzeugkarte">
      <defs>
        <pattern id="earth-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#31505b" strokeWidth="0.7" opacity="0.35" /></pattern>
        <filter id="earth-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width={VIEW_W} height={VIEW_H} rx="14" fill="#0b202a" />
      <rect width={VIEW_W} height={VIEW_H} rx="14" fill="url(#earth-grid)" />
      {routes.map(route => {
        const points = route.geometry.points.map(point => {
          const p = project(point)
          return `${p.x},${p.y}`
        }).join(' ')
        const vehicle = project(route.vehiclePoint)
        return <g key={route.job.id}>
          <polyline points={points} fill="none" stroke="#d0aa47" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
          <polyline points={points} fill="none" stroke="#f0d787" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={vehicle.x} cy={vehicle.y} r="10" fill="#f1c75f" stroke="#fff1be" strokeWidth="2" filter="url(#earth-glow)" />
        </g>
      })}
      {nodes.map(node => {
        const p = project(node.point)
        return <g key={node.inventory.id}>
          <circle cx={p.x} cy={p.y} r="7" fill="#83a6a0" stroke="#dbe8e4" strokeWidth="1.5" />
          <text x={p.x + 12} y={p.y - 7} fill="#e8efec" fontSize="12" fontWeight="700">{node.inventory.label}</text>
        </g>
      })}
    </svg> : <div className="empty">Noch keine räumlich aufgelösten Earth-Logistikknoten oder persistierten Routen.</div>}

    {activeJobs.length > routes.length && <div className="notice">{activeJobs.length - routes.length} aktive Surface-Fahrt{activeJobs.length - routes.length === 1 ? '' : 'en'} hat/haben noch keine persistierte <code>route_snapshot.geometry</code>. Es wird keine Ersatzroute erzeugt.</div>}

    <div className="jobs">{routes.map(route => {
      const source = inventoryById.get(route.job.source_inventory_id)?.label ?? route.job.source_inventory_id.slice(0, 8)
      const destination = inventoryById.get(route.job.destination_inventory_id)?.label ?? route.job.destination_inventory_id.slice(0, 8)
      return <article key={route.job.id}>
        <strong>{route.job.vehicle_role ?? 'Surface-Fahrzeug'}</strong>
        <span>{source} → {destination}</span>
        <span>{Math.round(route.progress01 * 100)}% · {formatRemaining(route.remainingSeconds)} verbleibend</span>
      </article>
    })}</div>

    <style jsx>{`
      .earth-live-map{max-width:1500px;margin:18px auto;padding:16px;box-sizing:border-box;background:#102632;color:#e7ece8;border:1px solid #425d67;border-radius:13px;font-family:system-ui,sans-serif}.earth-live-map header{display:flex;justify-content:space-between;gap:18px;align-items:start;margin-bottom:12px}.earth-live-map header small{font-size:9px;letter-spacing:.16em;color:#d1ad55;font-weight:900}.earth-live-map h2{font-family:Georgia,serif;font-weight:400;font-size:23px;margin:3px 0}.earth-live-map header p{margin:0;color:#9fb0b5;font-size:10px}.counts{text-align:right}.counts b{display:block;font-size:26px;color:#f0cc6c}.counts span{font-size:8px;color:#9fb0b5;text-transform:uppercase}svg{width:100%;height:auto;display:block;border:1px solid #35525d;border-radius:14px}.notice,.empty{margin-top:10px;padding:10px;border-radius:7px;background:#173541;color:#aabcc1;font-size:9px}.notice.error{background:#532f31;color:#f2d6d2}.jobs{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:7px;margin-top:10px}.jobs article{display:grid;gap:3px;background:#0d2530;border-radius:7px;padding:8px}.jobs strong{font-size:10px}.jobs span{font-size:8px;color:#8fa2a8}code{color:#e4c76e}@media(max-width:700px){.earth-live-map header{flex-direction:column}.counts{text-align:left}}
    `}</style>
  </section>
}
