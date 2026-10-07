import { consolidateMemories } from '../personCognition'
import { advanceClock, mergeClock, provenanceIndependent, reconstruct, type RelationalTrace, type VectorClock } from './relationalWorldRuntime'

export interface NpcMemory<T = unknown> {
  id: string
  npcId: string
  subjectRef: string
  attribute: string
  rememberedValue: T
  subjectiveConfidence: number
  traceId: string
  state: 'fresh' | 'consolidated' | 'fading' | 'forgotten'
  salience: number
  rehearsalCount: number
  lastTouchedTick: number
}

export interface NpcMemoryState {
  npcId: string
  clock: VectorClock
  memories: NpcMemory[]
  traces: RelationalTrace[]
}

const unit = (n: number) => Math.max(0, Math.min(1, n))

export function createNpcMemory<T>(input: {
  npcId: string
  subjectRef: string
  attribute: string
  value: T
  sourceRef: string
  parentTraceIds?: string[]
  confidence?: number
  salience?: number
  atTick: number
  clock?: VectorClock
}): { memory: NpcMemory<T>; trace: RelationalTrace<T>; clock: VectorClock } {
  const clock = advanceClock(input.clock ?? {}, input.npcId)
  const traceId = 'trace:memory:' + input.npcId + ':' + input.subjectRef + ':' + input.attribute + ':' + input.atTick
  const memoryId = 'memory:' + input.npcId + ':' + input.subjectRef + ':' + input.attribute + ':' + input.atTick
  return {
    clock,
    trace: {
      id: traceId,
      subjectRef: input.subjectRef,
      attribute: input.attribute,
      value: input.value,
      sourceRef: input.sourceRef,
      parentTraceIds: [...(input.parentTraceIds ?? [])],
      clock,
      durability: 'ephemeral',
      active: true,
    },
    memory: {
      id: memoryId,
      npcId: input.npcId,
      subjectRef: input.subjectRef,
      attribute: input.attribute,
      rememberedValue: input.value,
      subjectiveConfidence: unit(input.confidence ?? 0.65),
      traceId,
      state: 'fresh',
      salience: unit(input.salience ?? 0.5),
      rehearsalCount: 0,
      lastTouchedTick: input.atTick,
    },
  }
}

export function consolidateDuringSleep<T>(
  memory: NpcMemory<T>,
  trace: RelationalTrace<T>,
  atTick: number,
): { memory: NpcMemory<T>; trace: RelationalTrace<T> } {
  if (memory.state === 'forgotten' || !trace.active) return { memory, trace }
  const [ranked] = consolidateMemories([{
    id: memory.id,
    salience: memory.salience,
    valence: 0,
    tick: memory.lastTouchedTick,
    summary: memory.subjectRef + '#' + memory.attribute,
  }], atTick)
  const strength = ranked?.retention ?? 0
  const durable = strength >= 0.45
  return {
    memory: { ...memory, state: durable ? 'consolidated' : 'fading', subjectiveConfidence: unit(memory.subjectiveConfidence + (durable ? 0.08 : -0.08)), rehearsalCount: memory.rehearsalCount + 1, lastTouchedTick: atTick },
    trace: { ...trace, durability: durable ? 'persistent' : trace.durability },
  }
}

export function applyForgetting<T>(
  memory: NpcMemory<T>,
  trace: RelationalTrace<T>,
  atTick: number,
  forgetAfterTicks: number,
): { memory: NpcMemory<T>; trace: RelationalTrace<T> } {
  if (memory.state === 'forgotten') return { memory, trace }
  const age = Math.max(0, atTick - memory.lastTouchedTick)
  const resistance = 1 + memory.salience + Math.min(1, memory.rehearsalCount * 0.25)
  if (age <= forgetAfterTicks * resistance) return { memory, trace }
  return {
    memory: { ...memory, state: 'forgotten', subjectiveConfidence: 0, lastTouchedTick: atTick },
    trace: { ...trace, active: false },
  }
}

export function reconstructNpcMemory<T>(input: {
  npcId: string
  subjectRef: string
  attribute: string
  possibleValues: T[]
  memories: NpcMemory<T>[]
  traces: RelationalTrace<T>[]
}) {
  const ownedTraceIds = new Set(input.memories.filter(m => m.npcId === input.npcId && m.state !== 'forgotten').map(m => m.traceId))
  return reconstruct(input.subjectRef, input.attribute, input.possibleValues, input.traces.filter(t => ownedTraceIds.has(t.id)))
}

export function exchangeMemory<T>(input: {
  listenerId: string
  speakerMemory: NpcMemory<T>
  speakerTrace: RelationalTrace<T>
  listenerClock: VectorClock
  atTick: number
}) {
  return createNpcMemory({
    npcId: input.listenerId,
    subjectRef: input.speakerMemory.subjectRef,
    attribute: input.speakerMemory.attribute,
    value: input.speakerMemory.rememberedValue,
    sourceRef: 'npc:' + input.speakerMemory.npcId,
    parentTraceIds: [input.speakerTrace.id],
    confidence: input.speakerMemory.subjectiveConfidence * 0.85,
    salience: input.speakerMemory.salience,
    atTick: input.atTick,
    clock: mergeClock(input.listenerClock, input.speakerTrace.clock),
  })
}

export function memoriesAreIndependent(a: NpcMemory, b: NpcMemory, traces: RelationalTrace[]): boolean {
  return provenanceIndependent(a.traceId, b.traceId, traces)
}
