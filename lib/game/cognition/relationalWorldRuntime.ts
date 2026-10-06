export type Determination = 'determined' | 'open' | 'excluded'

export interface VectorClock { [actorId: string]: number }

export interface RelationalTrace<T = unknown> {
  id: string
  subjectRef: string
  attribute: string
  value: T
  sourceRef: string
  parentTraceIds: string[]
  clock: VectorClock
  durability: 'ephemeral' | 'persistent' | 'renewable'
  active: boolean
}

export interface Candidate<T> {
  value: T
  compatible: boolean
  supportingTraceIds: string[]
  excludingTraceIds: string[]
}

export interface Reconstruction<T> {
  subjectRef: string
  attribute: string
  status: Determination
  candidates: Candidate<T>[]
}

export function mergeClock(...clocks: VectorClock[]): VectorClock {
  const merged: VectorClock = {}
  for (const clock of clocks) {
    for (const [actor, value] of Object.entries(clock)) {
      merged[actor] = Math.max(merged[actor] ?? 0, value)
    }
  }
  return merged
}

export function advanceClock(clock: VectorClock, actorId: string): VectorClock {
  return { ...clock, [actorId]: (clock[actorId] ?? 0) + 1 }
}

export function happensBefore(a: VectorClock, b: VectorClock): boolean {
  const actors = new Set([...Object.keys(a), ...Object.keys(b)])
  let strictlyEarlier = false
  for (const actor of actors) {
    const av = a[actor] ?? 0
    const bv = b[actor] ?? 0
    if (av > bv) return false
    if (av < bv) strictlyEarlier = true
  }
  return strictlyEarlier
}

export function areConcurrent(a: VectorClock, b: VectorClock): boolean {
  return !happensBefore(a, b) && !happensBefore(b, a)
}

export function ancestorClosure(traceId: string, traces: RelationalTrace[]): Set<string> {
  const byId = new Map(traces.map(trace => [trace.id, trace]))
  const seen = new Set<string>()
  const visit = (id: string) => {
    const trace = byId.get(id)
    if (!trace) return
    for (const parent of trace.parentTraceIds) {
      if (seen.has(parent)) continue
      seen.add(parent)
      visit(parent)
    }
  }
  visit(traceId)
  return seen
}

export function provenanceIndependent(aId: string, bId: string, traces: RelationalTrace[]): boolean {
  const a = ancestorClosure(aId, traces)
  const b = ancestorClosure(bId, traces)
  a.add(aId)
  b.add(bId)
  for (const id of a) if (b.has(id)) return false
  return true
}

export function reconstruct<T>(
  subjectRef: string,
  attribute: string,
  possibleValues: T[],
  traces: RelationalTrace<T>[],
): Reconstruction<T> {
  const relevant = traces.filter(trace => trace.active && trace.subjectRef === subjectRef && trace.attribute === attribute)
  const candidates = possibleValues.map(value => {
    const supporting = relevant.filter(trace => Object.is(trace.value, value)).map(trace => trace.id)
    const excluding = relevant.filter(trace => !Object.is(trace.value, value)).map(trace => trace.id)
    return {
      value,
      compatible: excluding.length === 0,
      supportingTraceIds: supporting,
      excludingTraceIds: excluding,
    }
  })
  const compatible = candidates.filter(candidate => candidate.compatible)
  return {
    subjectRef,
    attribute,
    status: compatible.length === 1 ? 'determined' : compatible.length === 0 ? 'excluded' : 'open',
    candidates,
  }
}

export function resolveOpenValue<T>(
  reconstruction: Reconstruction<T>,
  choose: (allowed: T[]) => T,
): T {
  const allowed = reconstruction.candidates.filter(candidate => candidate.compatible).map(candidate => candidate.value)
  if (!allowed.length) throw new Error('No compatible value remains')
  if (allowed.length === 1) return allowed[0]
  const chosen = choose([...allowed])
  if (!allowed.some(value => Object.is(value, chosen))) throw new Error('Resolver chose an incompatible value')
  return chosen
}

export function decayTrace<T>(trace: RelationalTrace<T>): RelationalTrace<T> {
  return { ...trace, active: false }
}
