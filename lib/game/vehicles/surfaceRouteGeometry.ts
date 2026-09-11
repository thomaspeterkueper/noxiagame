export interface SurfaceRoutePoint {
  xM: number
  yM: number
  zM?: number | null
}

export interface SurfaceRouteGeometry {
  frame: 'local-world-meters'
  points: SurfaceRoutePoint[]
}

function finite(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

export function parseSurfaceRouteGeometry(snapshot: Record<string, unknown> | null | undefined): SurfaceRouteGeometry | null {
  if (!snapshot) return null
  const raw = snapshot.geometry
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const candidate = raw as Record<string, unknown>
  if (candidate.frame !== 'local-world-meters' || !Array.isArray(candidate.points) || candidate.points.length < 2) return null

  const points: SurfaceRoutePoint[] = []
  for (const rawPoint of candidate.points) {
    if (!rawPoint || typeof rawPoint !== 'object' || Array.isArray(rawPoint)) return null
    const point = rawPoint as Record<string, unknown>
    const xM = finite(point.xM)
    const yM = finite(point.yM)
    if (xM == null || yM == null) return null
    const zM = point.zM == null ? null : finite(point.zM)
    if (point.zM != null && zM == null) return null
    points.push({ xM, yM, zM })
  }

  return { frame: 'local-world-meters', points }
}

export function surfaceRouteGeometryLengthM(geometry: SurfaceRouteGeometry) {
  let total = 0
  for (let index = 1; index < geometry.points.length; index += 1) {
    const previous = geometry.points[index - 1]
    const current = geometry.points[index]
    total += Math.hypot(current.xM - previous.xM, current.yM - previous.yM)
  }
  return total
}

export function pointAlongSurfaceRoute(geometry: SurfaceRouteGeometry, progress01: number): SurfaceRoutePoint {
  const progress = Math.max(0, Math.min(1, progress01))
  const total = surfaceRouteGeometryLengthM(geometry)
  if (!(total > 0)) return { ...geometry.points[0] }

  let remaining = total * progress
  for (let index = 1; index < geometry.points.length; index += 1) {
    const previous = geometry.points[index - 1]
    const current = geometry.points[index]
    const segment = Math.hypot(current.xM - previous.xM, current.yM - previous.yM)
    if (remaining <= segment || index === geometry.points.length - 1) {
      const ratio = segment > 0 ? Math.max(0, Math.min(1, remaining / segment)) : 0
      const previousZ = previous.zM ?? null
      const currentZ = current.zM ?? null
      const zM = previousZ != null && currentZ != null
        ? previousZ + (currentZ - previousZ) * ratio
        : null
      return {
        xM: previous.xM + (current.xM - previous.xM) * ratio,
        yM: previous.yM + (current.yM - previous.yM) * ratio,
        zM,
      }
    }
    remaining -= segment
  }

  return { ...geometry.points.at(-1)! }
}
