import type { LocalSurfacePoint } from '../spatial/localSurfaceScene'

/**
 * Sparse rail simulation.
 *
 * A running train is represented by its service, departure time and route.
 * Its current position is derived on demand. This deliberately avoids
 * per-train position writes and a permanent server-side movement tick.
 */
export type RailStation = {
  id: string
  name: string
  point: LocalSurfacePoint
}

export type RailSegment = {
  id: string
  fromStationId: string
  toStationId: string
  distanceM: number
  travelTimeMs: number
}

export type RailNetwork = {
  stations: RailStation[]
  segments: RailSegment[]
}

export type RailStop = {
  stationId: string
  arrivalOffsetMs: number
  departureOffsetMs: number
}

export type RailService = {
  id: string
  name: string
  stops: RailStop[]
}

export type TrainRun = {
  id: string
  serviceId: string
  departureAtMs: number
}

export type TrainRunState =
  | { phase: 'scheduled'; stationId: string; progress: 0 }
  | { phase: 'dwelling'; stationId: string; progress: 0 }
  | { phase: 'running'; fromStationId: string; toStationId: string; progress: number }
  | { phase: 'arrived'; stationId: string; progress: 1 }

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

export function deriveTrainRunState(
  service: RailService,
  run: TrainRun,
  nowMs: number,
): TrainRunState {
  if (!service.stops.length) throw new Error('Rail service requires at least one stop')

  const elapsedMs = nowMs - run.departureAtMs
  const first = service.stops[0]
  if (elapsedMs < first.departureOffsetMs) {
    return { phase: 'scheduled', stationId: first.stationId, progress: 0 }
  }

  for (let index = 0; index < service.stops.length; index += 1) {
    const stop = service.stops[index]
    const next = service.stops[index + 1]

    if (elapsedMs >= stop.arrivalOffsetMs && elapsedMs < stop.departureOffsetMs) {
      return { phase: 'dwelling', stationId: stop.stationId, progress: 0 }
    }

    if (next && elapsedMs >= stop.departureOffsetMs && elapsedMs < next.arrivalOffsetMs) {
      const durationMs = Math.max(1, next.arrivalOffsetMs - stop.departureOffsetMs)
      return {
        phase: 'running',
        fromStationId: stop.stationId,
        toStationId: next.stationId,
        progress: clamp01((elapsedMs - stop.departureOffsetMs) / durationMs),
      }
    }
  }

  const last = service.stops[service.stops.length - 1]
  return { phase: 'arrived', stationId: last.stationId, progress: 1 }
}

export function deriveTrainPoint(
  network: RailNetwork,
  state: TrainRunState,
): LocalSurfacePoint | null {
  const station = (id: string) => network.stations.find(candidate => candidate.id === id)

  if (state.phase !== 'running') {
    return station(state.stationId)?.point ?? null
  }

  const from = station(state.fromStationId)?.point
  const to = station(state.toStationId)?.point
  if (!from || !to) return null

  return {
    xM: from.xM + (to.xM - from.xM) * state.progress,
    yM: from.yM + (to.yM - from.yM) * state.progress,
  }
}

export type RailEventKind = 'departed' | 'arrived' | 'cargo-changed' | 'disrupted'

export type RailEvent = {
  runId: string
  kind: RailEventKind
  atMs: number
  stationId?: string
}

/**
 * Persistence boundary: store events/state transitions, not animation frames.
 * Callers can persist these sparse events in Supabase while rendering position
 * from deriveTrainRunState/deriveTrainPoint locally.
 */
export function railEventKey(event: RailEvent) {
  return [event.runId, event.kind, event.stationId ?? '-', event.atMs].join(':')
}


/**
 * Derives a point along an observed rail polyline. Useful for local rendering:
 * the caller stores no intermediate positions and can choose any refresh rate.
 */
export function derivePointAlongRailPath(
  points: LocalSurfacePoint[],
  progress: number,
): LocalSurfacePoint | null {
  if (!points.length) return null
  if (points.length === 1) return points[0]

  const segments = points.slice(1).map((to, index) => {
    const from = points[index]
    return { from, to, lengthM: Math.hypot(to.xM - from.xM, to.yM - from.yM) }
  }).filter(segment => segment.lengthM > 0)

  const totalM = segments.reduce((sum, segment) => sum + segment.lengthM, 0)
  if (totalM <= 0) return points[0]

  const targetM = clamp01(progress) * totalM
  let traversedM = 0
  for (const segment of segments) {
    if (targetM <= traversedM + segment.lengthM) {
      const t = (targetM - traversedM) / segment.lengthM
      return {
        xM: segment.from.xM + (segment.to.xM - segment.from.xM) * t,
        yM: segment.from.yM + (segment.to.yM - segment.from.yM) * t,
      }
    }
    traversedM += segment.lengthM
  }
  return segments[segments.length - 1].to
}

/**
 * Ping-pong progress keeps a local demonstration train on the observed segment
 * without creating route endpoints or persistent simulation state.
 */
export function deriveLoopingRailProgress(nowMs: number, oneWayDurationMs = 45_000) {
  const duration = Math.max(1, oneWayDurationMs)
  const phase = ((nowMs % (duration * 2)) + duration * 2) % (duration * 2)
  return phase <= duration ? phase / duration : 2 - phase / duration
}
