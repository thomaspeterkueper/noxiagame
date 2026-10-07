// Deterministic, low-cost reflex gate for persistent NOXIA persons.
// Reflexes respond to immediate stimuli. Memory may modulate sensitivity later,
// but does not create reflexes or canonical world facts.

export type ReflexKind = 'startle' | 'withdraw' | 'freeze' | 'orient' | 'social_alarm'

export interface ReflexProfile {
  startle:number
  withdraw:number
  freeze:number
  orient:number
  socialAlarm:number
}
export interface ReflexStimulus {
  kind:'sudden_sound'|'rapid_approach'|'pain'|'pressure_loss'|'unexpected_motion'|'alarm_call'
  intensity:number
  immediacy:number
}
export interface ReflexAdaptation { habituation:number; sensitization:number }
export interface ReflexResponse { kind:ReflexKind; strength:number; triggered:boolean; computeTier:0; reason:string }

const clamp01=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0))

export function reflexProfileFromTraits(traits:Record<string,unknown>|null|undefined):ReflexProfile{
  const n=(key:string,fallback:number)=>clamp01(typeof traits?.[key]==='number'?Number(traits[key]):fallback)
  return {startle:n('reflex_startle',.5),withdraw:n('reflex_withdraw',.55),freeze:n('reflex_freeze',.35),orient:n('reflex_orient',.6),socialAlarm:n('reflex_social_alarm',.45)}
}

export function reflexAdaptation(exposures:number, harmfulOutcomes:number):ReflexAdaptation{
  const safe=Math.max(0,exposures-harmfulOutcomes)
  return {habituation:clamp01(safe/20)*.45,sensitization:clamp01(harmfulOutcomes/5)*.55}
}

function disposition(profile:ReflexProfile,stimulus:ReflexStimulus):[ReflexKind,number]{
  switch(stimulus.kind){
    case 'pain': case 'rapid_approach': return ['withdraw',profile.withdraw]
    case 'pressure_loss': return ['freeze',Math.max(profile.freeze,profile.withdraw*.8)]
    case 'alarm_call': return ['social_alarm',profile.socialAlarm]
    case 'unexpected_motion': return ['orient',profile.orient]
    default:return ['startle',profile.startle]
  }
}

export function evaluateReflex(profile:ReflexProfile,stimulus:ReflexStimulus,adaptation:ReflexAdaptation={habituation:0,sensitization:0}):ReflexResponse{
  const [kind,base]=disposition(profile,stimulus)
  const sensitivity=clamp01(base-adaptation.habituation+adaptation.sensitization)
  const strength=clamp01(sensitivity*clamp01(stimulus.intensity)*(.65+.35*clamp01(stimulus.immediacy)))
  const triggered=strength>=.32
  return {kind,strength,triggered,computeTier:0,reason:triggered?'Immediate stimulus crossed reflex threshold.':'Stimulus remained below reflex threshold.'}
}
