'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { localMetersToGeo } from '@/lib/world/spatial/earthSpatial'
import { deriveSurfaceMissionProgress } from '@/lib/game/vehicles/surfaceProgress'
import {
  parseSurfaceRouteGeometry,
  pointAlongSurfaceRoute,
  type SurfaceRoutePoint,
} from '@/lib/game/vehicles/surfaceRouteGeometry'

type GeoPoint = { lat: number; lon: number }

type MapProjection = {
  x: (lon: number) => number
  y: (lat: number) => number
}

type TransportJob = {
  id: string
  domain: string
  vehicle_role: string | null
  resource: string
  amount: number
  status: string
  route_snapshot?: Record<string, unknown> | null
  started_at?: string | null
  arrives_at?: string | null
}

type LogisticsPayload = {
  jobs?: TransportJob[]
}

type ProjectedRoute = {
  job: TransportJob
  points: Array<{ x: number; y: number }>
  vehicle: { x: number; y: number }
  progress01: number
}

const ACTIVE_SURFACE_STATUSES = new Set(['reserved', 'loading', 'in_transit', 'arrived', 'unloading'])

function finite(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function routeOrigin(snapshot: Record<string, unknown> | null | undefined): GeoPoint | null {
  const raw = snapshot?.earthSpatialOrigin
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const candidate = raw as Record<string, unknown>
  const lat = finite(candidate.lat)
  const lon = finite(candidate.lon)
  return lat == null || lon == null ? null : { lat, lon }
}

function projectPoint(point: SurfaceRoutePoint, origin: GeoPoint, projection: MapProjection) {
  const geo = localMetersToGeo({ eastM: point.xM, northM: point.yM }, origin)
  return { x: projection.x(geo.lon), y: projection.y(geo.lat) }
}

export default function EarthSurfaceLogisticsOverlay({
  locationId,
  projection,
  zoom,
}: {
  locationId?: string | null
  projection: MapProjection | null
  zoom: number
}) {
  const [jobs, setJobs] = useState<TransportJob[]>([])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!locationId) return

    let cancelled = false
    let timer: number | null = null

    const load = async () => {
      try {
        const token = await getToken()
        if (!token) return
        const response = await fetch(`/api/game/logistics?locationId=${encodeURIComponent(locationId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        if (!response.ok) return
        const payload = await response.json() as LogisticsPayload
        if (!cancelled) setJobs(payload.jobs ?? [])
      } catch {
        // The map stays usable if the read-only logistics overlay cannot refresh.
      }
    }

    void load()
    timer = window.setInterval(() => void load(), 15_000)
    return () => {
      cancelled = true
      if (timer != null) window.clearInterval(timer)
    }
  }, [locationId])

  const routes = useMemo<ProjectedRoute[]>(() => {
    if (!projection) return []

    return jobs
      .filter(job => job.domain === 'surface' && ACTIVE_SURFACE_STATUSES.has(job.status))
      .flatMap(job => {
        const geometry = parseSurfaceRouteGeometry(job.route_snapshot)
        const origin = routeOrigin(job.route_snapshot)
        if (!geometry || !origin) return []

        const progress = deriveSurfaceMissionProgress(job, now)
        const vehiclePoint = pointAlongSurfaceRoute(geometry, progress.progress01)
        return [{
          job,
          points: geometry.points.map(point => projectPoint(point, origin, projection)),
          vehicle: projectPoint(vehiclePoint, origin, projection),
          progress01: progress.progress01,
        }]
      })
  }, [jobs, now, projection])

  if (!routes.length) return null

  return <g className="earth-surface-logistics-overlay" pointerEvents="none" aria-label="Surface-Logistik">
    {routes.map(route => {
      const points = route.points.map(point => `${point.x},${point.y}`).join(' ')
      const start = route.points[0]
      const destination = route.points.at(-1)!
      return <g key={route.job.id}>
        <title>{`${route.job.vehicle_role ?? 'Surface-Fahrzeug'} · ${route.job.resource} ${route.job.amount} · ${Math.round(route.progress01 * 100)}%`}</title>
        <polyline
          points={points}
          fill="none"
          stroke="#72520f"
          strokeWidth={5 / zoom}
          strokeOpacity=".42"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#e1b83f"
          strokeWidth={2.2 / zoom}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={start.x} cy={start.y} r={5.5 / zoom} fill="#f7efc7" stroke="#72520f" strokeWidth={1.6 / zoom} />
        <circle cx={destination.x} cy={destination.y} r={5.5 / zoom} fill="#173f49" stroke="#f7efc7" strokeWidth={1.6 / zoom} />
        <circle cx={route.vehicle.x} cy={route.vehicle.y} r={7 / zoom} fill="#f1c75f" stroke="#173845" strokeWidth={2.2 / zoom} />
      </g>
    })}
  </g>
}
