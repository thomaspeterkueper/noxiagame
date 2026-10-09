import type { PopulationAction } from './types'
import type { PopulationIntentExecutionResult } from './personActionExecutor'

export type HabitExecutionEvidence =
 | {status:'unverified';reason:string}
 | {status:'executed';kind:'social_visit'}

/** Only authoritative execution evidence is eligible for habit learning.
 * Request creation is not proof that the requested resource or capability was obtained.
 * A social visit being started is not proof that the social encounter was beneficial.
 */
export function classifyHabitExecution(action:PopulationAction,execution:PopulationIntentExecutionResult):HabitExecutionEvidence{
 if(action==='social_interaction'&&execution.kind==='social_visit'&&execution.executed)
   return {status:'executed',kind:'social_visit'};
 if(execution.kind==='person_action_request'&&execution.executed)
   return {status:'unverified',reason:'request_created_not_fulfilled'};
 return {status:'unverified',reason:execution.executed?'unmapped_execution':'not_executed'};
}
