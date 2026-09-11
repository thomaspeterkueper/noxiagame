'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { SHACKLETON_SURFACE_LOGISTICS_CHAIN } from '@/lib/game/moonSurfaceLogistics'
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
  status?: string | null
}

type SpatialPayload = {
  location?: { id: string; slug: string; name: string }
  frame?: { origin_status?: string | null; terrain_dataset_id?: string | null } | null
  terrain?: { activeDataset?: { id?: string; dataset_name?: string; status?: string } | null }
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

type MapNode = {
  inventory: Inventory
  point: SurfaceRoutePoint
}

type MapRoute = {
  job: TransportJob
  geometry: SurfaceRouteGeometry
  vehiclePoint: SurfaceRoutePoint
  progress01: number
}

const ACTIVE = new Set(['reserved', 'loading', 'in_transit', 'arrived', 'unloading'])
const VIEW_W = 1000
const VIEW_H = 620
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
    const spanX = Math.max(maxX - minX, 100)
    const spanY = Math.max(maxY - minY, 100)
    return { minX, minY, spanX, spanY }
  }, [allPoints])

  const project = (point: SurfaceRoutePoint) => {
    if (!bounds) return { x: VIEW_W / 2, y: VIEW_H / 2 }
    return {
      x: PAD + ((point.xM - bounds.minX) / bounds.spanX) * (VIEW_W - PAD * 2),
      y: VIEW_H - PAD - ((point.yM - bounds.minY) / bounds.spanY) * (VIEW_H - PAD * 2),
    }
  }

  const inventoryById = useMemo(() => new Map(inventories.map(item => [item.id, item])), [inventories])

  return <main className="moon-shell">
    <header className="hero">
      <div>
        <small>MOON · SHACKLETON · SURFACE LOGISTICS</small>
        <h1>Shackleton</h1>
        <p>Persistierte Core-Transporte auf der verifizierten lokalen Mondgeometrie. Die Karte simuliert keinen eigenen Fahrzeugzustand.</p>
      </div>
      <div className="terrain-state">
        <span>Terrain</span>
        <b>{spatial?.terrain?.activeDataset?.status ?? spatial?.frame?.origin_status ?? 'unresolved'}</b>
        <small>{spatial?.terrain?.activeDataset?.dataset_name ?? spatial?.frame?.terrain_dataset_id ?? 'LOLA-Datensatz noch nicht aufgelöst'}</small>
      </div>
    </header>

    {message && <div className="notice">{message}</div>}

    <section className="map-card">
      <div className="map-head">
        <div><small>LOKALES ENU-FRAME</small><h2>Oberflächenlogistik</h2></div>
        <div className="counts"><span>{nodes.length} Knoten</span><span>{activeJobs.length} aktive Aufträge</span></div>
      </div>

      {bounds ? <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="Shackleton Oberflächenlogistik-Karte">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#33434d" strokeWidth="0.7" opacity="0.45" />
          </pattern>
          <filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} fill="#0b1218" rx="16" />
        <rect width={VIEW_W} height={VIEW_H} fill="url(#grid)" rx="16" />

        {routes.map(route => {
          const points = route.geometry.points.map(point => {
            const p = project(point)
            return `${p.x},${p.y}`
          }).join(' ')
          const vehicle = project(route.vehiclePoint)
          return <g key={route.job.id}>
            <polyline points={points} fill="none" stroke="#c8a75a" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
            <polyline points={points} fill="none" stroke="#f1d78d" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
            <circle cx={vehicle.x} cy={vehicle.y} r="10" fill="#f2c65d" stroke="#fff0bd" strokeWidth="2" filter="url(#glow)" />
          </g>
        })}

        {nodes.map(node => {
          const p = project(node.point)
          return <g key={node.inventory.id}>
            <circle cx={p.x} cy={p.y} r="8" fill="#9fb2bd" stroke="#e5edf1" strokeWidth="1.5" />
            <text x={p.x + 13} y={p.y - 8} fill="#e5edf1" fontSize="13" fontWeight="700">{node.inventory.label}</text>
            <text x={p.x + 13} y={p.y + 9} fill="#81949f" fontSize="10">{node.inventory.inventory_kind}</text>
          </g>
        })}
      </svg> : <div className="empty-map">
        Noch keine räumlich aufgelösten Moon-Logistikknoten. Die Ansicht erfindet keine Ersatzkoordinaten.
      </div>}

      {activeJobs.length > routes.length && <div className="geometry-note">
        {activeJobs.length - routes.length} aktive Surface-Auftrag{activeJobs.length - routes.length === 1 ? '' : 'e'} besitzt/besitzen noch keine persistierte <code>route_snapshot.geometry</code>. Der Status wird unten gezeigt, aber ohne erfundene Kartenlinie.
      </div>}
    </section>

    <section className="jobs-card">
      <div className="section-title"><small>CORE STATE MACHINE</small><h2>Aktive Transporte</h2></div>
      {!activeJobs.length && <div className="empty">Noch kein aktiver Moon-Surface-Transport. Ein Cargo Rover wird erst erzeugt, wenn die Engineering-Framewerte kanonisch vorliegen.</div>}
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
          <div className="facts">
            <span><b>{percent}%</b> Fahrt</span>
            <span><b>{progress.travelledKm == null ? '–' : progress.travelledKm.toFixed(2)} km</b> gefahren</span>
            <span><b>{formatRemaining(progress.remainingSeconds)}</b> verbleibend</span>
          </div>
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
      .moon-shell{min-height:100vh;background:#070b0f;color:#e8edf0;padding:28px;font-family:system-ui,sans-serif}.hero,.map-card,.jobs-card,.chain-card{max-width:1400px;margin:0 auto 18px}.hero{display:flex;justify-content:space-between;gap:24px;align-items:end}.hero small,.section-title small,.map-head small{font-size:10px;letter-spacing:.16em;color:#c8a75a;font-weight:800}.hero h1{font-family:Georgia,serif;font-size:44px;font-weight:400;margin:3px 0}.hero p{max-width:760px;margin:0;color:#8d9aa2;font-size:13px}.terrain-state{min-width:250px;background:#101920;border:1px solid #293943;border-radius:12px;padding:12px}.terrain-state span,.terrain-state small{display:block;color:#82929c;font-size:10px}.terrain-state b{display:block;color:#dfe7eb;margin:4px 0}.map-card,.jobs-card,.chain-card{background:#0e171d;border:1px solid #293943;border-radius:16px;padding:16px}.map-head,.section-title{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:12px}.map-head h2,.section-title h2{font-family:Georgia,serif;font-weight:400;margin:2px 0 0;font-size:24px}.counts{display:flex;gap:8px}.counts span{font-size:10px;padding:5px 8px;background:#15232b;border-radius:999px;color:#a7b4ba}.map-card svg{width:100%;display:block;border:1px solid #26353e;border-radius:16px}.empty-map,.empty,.notice,.geometry-note{padding:16px;background:#121f27;border:1px dashed #344650;border-radius:10px;color:#8fa0a9;font-size:12px}.notice{background:#3d2527;color:#f0c7c3;border-style:solid}.geometry-note{margin-top:10px;padding:10px}.geometry-note code{color:#d7c17e}.job-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:10px}.job{background:#111f27;border:1px solid #30424c;border-radius:12px;padding:12px}.job.moving{border-color:#756434}.job.arrived{border-color:#546b51}.job-head,.endpoints,.facts{display:flex;justify-content:space-between;gap:10px}.job-head span{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#d5bd7d}.cargo{font-size:11px;color:#91a1aa;margin:4px 0 12px}.endpoints{font-size:10px;color:#aeb9be}.endpoints b{color:#c8a75a}.rail{height:7px;background:#071116;border-radius:999px;margin:10px 0;overflow:hidden}.rail div{height:100%;background:#b89950}.facts span{font-size:9px;color:#768a95}.facts b{display:block;color:#dce4e7;font-size:11px}.chain{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.chain-node{display:flex;gap:9px;background:#111f27;border:1px solid #293943;border-radius:10px;padding:10px}.chain-node>span{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#c8a75a;color:#101417;font-weight:900;font-size:11px;flex:0 0 auto}.chain-node strong{display:block;font-size:11px}.chain-node small{display:block;color:#7f919b;font-size:9px;margin-top:4px;line-height:1.35}@media(max-width:760px){.moon-shell{padding:14px}.hero{align-items:stretch;flex-direction:column}.terrain-state{min-width:0}.chain{grid-template-columns:1fr 1fr}.facts{flex-direction:column}.map-head{align-items:start;flex-direction:column}}@media(max-width:480px){.chain{grid-template-columns:1fr}}
    `}</style>
  </main>
}
