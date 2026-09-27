import { observationTechnologyGap,ObservationCapabilityProfile } from './observationCapability'
import { instrumentDevelopmentGoal,profileSatisfiesDevelopmentGoal } from './instrumentDevelopment'
const base:ObservationCapabilityProfile={instrumentType:'basic-spectrometer',observable:'shock_mineral_signature',method:'spectroscopy',environments:['surface'],rangeMeters:20,uncertainty:.12,detectionLimit:.08}
const req={observable:'shock_mineral_signature',environment:'surface' as const,maxUncertainty:.02,maxDetectionLimit:.01,minRangeMeters:100}
const gap=observationTechnologyGap([base],req)!;const goal=instrumentDevelopmentGoal(gap)
let f=0;const ck=(x:boolean,m:string)=>{if(!x){f++;console.error('FAIL '+m)}}
ck(goal.basedOnInstrumentTypes[0]==='basic-spectrometer','existing instrument is development anchor')
ck(goal.targets.some(t=>t.dimension==='range'&&t.direction==='at_least'&&t.target===100),'range target explicit')
ck(goal.targets.some(t=>t.dimension==='uncertainty'&&t.direction==='at_most'&&t.target===.02),'uncertainty target explicit')
ck(!profileSatisfiesDevelopmentGoal(base,goal),'old instrument cannot satisfy goal')
const improved={...base,instrumentType:'advanced-spectrometer',rangeMeters:150,uncertainty:.015,detectionLimit:.008}
ck(profileSatisfiesDevelopmentGoal(improved,goal),'multiple implementations may satisfy requirements')
const again=instrumentDevelopmentGoal(gap);ck(again.id===goal.id,'same gap produces deterministic goal')
if(f)throw new Error(String(f));console.log('Instrument development goal: tests passed')