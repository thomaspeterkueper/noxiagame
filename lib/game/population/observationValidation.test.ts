import { assessObservationValidation } from './observationValidation'
import { prototypeFromApproach,evaluatePrototype } from './prototypeExperiment'
import { prototypeResiduals } from './prototypeResidual'
let failures=0;const check=(v:boolean,m:string)=>{if(!v){failures++;console.error('FAIL '+m)}}
const goal:any={id:'g',kind:'instrument_capability',observable:'shock',environment:'surface',basedOnInstrumentTypes:['basic'],reason:'observation_technology_gap',targets:[{dimension:'uncertainty',direction:'at_most',target:.02},{dimension:'range',direction:'at_least',target:100}]}
const approach:any={id:'optics',developmentKind:'instrument',descriptionCode:'better',predictedTargets:{uncertainty:.015,range:130},knowledge:[],materials:[],components:[],capabilities:[],estimatedTimeTicks:1,estimatedCredits:1,estimatedEnergy:1,risk:.1}
const p=prototypeFromApproach({id:'p1',instrumentType:'prototype',observable:'shock',method:'spectroscopy',environments:['surface'],approach})
check(!('predictedTargets' in (p as any)),'prediction is not measured truth')
const measurement:any={prototypeId:'p1',testId:'t1',measuredTick:10,measuredProfile:{instrumentType:'prototype',observable:'shock',method:'spectroscopy',environments:['surface'],uncertainty:.03,rangeMeters:120},evidenceRefs:['lab:t1']}
check(evaluatePrototype(p,measurement,goal).outcome==='partial','measured underperformance remains partial')
const residuals=prototypeResiduals(approach,measurement,0)
check(residuals.find(r=>r.dimension==='uncertainty')?.classification==='underperform','uncertainty residual diagnoses underperformance')
check(residuals.find(r=>r.dimension==='range')?.classification==='underperform','range residual diagnoses underperformance')
const q=assessObservationValidation({profile:measurement.measuredProfile,validationState:'lab_validated',validatedEnvironments:['surface'],evidenceRefs:['lab:t1'],sensorTopology:'mobile',access:{mobile:true,maxTravelMeters:100},signalSeparation:{method:'spectral',suppressionRatio:100},selfInterference:{characterized:false},calibrationTick:5},{environment:'surface',minValidationState:'field_validated',maxCalibrationAgeTicks:3,requireMobileAccess:true,minSignalSuppressionRatio:50,requireCharacterizedSelfInterference:true},10)
check(q.gaps.includes('validation')&&q.gaps.includes('calibration')&&q.gaps.includes('self_interference'),'qualification exposes exact blockers')
if(failures)throw new Error(String(failures));console.log('Observation validation contract: tests passed')
