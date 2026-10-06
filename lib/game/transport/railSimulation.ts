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
