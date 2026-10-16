/** NOXIA-LIVING-0007: abstract homeostatic signals, not literal hormone concentrations. */
export type RegulationKey='stress'|'energy'|'recovery'|'arousal'|'inflammation'|'socialSafety'|'belonging'|'loneliness'
export type RegulationState={values:Record<RegulationKey,number>;updatedTick:number}
export type RegulationInputs={threat?:number;injury?:number;sleep?:number;food?:number;support?:number;rejection?:number;isolation?:number;meaningfulContact?:number}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0))
const keys:RegulationKey[]=['stress','energy','recovery','arousal','inflammation','socialSafety','belonging','loneliness']
const baseline:Record<RegulationKey,number>={stress:.2,energy:.7,recovery:.65,arousal:.4,inflammation:.05,socialSafety:.6,belonging:.6,loneliness:.15}
export function neutralRegulation(tick=0):RegulationState{return {values:{...baseline},updatedTick:tick}}
/** Lazy hourly update; bounded time, deterministic, no IO. Inputs represent observed events. */
export function advanceRegulation(state:RegulationState,tick:number,input:RegulationInputs={}):RegulationState{
 const hours=Math.max(0,Math.min(720,tick-state.updatedTick))
 const v={...state.values}
 for(const key of keys){const halfLife=key==='belonging'||key==='loneliness'?168:key==='socialSafety'?48:12
  const decay=Math.pow(.5,hours/halfLife);v[key]=clamp(baseline[key]+(v[key]-baseline[key])*decay)}
 const effect=(key:RegulationKey,delta:number)=>{v[key]=clamp(v[key]+delta)}
 const threat=clamp(input.threat??0),injury=clamp(input.injury??0),sleep=clamp(input.sleep??0),food=clamp(input.food??0)
 const support=clamp(input.support??0),rejection=clamp(input.rejection??0),isolation=clamp(input.isolation??0),contact=clamp(input.meaningfulContact??0)
 effect('stress',.4*threat+.25*injury+.22*rejection+.1*isolation-.18*support-.16*sleep)
 effect('arousal',.35*threat+.15*rejection-.2*sleep)
 effect('energy',.25*food+.2*sleep-.12*threat-.12*injury)
 effect('recovery',.25*sleep+.12*support-.2*injury-.1*threat)
 effect('inflammation',.35*injury-.07*sleep)
 effect('socialSafety',.25*support+.18*contact-.3*rejection-.12*threat)
 effect('belonging',.16*contact+.12*support-.24*rejection-.05*isolation)
 effect('loneliness',.23*isolation+.2*rejection-.2*contact-.1*support)
 return {values:v,updatedTick:Math.max(state.updatedTick,tick)}
}
export function regulationEffects(s:RegulationState){
 const v=s.values
 return {healingMultiplier:Math.max(.3,Math.min(1.3,.7+v.recovery*.55-v.stress*.25-v.inflammation*.25)),
 sleepPressure:clamp((1-v.energy)*.55+v.stress*.2),
 socialSeeking:clamp(v.loneliness*.6+(1-v.belonging)*.4),
 withdrawalBias:clamp(v.stress*.4+(1-v.socialSafety)*.35)}
}
