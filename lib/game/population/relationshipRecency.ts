// Shared recency evidence for social relationships.
// This is not relationship strength itself. It only records how recently and
// repeatedly two people have actually interacted.

export const RECENT_ENCOUNTER_TICK_RETENTION = 0.97

const clamp01=(value:number)=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0))

export function encounterRecencyAfterTick(value:number,ticks=1){
  return clamp01(value*Math.pow(RECENT_ENCOUNTER_TICK_RETENTION,Math.max(0,ticks)))
}

export function nextEncounterRecency(
  previous:number,
  previousInteractionTick:number|null,
  tick:number,
){
  const gap=previousInteractionTick==null?Number.POSITIVE_INFINITY:Math.max(0,tick-previousInteractionTick)
  const gain=gap<=24?0.22:gap<=72?0.12:0.05
  const retention=gap<=72?0.88:0.55
  return clamp01(previous*retention+gain)
}
