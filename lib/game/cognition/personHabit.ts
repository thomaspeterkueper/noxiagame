import type { PopulationAction } from "../population/types";

export interface HabitState {
  action: PopulationAction;
  contextKey: string;
  repetitions: number;
  successes: number;
  strength: number;
  successExpectation?: number;
  lastTick: number;
}
export interface HabitOutcome { action:PopulationAction; contextKey:string; successful:boolean; tick:number }
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const round=(v:number)=>Math.round(v*1e6)/1e6;

/**
 * Habits are compressed action history, not episodic memory and not reflexes.
 * Only an actually executed action can reinforce a habit. Unsuccessful
 * repetitions can still create familiarity, but cannot monotonically certify utility.
 */
export function updateHabit(previous:HabitState|null,outcome:HabitOutcome):HabitState{
  const same=previous?.action===outcome.action&&previous.contextKey===outcome.contextKey;
  const repetitions=(same?previous!.repetitions:0)+1;
  const successes=(same?previous!.successes:0)+(outcome.successful?1:0);
  const reliability=successes/repetitions;
  const practice=1-Math.exp(-repetitions/8);
  const strength=round(clamp(practice));
  return {action:outcome.action,contextKey:outcome.contextKey,repetitions,successes,strength,lastTick:outcome.tick,successExpectation:round(reliability)};
}

/** Bounded bias only. Habit never unlocks an unavailable action. */
export function habitActionModifier(habit:HabitState|undefined,action:PopulationAction,contextKey:string):number{
  if(!habit||habit.action!==action||habit.contextKey!==contextKey)return 0;
  return round(.18*clamp(habit.strength)*clamp(habit.successExpectation ?? habit.successes/Math.max(1,habit.repetitions)));
}

/** Cheap gate: strong, reliable habits may avoid deliberative cognition. */
export function evaluateHabitGate(habit:HabitState|undefined,contextKey:string):{triggered:boolean;action?:PopulationAction;strength:number;computeTier:0|1}{
  const strength=habit?.contextKey===contextKey?clamp(habit.strength):0;
  const reliable=Boolean(habit&&habit.repetitions>=4&&(habit.successExpectation ?? habit.successes/habit.repetitions)>=.6);
  return {triggered:reliable&&strength>=.42,action:reliable&&strength>=.42?habit!.action:undefined,strength:round(strength),computeTier:1};
}
