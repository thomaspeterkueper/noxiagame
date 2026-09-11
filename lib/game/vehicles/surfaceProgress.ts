// lib/game/vehicles/surfaceProgress.ts
// Read-only projection of persisted transport timing into player-facing progress.
// Core transport_jobs remains the sole state machine.

export type SurfaceTransportStatus =
  | 'reserved'
  | 'loading'
  | 'in_transit'
  | 'arrived'
  | 'unloading'
  | 'completed'
  | 'cancelled'
  | 'failed'

export interface SurfaceProgressJob {
  status: string
  started_at?: string | null
  arrives_at?: string | null
  route_snapshot?: Record<string, unknown> | null
}

export interface SurfaceMissionProgress {
  phase: 'preparing' | 'moving' | 'arrived' | 'finished' | 'failed'
  progress01: number
  elapsedSeconds: number | null
  remainingSeconds: number | null
  etaSeconds: number | null
  distanceKm: number | null
  travelledKm: number | null
  remainingKm: number | null
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(number) ? number : null
}

function timestampMs(value: string | null | undefined): number | null {
  if (!value) return null
  const result = Date.parse(value)
  return Number.isFinite(result) ? result : null
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

export function surfaceRouteDistanceKm(snapshot: Record<string, unknown> | null | undefined): number | null {
  if (!snapshot) return null
  const distance = finiteNumber(snapshot.distanceKm)
  return distance != null && distance >= 0 ? distance : null
}

export function surfaceRouteEtaSeconds(snapshot: Record<string, unknown> | null | undefined): number | null {
  if (!snapshot) return null
  const eta = finiteNumber(snapshot.etaSeconds)
  return eta != null && eta > 0 ? eta : null
}

export function deriveSurfaceMissionProgress(job: SurfaceProgressJob, nowMs = Date.now()): SurfaceMissionProgress {
  const distanceKm = surfaceRouteDistanceKm(job.route_snapshot)
  const snapshotEtaSeconds = surfaceRouteEtaSeconds(job.route_snapshot)
  const startedMs = timestampMs(job.started_at)
  const arrivesMs = timestampMs(job.arrives_at)

  if (job.status === 'failed' || job.status === 'cancelled') {
    return {
      phase: 'failed', progress01: 0, elapsedSeconds: null, remainingSeconds: null,
      etaSeconds: snapshotEtaSeconds, distanceKm, travelledKm: null, remainingKm: distanceKm,
    }
  }

  if (job.status === 'completed') {
    return {
      phase: 'finished', progress01: 1, elapsedSeconds: null, remainingSeconds: 0,
      etaSeconds: snapshotEtaSeconds, distanceKm, travelledKm: distanceKm, remainingKm: 0,
    }
  }

  if (job.status === 'arrived' || job.status === 'unloading') {
    return {
      phase: 'arrived', progress01: 1, elapsedSeconds: null, remainingSeconds: 0,
      etaSeconds: snapshotEtaSeconds, distanceKm, travelledKm: distanceKm, remainingKm: 0,
    }
  }

  if (job.status !== 'in_transit' || startedMs == null || arrivesMs == null || arrivesMs <= startedMs) {
    return {
      phase: 'preparing', progress01: 0, elapsedSeconds: 0, remainingSeconds: snapshotEtaSeconds,
      etaSeconds: snapshotEtaSeconds, distanceKm, travelledKm: 0, remainingKm: distanceKm,
    }
  }

  const durationMs = arrivesMs - startedMs
  const progress01 = clamp01((nowMs - startedMs) / durationMs)
  const elapsedSeconds = Math.max(0, Math.round((Math.min(nowMs, arrivesMs) - startedMs) / 1000))
  const remainingSeconds = Math.max(0, Math.ceil((arrivesMs - Math.max(nowMs, startedMs)) / 1000))

  return {
    phase: progress01 >= 1 ? 'arrived' : 'moving',
    progress01,
    elapsedSeconds,
    remainingSeconds,
    etaSeconds: Math.round(durationMs / 1000),
    distanceKm,
    travelledKm: distanceKm == null ? null : distanceKm * progress01,
    remainingKm: distanceKm == null ? null : distanceKm * (1 - progress01),
  }
}
