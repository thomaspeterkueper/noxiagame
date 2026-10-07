import { createNpcMemory, type NpcMemory, type NpcMemoryState } from './npcRelationalMemory'
import { normalizeObservation, type Observation } from './observation'

export interface ObservationMemoryProjection<T=unknown> {
  memory: NpcMemory<T>
  state: NpcMemoryState
}

// Converts what an NPC actually observed into its subjective memory.
// It never imports canonical world state and preserves the observation as provenance.
export function rememberObservation<T>(
  state: NpcMemoryState,
  rawObservation: Observation<T>,
): ObservationMemoryProjection<T> {
  const observation=normalizeObservation(rawObservation)
  if(observation.observerId!==state.npcId) throw new Error('Observation belongs to a different observer')

  const created=createNpcMemory({
    npcId:state.npcId,
    subjectRef:observation.subjectRef,
    attribute:observation.attribute,
    value:observation.value,
    sourceRef:'observation:'+observation.id,
    parentTraceIds:observation.source.provenanceRefs ?? [],
    confidence:observation.confidence,
    salience:observation.salience,
    atTick:observation.observedAtTick,
    clock:state.clock,
  })

  return {
    memory:created.memory,
    state:{
      npcId:state.npcId,
      clock:created.clock,
      memories:[...state.memories,created.memory],
      traces:[...state.traces,created.trace],
    },
  }
}

export function nearbyPlaceObservation(input:{
  npcId:string
  targetRef:string
  placeName:string
  kind:string
  distanceM:number
  atTick:number
}):Observation<{name:string;kind:string;distanceM:number}>{
  const distance=Math.max(0,input.distanceM)
  return normalizeObservation({
    id:'obs:'+input.npcId+':'+input.targetRef+':nearby:'+input.atTick,
    observerId:input.npcId,
    subjectRef:input.targetRef,
    attribute:'nearby_place',
    value:{name:input.placeName,kind:input.kind,distanceM:distance},
    source:{id:'perception:'+input.npcId,type:'person'},
    modality:'visual',
    observedAtTick:input.atTick,
    confidence:distance<=15?.95:distance<=45?.82:.55,
    salience:distance<=15?.65:.45,
    spatialResolutionM:Math.max(1,distance*.08),
  })
}
