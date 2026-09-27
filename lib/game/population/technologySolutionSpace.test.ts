import { TechnologyApproach,technologySolutionSpace } from './technologySolutionSpace'
const goal:any={id:'g',kind:'instrument_capability',observable:'shock',environment:'surface',basedOnInstrumentTypes:['basic'],reason:'observation_technology_gap',targets:[{dimension:'uncertainty',direction:'at_most',target:.02},{dimension:'range',direction:'at_least',target:100}]}
const common={developmentKind:'instrument' as const,basedOnInstrumentType:'basic',knowledge:[],materials:[],components:[],capabilities:[],estimatedCredits:5,estimatedEnergy:4,estimatedTimeTicks:3,risk:.1}
const approaches:TechnologyApproach[]=[
 {...common,id:'better-optics',descriptionCode:'improve_optics',predictedTargets:{uncertainty:.018,range:120},materials:[{materialType:'precision_glass',amount:2}]},
 {...common,id:'array-fusion',descriptionCode:'sensor_array_fusion',predictedTargets:{uncertainty:.015,range:150},components:[{componentType:'detector_array',amount:2}],capabilities:[{capability:'signal_fusion',minLevel:2}]},
 {...common,id:'cheap-filter',descriptionCode:'filter_only',predictedTargets:{uncertainty:.04,range:110}},
]
const state={knowledge:[],materials:{precision_glass:2},components:{detector_array:0},capabilities:{signal_fusion:1},credits:20,energy:20,availableTimeTicks:20}
const r=technologySolutionSpace(goal,approaches,state);let f=0;const ck=(x:boolean,m:string)=>{if(!x){f++;console.error('FAIL '+m)}}
ck(r.filter(x=>x.addressesGoal).length===2,'two different approaches can satisfy same goal')
ck(r[0].approach.id==='better-optics'&&r[0].executable,'currently feasible approach ranks first')
const array=r.find(x=>x.approach.id==='array-fusion')!;ck(array.addressesGoal&&!array.executable,'promising approach can be blocked')
ck(array.blockers.includes('component')&&array.blockers.includes('capability'),'blockers remain ordinary prerequisites')
ck(!r.find(x=>x.approach.id==='cheap-filter')!.addressesGoal,'partial improvement is not falsely accepted')
if(f)throw new Error(String(f));console.log('Technology solution space: tests passed')