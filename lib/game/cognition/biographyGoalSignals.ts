/** NOXIA #575: derive bounded social motivations from remembered events.
 * Memories are subjective. This proposes goals only and never changes bonds.
 */
import type { NpcMemoryState } from './npcRelationalMemory'
import type { BiographyEvent } from './biographyEvents'

export type SocialGoal = 'offer_support' | 'reconnect' | 'grieve' | 'reflect'
export type SocialGoalSignal = {
  npcId: string
  relatedPersonId: string
  sourceEventId: string
  sourceMemoryId: string
  goal: SocialGoal
  strength: number
  canonical: false
}
const unit = (v:number) => Number.isFinite(v) ? Math.max(0,Math.min(1,v)) : 0

/** Events must already be authorized for this NPC by the caller. Unknown sources create no goal. */
export function biographyGoalSignals(
  state: NpcMemoryState,
  observedEvents: readonly BiographyEvent[],
  atTick: number,
): SocialGoalSignal[] {
  if (!Number.isSafeInteger(atTick) || atTick<0) return []
  const events = new Map(observedEvents.filter(e=>e.id && e.tick<=atTick).map(e=>[e.id,e]))
  const results: SocialGoalSignal[] = []
  for (const memory of state.memories) {
    if (memory.npcId!==state.npcId || memory.attribute!=='biography_event' ||
        memory.state==='forgotten' || typeof memory.rememberedValue!=='string') continue
    const event=events.get(memory.rememberedValue)
    const trace=state.traces.find(t=>t.id===memory.traceId && t.active && t.value===event?.id)
    if (!event || !trace || memory.lastTouchedTick>atTick) continue
    const goal:SocialGoal = event.kind==='death' ? 'grieve' :
      event.kind==='birth' || event.kind==='care_started' ? 'offer_support' :
      event.kind==='bond_formed' ? 'reconnect' : 'reflect'
    const elapsed=Math.max(0,atTick-memory.lastTouchedTick)
    const strength=unit(memory.salience)*unit(memory.subjectiveConfidence)/(1+elapsed/500)
    if(strength<=0) continue
    results.push({npcId:state.npcId,relatedPersonId:event.personId,
      sourceEventId:event.id,sourceMemoryId:memory.id,goal,strength,canonical:false})
  }
  return results.sort((a,b)=>b.strength-a.strength || a.sourceEventId.localeCompare(b.sourceEventId))
}
