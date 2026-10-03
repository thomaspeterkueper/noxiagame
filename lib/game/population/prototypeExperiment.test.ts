import { prototypeFromApproach,evaluatePrototype } from './prototypeExperiment'
const goal:any={id:'g',kind:'instrument_capability',observable:'shock',environment:'surface',basedOnInstrumentTypes:['basic'],reason:'observation_technology_gap',targets:[{dimension:'uncertainty',direction:'at_most',target:.02},{dimension:'range',direction:'at_least',target:100}]}
const approach:any={id:'optics',developmentKind:'instrument',descriptionCode:'better',predictedTargets:{uncertainty:.015,range:130},knowledge:[],materials:[],components:[],capabilities:[],estimatedTimeTicks:1,estimatedCredits:1,estimatedEnergy:1,risk:.1}
const p=prototypeFromApproach({id:'p1',instrumentType:'prototype-spectrometer',observable:'shock',method:'spectroscopy',environments:['surface'],approach})
let f=0;const ck=(x:boolean,m:string)=>{if(!x){f++;console.error('FAIL '+m)}}
ck(!('predictedTargets' in (p as any)),'prototype does not inherit predicted performance as truth')
const poor=evaluatePrototype(p,{prototypeId:'p1',testId:'t1',measuredTick:10,measuredProfile:{instrumentType:'prototype-spectrometer',observable:'shock',method:'spectroscopy',environments:['surface'],uncertainty:.03,rangeMeters:120},evidenceRefs:['lab:t1']},goal)
ck(poor.outcome==='partial'&&poor.unmetDimensions.includes('uncertainty'),'partial prototype keeps measured failure')
const good=evaluatePrototype(p,{prototypeId:'p1',testId:'t2',measuredTick:11,measuredProfile:{instrumentType:'prototype-spectrometer',observable:'shock',method:'spectroscopy',environments:['surface'],uncertainty:.018,rangeMeters:115},evidenceRefs:['lab:t2']},goal)
ck(good.outcome==='meets_goal','later measured improvement can satisfy goal')
ck(good.evidenceRefs[0]==='lab:t2','validation remains evidence-linked')
let threw=false;try{evaluatePrototype(p,{prototypeId:'other',testId:'bad',measuredTick:12,measuredProfile:good.measuredProfile,evidenceRefs:[]},goal)}catch{threw=true}ck(threw,'foreign measurement rejected')
if(f)throw new Error(String(f));console.log('Prototype measurement loop: tests passed')