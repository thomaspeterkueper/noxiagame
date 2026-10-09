import { updateHabit, type HabitState, type HabitOutcome } from '../cognition/personHabit'
import type { PopulationAction } from './types'

type Db=any
const fromRow=(r:any):HabitState=>({action:r.action as PopulationAction,contextKey:r.context_key,repetitions:Number(r.repetitions),successes:Number(r.successes),strength:Number(r.strength),successExpectation:Number(r.success_expectation),lastTick:Number(r.last_tick)})
/** One batch read per tick; a missing migration degrades to no habits. */
export async function loadHabitSnapshot(db:Db,personIds:string[]):Promise<Map<string,HabitState[]>>{
 const map=new Map<string,HabitState[]>();if(!personIds.length)return map;
 const {data,error}=await db.from('person_habits').select('person_id,context_key,action,repetitions,successes,strength,success_expectation,last_tick').in('person_id',personIds);
 if(error)return map;
 for(const r of data??[]){const list=map.get(r.person_id)??[];list.push(fromRow(r));map.set(r.person_id,list)}
 return map;
}
/** Explicitly called only after a verified authoritative outcome, never a mere decision. */
export async function recordVerifiedHabitOutcome(db:Db,personId:string,prior:HabitState|null,outcome:HabitOutcome):Promise<boolean>{
 if(prior&&outcome.tick<=prior.lastTick)return false;
 const h=updateHabit(prior,outcome);
 const {error}=await db.from('person_habits').upsert({person_id:personId,context_key:h.contextKey,action:h.action,repetitions:h.repetitions,successes:h.successes,strength:h.strength,success_expectation:h.successExpectation,last_tick:h.lastTick,updated_at:new Date().toISOString()},{onConflict:'person_id,context_key,action'});
 return !error;
}
