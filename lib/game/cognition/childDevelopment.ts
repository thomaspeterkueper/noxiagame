// Persistent developmental projection for children in Living Population.
//
// The life-course clock is intentionally compressed (SOCIAL_YEAR_TICKS).
// Development stages are simulation policy gates, not biological diagnoses.

export type ChildDevelopmentStage =
  | 'newborn'
  | 'infant'
  | 'toddler'
  | 'early_childhood'
  | 'middle_childhood'
  | 'adolescent'

export interface ChildDevelopmentState {
  stage: ChildDevelopmentStage
  ageYears: number
  computeTier: 0|1|2
  sleeping: boolean
  sensoryWeight: number
  memoryWeight: number
  symbolicWeight: number
  socialLearningWeight: number
}

const unit=(v:number)=>Math.max(0,Math.min(1,v))

export function childDevelopmentStage(ageTicks:number,yearTicks:number):ChildDevelopmentStage{
  const years=Math.max(0,ageTicks)/Math.max(1,yearTicks)
  if(years<28/365)return 'newborn'
  if(years<1)return 'infant'
  if(years<3)return 'toddler'
  if(years<6)return 'early_childhood'
  if(years<12)return 'middle_childhood'
  return 'adolescent'
}

function ramp(years:number,start:number,full:number){
  if(years<=start)return 0
  if(years>=full)return 1
  return unit((years-start)/(full-start))
}

function sleepHours(stage:ChildDevelopmentStage){
  if(stage==='newborn')return 16
  if(stage==='infant')return 14
  if(stage==='toddler')return 12
  if(stage==='early_childhood')return 11
  if(stage==='middle_childhood')return 10
  return 9
}

export function childDevelopmentState(ageTicks:number,yearTicks:number,tick:number):ChildDevelopmentState{
  const ageYears=Math.max(0,ageTicks)/Math.max(1,yearTicks)
  const stage=childDevelopmentStage(ageTicks,yearTicks)
  const sensoryWeight=unit(.35+ramp(ageYears,0,.5)*.65)
  const memoryWeight=unit(.12+ramp(ageYears,.15,4)*.88)
  const socialLearningWeight=unit(.25+ramp(ageYears,0,5)*.75)
  const symbolicWeight=ramp(ageYears,1.2,8)
  const computeTier:0|1|2 = symbolicWeight>=.75?2:symbolicWeight>=.18?1:0
  const hours=sleepHours(stage)
  const hour=((Math.trunc(tick)%24)+24)%24
  const sleeping=hours>=14
    ? hour<6||(hour>=9&&hour<12)||(hour>=14&&hour<17)||hour>=20
    : hour<Math.ceil(hours*.55)||hour>=24-Math.floor(hours*.45)
  return {stage,ageYears,computeTier,sleeping,sensoryWeight,memoryWeight,symbolicWeight,socialLearningWeight}
}
