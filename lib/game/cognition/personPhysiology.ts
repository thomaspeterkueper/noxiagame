/** Deterministic, bounded physiological proxies for NPC decision evaluation.
 * These numbers are gameplay abstractions, NOT measurements of hormone levels.
 * They never overwrite the existing affect state or authoritative world state.
 */
export interface BodyContext {
  /** 0..1: present stress load, inferred from actual game events. */
  stress: number
  /** 0..1: sleep debt / fatigue, from person needs and schedule. */
  fatigue: number
  /** 0..1: perceived social safety, from relationships and context. */
  socialSafety: number
  /** 0..1: situation novelty / activation demand. */
  novelty: number
}
export interface BodySensitivity {
  stressReactivity: number
  fatigueSensitivity: number
  affiliationDrive: number
  noveltySeeking: number
}
export type BodyAction = 'rest' | 'work' | 'social_interaction' | 'inspect_problem' | 'travel_home'
const unit=(x:number)=>Number.isFinite(x)?Math.max(0,Math.min(1,x)):0
const round=(x:number)=>Math.round(x*1e6)/1e6
/** Small additive biases; existing action feasibility and hard gates remain authoritative. */
export function physiologicalActionModifiers(body:BodyContext, individual:BodySensitivity): Record<BodyAction,number> {
  const stress=unit(body.stress)*unit(individual.stressReactivity)
  const tired=unit(body.fatigue)*unit(individual.fatigueSensitivity)
  const safe=unit(body.socialSafety)
  const social=unit(individual.affiliationDrive)
  const seek=unit(body.novelty)*unit(individual.noveltySeeking)
  return {
    rest:round(Math.min(.35,.22*tired+.13*stress)),
    work:round(Math.max(-.35,-.23*tired-.12*stress)),
    social_interaction:round(Math.max(-.35,Math.min(.35,.24*social*safe-.18*stress*(1-safe)+.08*seek))),
    inspect_problem:round(Math.max(-.35,Math.min(.35,.22*seek-.20*stress))),
    travel_home:round(Math.min(.35,.17*stress+.16*tired)),
  }
}
