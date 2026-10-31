/**
 * Narrative astrology seed for fictional NOXIA people.
 * Design vocabulary only, NOT evidence for real-world personality causality.
 * The resulting baseline is mutable by subsequent lived experiences.
 */
export const WESTERN_SIGNS=['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'] as const
export type WesternSign=typeof WESTERN_SIGNS[number]
export interface NarrativeBirthSeed {
  personId:string
  birthMonth?:number
  birthDay?:number
  chineseYear?:number
  worldSeed:string
}
export interface NarrativeTraitBaseline {
  archetype:WesternSign | 'unassigned'
  chineseAnimal:string | 'unassigned'
  traits:Record<'curiosity'|'empathy'|'autonomy'|'sociability'|'routine_stability'|'risk_tolerance',number>
  method:'fictional_astrology_v1'
  source:'author_design'
}
const ANIMALS=['rat','ox','tiger','rabbit','dragon','snake','horse','goat','monkey','rooster','dog','pig'] as const
const SIGN_BOUNDS:[number,number][]=[[3,21],[4,20],[5,21],[6,21],[7,23],[8,23],[9,23],[10,23],[11,22],[12,22],[1,20],[2,19]]
function signFor(month:number,day:number):WesternSign{
  for(let i=0;i<12;i++){
    const [m,d]=SIGN_BOUNDS[i]
    const next=SIGN_BOUNDS[(i+1)%12]
    if((month===m && day>=d)||(month===next[0] && day<next[1]))return WESTERN_SIGNS[i]
  }
  return WESTERN_SIGNS[0]
}
function hash(s:string):number {let h=2166136261;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),16777619)}return h>>>0}
// Editorial biases are deliberately small; per-person variation and subsequent experience dominate.
const SIGN_STYLE:Partial<Record<WesternSign,Partial<Record<'curiosity'|'empathy'|'autonomy'|'sociability'|'routine_stability'|'risk_tolerance',number>>>>={
  aries:{autonomy:0.06,risk_tolerance:0.06},taurus:{routine_stability:0.07},
  gemini:{curiosity:0.07,sociability:0.04},cancer:{empathy:0.07},
  leo:{sociability:0.06},virgo:{routine_stability:0.06},
  libra:{empathy:0.05,sociability:0.05},scorpio:{autonomy:0.05},
  sagittarius:{curiosity:0.07,risk_tolerance:0.04},capricorn:{routine_stability:0.07},
  aquarius:{autonomy:0.06,curiosity:0.05},pisces:{empathy:0.07},
}
const TRAITS=['curiosity','empathy','autonomy','sociability','routine_stability','risk_tolerance'] as const
export function narrativeTraitBaseline(input:NarrativeBirthSeed):NarrativeTraitBaseline {
  if(!input.personId.trim() || !input.worldSeed.trim())throw Error('stable person and world seed required')
  const validDate=Number.isInteger(input.birthMonth)&&Number.isInteger(input.birthDay)
    && input.birthMonth!>=1 && input.birthMonth!<=12
    && input.birthDay!>=1 && input.birthDay!<=new Date(Date.UTC(2000,input.birthMonth!,0)).getUTCDate()
  const archetype=validDate?signFor(input.birthMonth!,input.birthDay!):'unassigned'
  // Chinese lunar years do not begin Jan 1: an explicitly supplied lunar-zodiac year is required.
  const chineseAnimal=Number.isSafeInteger(input.chineseYear)?ANIMALS[((input.chineseYear!-4)%12+12)%12]:'unassigned'
  const traits={} as NarrativeTraitBaseline['traits']
  for(const key of TRAITS){
    const n=hash([input.worldSeed,input.personId,archetype,chineseAnimal,key].join('|'))/4294967295
    const bias=archetype==='unassigned'?0:(SIGN_STYLE[archetype]?.[key]??0)
    traits[key]=Math.round(Math.max(0.2,Math.min(0.8,0.25+n*0.5+bias))*1000)/1000
  }
  return {archetype,chineseAnimal,traits,method:'fictional_astrology_v1',source:'author_design'}
}
