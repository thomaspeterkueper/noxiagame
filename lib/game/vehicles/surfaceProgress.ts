export type SurfaceProgressPhase = 'preparing' | 'moving' | 'arrived' | 'completed' | 'failed'

export interface SurfaceProgressJob {
  status: string
  route_snapshot?: Record<string, unknown> | null
  started_at?: string | null
  arrives_at?: string | null
}

export interface SurfaceMissionProgress {
  phase: SurfaceProgressPhase
  progress01: number
  elapsedSeconds: number | null
  remainingSeconds: number | null
  travelledKm: number | null
  remainingKm: number | null
}

function finitePositive(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

export function surfaceRouteDistanceKm(snapshot: Record<string, unknown> | null | undefined) {
  return snapshot ? finitePositive(snapshot.distanceKm) : null
}

export function surfaceRouteEtaSeconds(snapshot: Record<string, unknown> | null | undefined) {
  return snapshot ? finitePositive(snapshot.etaSeconds) : null
}

function phaseForStatus(status: string): SurfaceProgressPhase {
  if (status === 'reserved' || status === 'loading') return 'preparing'
  if (status === 'in_transit') return 'moving'
  if (status === 'arrived' || status === 'unloading') return 'arrived'
  if (status === 'completed') return 'completed'
  return 'failed'
}

export function deriveSurfaceMissionProgress(job: SurfaceProgressJob, nowMs = Date.now()): SurfaceMissionProgress {
  const phase = phaseForStatus(job.status)
  const distanceKm = surfaceRouteDistanceKm(job.route_snapshot)
  const etaSeconds = surfaceRouteEtaSeconds(job.route_snapshot)

  let progress01 = phase === 'arrived' || phase === 'completed' ? 1 : 0
  let elapsedSeconds: number | null = null
  let remainingSeconds: number | null = etaSeconds

  if (phase === 'moving') {
    const startedMs = job.started_at ? Date.parse(job.started_at) : Number.NaN
    const arrivesMs = job.arrives_at ? Date.parse(job.arrives_at) : Number.NaN
    if (Number.isFinite(startedMs) && Number.isFinite(arrivesMs) && arrivesMs > startedMs) {
      progress01 = Math.max(0, Math.min(1, (nowMs - startedMs) / (arrivesMs - startedMs)))
      elapsedSeconds = Math.max(0, Math.round((nowMs - startedMs) / 1000))
      remainingSeconds = Math.max(0, Math.ceil((arrivesMs - nowMs) / 1000))
    }
  } else if (phase === 'completed') {
    elapsedSeconds = etaSeconds
    remainingSeconds = 0
  } else if (phase === 'arrived') {
    remainingSeconds = 0
  }

  return {
    phase,
    progress01,
    elapsedSeconds,
    remainingSeconds,
    travelledKm: distanceKm == null ? null : distanceKm * progress01,
    remainingKm: distanceKm == null ? null : distanceKm * (1 - progress01),
  }
}
