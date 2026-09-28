import { prospectingObservationCatalog,assessProspectingObservation } from './resourceObservationPlanning'
const catalog=prospectingObservationCatalog(['hyperspectral','seismic','not-real'])
let f=0;const ck=(x:boolean,m:string)=>{if(!x){f++;console.error('FAIL '+m)}}
ck(catalog.length===2,'only canonical owned instruments enter catalog')
ck(catalog.find(x=>x.instrumentType==='hyperspectral')?.observable==='spectral_reflectance','hyperspectral maps to spectral observable')
ck(catalog.find(x=>x.instrumentType==='seismic')?.rangeMeters===450,'live scanner range is preserved')
const state={knowledge:[],materials:{},components:{},capabilities:{},credits:20,energy:20,availableTimeTicks:20}
const noGap=assessProspectingObservation({ownedInstrumentIds:['seismic'],requirement:{observable:'subsurface_structure',environment:'surface',minRangeMeters:400},approaches:[],actorState:state})
ck(noGap.developmentGoal===null,'adequate owned seismic instrument prevents fake research goal')
const gap=assessProspectingObservation({ownedInstrumentIds:['seismic'],requirement:{observable:'subsurface_structure',environment:'surface',minRangeMeters:1000},approaches:[],actorState:state})
ck(gap.developmentGoal!==null&&gap.developmentGoal.targets.some(t=>t.dimension==='range'&&t.target===1000),'real range gap becomes development target')
if(f)throw new Error(String(f));console.log('Resource observation planning: tests passed')
