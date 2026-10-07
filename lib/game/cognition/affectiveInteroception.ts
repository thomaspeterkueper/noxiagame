// Deterministic body -> interoception -> affect bridge for persistent NOXIA persons.
// Body state is simulation truth. Pain/affect are subjective derived state.
// No random values and no external inference are permitted here.

import type { CognitiveStimulus } from '../personCognition'

export type BodyRegion = 'head'|'torso'|'left_arm'|'right_arm'|'left_hand'|'right_hand'|'left_leg'|'right_leg'|'general'

export interface InjurySignal {
  id: string
  region: BodyRegion
  tissueDamage: number
  inflammation?: number
  acute?: boolean
}

export interface BodyState {
  injuries?: InjurySignal[]
  fatigue?: number
  hunger?: number
  oxygenStress?: number
  thermalStress?: number
}

export interface InteroceptiveState {
  nociception: number
  bodilyDistress: number
  urgency: number
  dominantRegion?: BodyRegion
  sourceInjuryId?: string
}

export interface AffectiveState {
  valence: number
  arousal: number
  emotionalSalience: number
  goalConflict: number
}

export interface ReflexIntent {
  actionCode: 'withdraw_from_harm'|'protect_injured_region'|'interrupt_activity'
  priority: number
  region?: BodyRegion
  sourceInjuryId?: string
}

export interface AffectiveInteroception {
  interoception: InteroceptiveState
  affect: AffectiveState
  stimulus: CognitiveStimulus
  reflex?: ReflexIntent
}

const clamp01=(v:number|undefined)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):0

export function senseBody(body:BodyState):InteroceptiveState{
  const injuries=(body.injuries??[]).map(i=>{
    const damage=clamp01(i.tissueDamage)
    const inflammation=clamp01(i.inflammation)
    const nociception=clamp01(damage*.72+inflammation*.20+(i.acute?damage*.08:0))
    return {...i,nociception}
  }).sort((a,b)=>b.nociception-a.nociception||a.id.localeCompare(b.id))
  const dominant=injuries[0]
  const nociception=dominant?.nociception??0
  const systemic=Math.max(clamp01(body.oxygenStress),clamp01(body.thermalStress),clamp01(body.fatigue)*.45,clamp01(body.hunger)*.30)
  const bodilyDistress=clamp01(Math.max(nociception,systemic))
  return {
    nociception,
    bodilyDistress,
    urgency:clamp01(nociception*.65+systemic*.55),
    dominantRegion:dominant?.region,
    sourceInjuryId:dominant?.id,
  }
}

export function appraiseBody(state:InteroceptiveState):AffectiveState{
  return {
    valence:-clamp01(state.bodilyDistress*.9),
    arousal:clamp01(state.urgency*.85+state.nociception*.25),
    emotionalSalience:clamp01(state.bodilyDistress*.75+state.urgency*.25),
    goalConflict:clamp01(state.urgency*.8),
  }
}

export function selectProtectiveReflex(state:InteroceptiveState):ReflexIntent|undefined{
  if(state.nociception>=.78)return {actionCode:'withdraw_from_harm',priority:.99,region:state.dominantRegion,sourceInjuryId:state.sourceInjuryId}
  if(state.nociception>=.52)return {actionCode:'protect_injured_region',priority:.90,region:state.dominantRegion,sourceInjuryId:state.sourceInjuryId}
  if(state.bodilyDistress>=.68)return {actionCode:'interrupt_activity',priority:.82,region:state.dominantRegion,sourceInjuryId:state.sourceInjuryId}
  return undefined
}

export function evaluateAffectiveInteroception(body:BodyState):AffectiveInteroception{
  const interoception=senseBody(body)
  const affect=appraiseBody(interoception)
  return {
    interoception,
    affect,
    stimulus:{emotionalSalience:affect.emotionalSalience,goalConflict:affect.goalConflict,surprise:interoception.nociception>=.78?.65:0},
    reflex:selectProtectiveReflex(interoception),
  }
}
