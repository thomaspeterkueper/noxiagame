// NOXIA-LIVING — coarse interoceptive / neuroendocrine regulation.
//
// These values are dimensionless control signals, NOT blood concentrations.
// They deliberately sit one resolution level above cortisol, oxytocin,
// dopamine, vasopressin etc. A deeper endocrine model may later refine them.
//
// Grounded inputs only: needs, affect and persisted relationship evidence.

export interface RegulationState {
  stressAxis:number
  socialBondingTone:number
  rewardDrive:number
  arousal:number
}

export interface RegulationInput {
  affect?:{joy:number;fear:number;anger:number;sadness:number;mood:number;pain:number}|null
  needs?:Record<string,number>
  strongestBond?:{trust:number;affinity:number;familiarity:number;recent:number}|null
}

const unit=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0))
const need=(needs:Record<string,number>|undefined,key:string,fallback=.5)=>unit(Number(needs?.[key]??fallback))

export const neutralRegulation=():RegulationState=>({
  stressAxis:.35,
  socialBondingTone:.25,
  rewardDrive:.4,
  arousal:.3,
})

export function deriveRegulationState(input:RegulationInput):RegulationState{
  const a=input.affect??{joy:0,fear:0,anger:0,sadness:0,mood:0,pain:0}
  const rest=need(input.needs,'rest')
  const safety=need(input.needs,'safety')
  const social=need(input.needs,'social')
  const purpose=need(input.needs,'purpose')
  const variety=need(input.needs,'variety')
  const b=input.strongestBond
  const bond=b?unit(b.trust*.30+b.affinity*.30+b.familiarity*.20+b.recent*.20):0

  const stressAxis=unit(
    .20
    + unit(a.fear)*.30
    + unit(a.anger)*.14
    + unit(a.sadness)*.12
    + unit(a.pain)*.24
    + (1-rest)*.16
    + (1-safety)*.20
    - unit(a.joy)*.08
  )
  const socialBondingTone=unit(
    .10
    + bond*.48
    + social*.16
    + unit(a.joy)*.10
    + Math.max(0,Number(a.mood)||0)*.08
    - unit(a.fear)*.08
  )
  const rewardDrive=unit(
    .18
    + unit(a.joy)*.24
    + Math.max(0,Number(a.mood)||0)*.16
    + purpose*.22
    + variety*.12
    - stressAxis*.12
  )
  const arousal=unit(
    .16
    + unit(a.fear)*.28
    + unit(a.anger)*.24
    + unit(a.joy)*.10
    + unit(a.pain)*.12
    + (1-rest)*.15
  )
  return {stressAxis,socialBondingTone,rewardDrive,arousal}
}

/**
 * Family intent remains a reflective/social decision. Regulation may only
 * nudge the existing family desire; it cannot create desire or a partnership.
 */
export function regulatedFamilyDesire(base:number,state:RegulationState|null|undefined){
  if(!state)return unit(base)
  return unit(base + state.socialBondingTone*.06 - state.stressAxis*.08)
}
