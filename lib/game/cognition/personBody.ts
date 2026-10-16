// Deterministic physical body core for NOXIA persons.
// Canonical body state is distinct from health summary, felt pain and emotion.

export type BodyRegion =
  | 'head' | 'torso'
  | 'left_arm' | 'right_arm' | 'left_hand' | 'right_hand'
  | 'left_leg' | 'right_leg' | 'left_foot' | 'right_foot'

export type TissueKind = 'skin' | 'muscle' | 'bone' | 'joint' | 'organ'

export interface TissueInjury {
  id: string
  region: BodyRegion
  tissue: TissueKind
  damage: number
  inflammation: number
  healing: number
  acute: boolean
}

export interface PersonBodyState {
  injuries: TissueInjury[]
  coreTemperatureStress: number
  oxygenStress: number
  hydrationStress: number
  energyStress: number
  fatigue: number
}

export interface BodyInsult {
  id: string
  kind: 'thermal' | 'mechanical' | 'chemical'
  region: BodyRegion
  tissue?: TissueKind
  intensity: number
  duration: number
}

export interface InteroceptiveState {
  nociception: number
  systemicDistress: number
  urgency: number
  dominantRegion: BodyRegion | null
  sourceInjuryId: string | null
}

export interface BodyProjection {
  body: PersonBodyState
  interoception: InteroceptiveState
  reflexStimulus: { kind: 'pain'; intensity: number; immediacy: number } | null
  painSignal: number
}

const clamp01=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0
const round=(v:number)=>Math.round(v*1_000_000)/1_000_000

export function healthyBody():PersonBodyState{
  return {injuries:[],coreTemperatureStress:0,oxygenStress:0,hydrationStress:0,energyStress:0,fatigue:0}
}

export function applyBodyInsult(current:PersonBodyState,insult:BodyInsult):PersonBodyState{
  const intensity=clamp01(insult.intensity)
  const duration=clamp01(insult.duration)
  const factor=insult.kind==='thermal'?0.9:insult.kind==='mechanical'?0.8:0.7
  const added=clamp01(intensity*duration*factor)
  if(added<0.03)return current
  const tissue=insult.tissue??'skin'
  const existing=current.injuries.find(i=>i.id===insult.id)
  const injury:TissueInjury=existing?{
    ...existing,
    damage:round(clamp01(existing.damage+added*(1-existing.damage))),
    inflammation:round(clamp01(Math.max(existing.inflammation,added*.45))),
    acute:true,
  }:{
    id:insult.id,region:insult.region,tissue,
    damage:round(added),inflammation:round(added*.35),healing:0,acute:true,
  }
  return {...current,injuries:[...current.injuries.filter(i=>i.id!==insult.id),injury]}
}

export function advanceBodyHealing(current:PersonBodyState,hours=1):PersonBodyState{
  const dt=Math.max(0,Math.min(24,hours))
  const injuries=current.injuries.map(i=>{
    const healRate=i.tissue==='skin'?.018:i.tissue==='muscle'?.012:i.tissue==='bone'?.006:.009
    const repair=clamp01(healRate*dt*(1-i.inflammation*.55))
    const damage=round(clamp01(i.damage-repair))
    const inflammation=round(clamp01(i.inflammation-.012*dt))
    return {...i,damage,inflammation,healing:round(clamp01(i.healing+repair)),acute:false}
  }).filter(i=>i.damage>.005||i.inflammation>.005)
  return {...current,injuries}
}

export function senseBody(body:PersonBodyState):InteroceptiveState{
  const sensed=body.injuries.map(i=>{
    const tissueWeight=i.tissue==='skin'?1:i.tissue==='joint'?.85:i.tissue==='muscle'?.8:i.tissue==='bone'?.9:.7
    const nociception=clamp01((i.damage*.72+i.inflammation*.28)*tissueWeight)
    return {injury:i,nociception}
  }).sort((a,b)=>b.nociception-a.nociception||a.injury.id.localeCompare(b.injury.id))
  const dominant=sensed[0]
  const nociception=dominant?.nociception??0
  const systemicDistress=Math.max(clamp01(body.coreTemperatureStress),clamp01(body.oxygenStress),clamp01(body.hydrationStress)*.8,clamp01(body.energyStress)*.55,clamp01(body.fatigue)*.45)
  return {
    nociception:round(nociception),
    systemicDistress:round(systemicDistress),
    urgency:round(clamp01(nociception*.7+systemicDistress*.55)),
    dominantRegion:dominant?.injury.region??null,
    sourceInjuryId:dominant?.injury.id??null,
  }
}

export function projectBody(body:PersonBodyState):BodyProjection{
  const interoception=senseBody(body)
  const acute=body.injuries.some(i=>i.id===interoception.sourceInjuryId&&i.acute)
  const painSignal=round(clamp01(interoception.nociception*.85+interoception.systemicDistress*.25))
  return {
    body,interoception,painSignal,
    reflexStimulus:acute&&interoception.nociception>=.2
      ?{kind:'pain',intensity:interoception.nociception,immediacy:1}
      :null,
  }
}
