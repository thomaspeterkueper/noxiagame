/** Neutral, synthetic personality seed laboratory. No private authoring inputs. */
export type PersonalitySeed = {
  id: string
  version: 1
  curiosity: number
  sociability: number
  caution: number
  cooperation: number
}
export type PersonalityContext = {
  familiarity: number
  perceivedRisk: number
  sharedGoal: boolean
}
export type Action = 'explore' | 'approach' | 'assist' | 'observe'
const inRange=(n:number)=>Number.isFinite(n)&&n>=0&&n<=1
export function validateSeed(s:PersonalitySeed):string[] {
  const errors:string[]=[]
  if(!s.id || s.version!==1)errors.push('invalid_identity_or_version')
  for(const key of ['curiosity','sociability','caution','cooperation'] as const)
    if(!inRange(s[key]))errors.push('invalid_'+key)
  return errors
}
export function rankActions(seed:PersonalitySeed, context:PersonalityContext):{action:Action,score:number}[] {
  const errors=validateSeed(seed)
  if(![context.familiarity,context.perceivedRisk].every(inRange))errors.push('invalid_context')
  if(errors.length)throw new Error(errors.join(','))
  const scores:Record<Action,number>={
    explore:seed.curiosity*(1-context.perceivedRisk*.8),
    approach:seed.sociability*(.45+.55*context.familiarity)*(1-context.perceivedRisk*.5),
    assist:seed.cooperation*(context.sharedGoal?1:.25)*(1-context.perceivedRisk*.3),
    observe:seed.caution*(.35+.65*context.perceivedRisk),
  }
  return (Object.entries(scores) as [Action,number][]).map(([action,score])=>({action,score:Number(score.toFixed(4))}))
    .sort((a,b)=>b.score-a.score||a.action.localeCompare(b.action))
}
/** Only anonymous fixtures: no astrology, cultural or manuscript fields. */
export const SYNTHETIC_SEEDS:PersonalitySeed[]=[
  {id:'synthetic-curious',version:1,curiosity:.95,sociability:.4,caution:.2,cooperation:.6},
  {id:'synthetic-cautious',version:1,curiosity:.25,sociability:.25,caution:.95,cooperation:.5},
  {id:'synthetic-social',version:1,curiosity:.5,sociability:.95,caution:.2,cooperation:.9},
]
