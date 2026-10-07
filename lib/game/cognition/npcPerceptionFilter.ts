import { stableFingerprint } from '../observation/fingerprint'
import type { Observation } from './observation'

export interface PerceptionSnapshot {
  fingerprint: string
  observedAtTick: number
  confidence: number
  salience: number
}

export interface PerceptionFilterState {
  byKey: Record<string, PerceptionSnapshot>
}

export type PerceptionDecisionReason = 'first_seen'|'changed'|'refreshed'|'salient_repeat'|'unchanged'

export interface PerceptionDecision<T=unknown> {
  emit: boolean
  reason: PerceptionDecisionReason
  observation: Observation<T>
  nextState: PerceptionFilterState
}

function stableValue(value:unknown):string{
  if(value===null||typeof value!=='object')return JSON.stringify(value)
  if(Array.isArray(value))return '['+value.map(stableValue).join(',')+']'
  const obj=value as Record<string,unknown>
  return '{'+Object.keys(obj).sort().map(k=>JSON.stringify(k)+':'+stableValue(obj[k])).join(',')+'}'
}

export function perceptionKey(observation:Pick<Observation,'observerId'|'subjectRef'|'attribute'>):string{
  return observation.observerId+'|'+observation.subjectRef+'|'+observation.attribute
}

export function perceptionFingerprint(observation:Pick<Observation,'subjectRef'|'attribute'|'value'>):string{
  return stableFingerprint(observation.subjectRef+'|'+observation.attribute+'|'+stableValue(observation.value))
}

// Pure, bounded change filter. Caller decides whether emitted observations are
// persisted as memory. Identical frames do not become repeated DB writes.
export function filterPerception<T>(input:{
  state:PerceptionFilterState
  observation:Observation<T>
  refreshAfterTicks?:number
  salientRepeatAfterTicks?:number
}):PerceptionDecision<T>{
  const {observation}=input
  const key=perceptionKey(observation)
  const fingerprint=perceptionFingerprint(observation)
  const previous=input.state.byKey[key]
  const age=previous?Math.max(0,observation.observedAtTick-previous.observedAtTick):Infinity
  const refreshAfter=Math.max(1,input.refreshAfterTicks??240)
  const salientAfter=Math.max(1,input.salientRepeatAfterTicks??60)

  let reason:PerceptionDecisionReason='unchanged'
  let emit=false
  if(!previous){reason='first_seen';emit=true}
  else if(previous.fingerprint!==fingerprint){reason='changed';emit=true}
  else if(observation.salience>=0.85&&age>=salientAfter){reason='salient_repeat';emit=true}
  else if(age>=refreshAfter){reason='refreshed';emit=true}

  if(!emit)return {emit,reason,observation,nextState:input.state}
  return {
    emit,
    reason,
    observation,
    nextState:{byKey:{...input.state.byKey,[key]:{fingerprint,observedAtTick:observation.observedAtTick,confidence:observation.confidence,salience:observation.salience}}},
  }
}

export function emptyPerceptionFilterState():PerceptionFilterState{return {byKey:{}}}
