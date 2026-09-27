import { instrumentsForObservation,observationTechnologyGap,ObservationCapabilityProfile } from './observationCapability'
const catalog:ObservationCapabilityProfile[]=[
 {instrumentType:'field-camera',observable:'surface_morphology',method:'imaging',environments:['surface'],rangeMeters:500,spatialResolutionMeters:.5,uncertainty:.15,energyPerObservation:1,durationTicks:1},
 {instrumentType:'basic-spectrometer',observable:'shock_mineral_signature',method:'spectroscopy',environments:['surface'],rangeMeters:20,spatialResolutionMeters:1,uncertainty:.12,detectionLimit:.08,energyPerObservation:4,durationTicks:2},
]
let f=0;const ck=(x:boolean,m:string)=>{if(!x){f++;console.error('FAIL '+m)}}
const ordinary={observable:'shock_mineral_signature',environment:'surface' as const,maxUncertainty:.15,maxDetectionLimit:.1,minRangeMeters:10}
ck(instrumentsForObservation(catalog,ordinary)[0].profile.instrumentType==='basic-spectrometer','right sensor selected')
ck(observationTechnologyGap(catalog,ordinary)===null,'adequate instrument means no technology gap')
const demanding={...ordinary,maxUncertainty:.02,maxDetectionLimit:.01,minRangeMeters:100}
const gap=observationTechnologyGap(catalog,demanding)
ck(gap!==null,'unmeasurable requirement becomes technology gap')
ck(gap!.candidateInstrumentTypes.includes('basic-spectrometer'),'nearest existing instrument retained as development anchor')
ck(gap!.missingDimensions.includes('uncertainty')&&gap!.missingDimensions.includes('detection_limit')&&gap!.missingDimensions.includes('range'),'specific missing capabilities exposed')
if(f)throw new Error(String(f));console.log('Observation capability: tests passed')
