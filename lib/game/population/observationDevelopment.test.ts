import { assessObservationDevelopment } from './observationDevelopment'
import type { ObservationCapabilityProfile } from './observationCapability'
import type { TechnologyApproach,TechnologyActorState } from './technologySolutionSpace'

const base:ObservationCapabilityProfile={instrumentType:'basic-spectrometer',observable:'mineral_signature',method:'spectroscopy',environments:['surface'],rangeMeters:20,uncertainty:.12,detectionLimit:.08}
const state:TechnologyActorState={knowledge:[],materials:{precision_glass:2},components:{detector_array:2},capabilities:{signal_fusion:2},credits:20,energy:20,availableTimeTicks:20}
const common={developmentKind:'instrument' as const,basedOnInstrumentType:'basic-spectrometer',knowledge:[],materials:[],components:[],capabilities:[],estimatedCredits:5,estimatedEnergy:4,estimatedTimeTicks:3,risk:.1}
const approaches:TechnologyApproach[]=[
 {...common,id:'better-optics',descriptionCode:'improve_optics',predictedTargets:{uncertainty:.018,detection_limit:.008,range:120},materials:[{materialType:'precision_glass',amount:2}]},
 {...common,id:'array-fusion',descriptionCode:'sensor_array_fusion',predictedTargets:{uncertainty:.015,detection_limit:.006,range:150},components:[{componentType:'detector_array',amount:2}],capabilities:[{capability:'signal_fusion',minLevel:2}]},
]
let f=0;const ck=(x:boolean,m:string)=>{if(!x){f++;console.error('FAIL '+m)}}
const ordinary=assessObservationDevelopment({catalog:[base],requirement:{observable:'mineral_signature',environment:'surface',maxUncertainty:.15,maxDetectionLimit:.1,minRangeMeters:10},approaches,actorState:state})
ck(ordinary.developmentGoal===null&&ordinary.sufficientInstrumentTypes[0]==='basic-spectrometer','existing adequate instrument prevents fake R&D')
const demanding=assessObservationDevelopment({catalog:[base],requirement:{observable:'mineral_signature',environment:'surface',maxUncertainty:.02,maxDetectionLimit:.01,minRangeMeters:100},approaches,actorState:state})
ck(demanding.developmentGoal!==null,'real measurement gap creates development goal')
ck(demanding.solutionSpace.length===2&&demanding.solutionSpace.every(x=>x.addressesGoal),'one gap can admit competing valid approaches')
ck(demanding.solutionSpace.every(x=>x.executable),'actor prerequisites determine executable approaches')
if(f)throw new Error(String(f));console.log('Observation development bridge: tests passed')
