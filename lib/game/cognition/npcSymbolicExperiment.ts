import { composeSymbolicFrame, type SymbolicSignal } from './npcSymbolicResonance'

/** Repeatable A/B fixture: symbolic frame adds interpretive annotations,
 * never privileged facts or new action permissions.
 */
export interface EncounterFixture {
  npcId: string
  fatigue: number
  trust: number
  observedDistress: number
  remembersConflict: boolean
}
export interface EncounterAssessment {
  npcId: string
  baseline: { approach: number; withdraw: number }
  symbolic: ReturnType<typeof composeSymbolicFrame>
}
const unit=(x:number)=>Math.max(0,Math.min(1,x))
const round=(x:number)=>Math.round(x*1e5)/1e5

export function assessEncounter(f:EncounterFixture):EncounterAssessment {
  const trust=unit(f.trust),fatigue=unit(f.fatigue),distress=unit(f.observedDistress)
  const memoryPenalty=f.remembersConflict?.2:0
  const approach=round(unit(.2+.55*trust+.2*distress-.35*fatigue-memoryPenalty))
  const withdraw=round(unit(.1+.4*fatigue+.25*(1-trust)+memoryPenalty))
  const signals:SymbolicSignal[]=[
    {sourceNode:'perception',symbol:'avi',intensity:distress,confidence:.65,sourceRef:'perception:'+f.npcId,tick:1},
    {sourceNode:'memory',symbol:'reso',intensity:trust,confidence:f.remembersConflict?.6:.85,sourceRef:'memory:'+f.npcId,tick:1},
    {sourceNode:'physiology',symbol:'ira',intensity:fatigue,confidence:.9,sourceRef:'body:'+f.npcId,tick:1},
  ]
  return {npcId:f.npcId,baseline:{approach,withdraw},symbolic:composeSymbolicFrame(signals)}
}
/** No symbolic action selection until a validated external experiment proves a benefit. */
