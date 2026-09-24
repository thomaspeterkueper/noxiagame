// Ranks research questions by epistemic value versus resource burden.
// This is planning only: it neither spends resources nor grants action authority.

import type { DiscriminatingResearchQuestion } from './hypothesisDiscrimination'

export interface ResearchCost {
  timeTicks: number
  credits: number
  energy: number
  risk: number
}

export interface ResearchValuePolicy {
  timeWeight: number
  creditWeight: number
  energyWeight: number
  riskWeight: number
  riskTolerance: number
}

export interface ValuedResearchQuestion {
  question: DiscriminatingResearchQuestion
  cost: ResearchCost
  burden: number
  utility: number
  affordable: boolean
}

const nonneg=(n:number)=>Math.max(0,Number.isFinite(n)?n:0)

export function rankResearchByValue(
  options:{question:DiscriminatingResearchQuestion,cost:ResearchCost}[],
  policy:ResearchValuePolicy,
):ValuedResearchQuestion[]{
  return options.map(({question,cost})=>{
    const risk=nonneg(cost.risk)
    const burden=nonneg(cost.timeTicks)*nonneg(policy.timeWeight)+
      nonneg(cost.credits)*nonneg(policy.creditWeight)+
      nonneg(cost.energy)*nonneg(policy.energyWeight)+
      risk*nonneg(policy.riskWeight)
    const affordable=risk<=nonneg(policy.riskTolerance)
    const utility=affordable ? question.discriminationScore/(1+burden) : 0
    return {question,cost,burden,utility,affordable}
  }).sort((a,b)=>b.utility-a.utility||b.question.discriminationScore-a.question.discriminationScore||a.question.id.localeCompare(b.question.id))
}
