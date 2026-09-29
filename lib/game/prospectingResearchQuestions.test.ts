import { planProspectingQuestion,PROSPECTING_RESEARCH_QUESTIONS } from './prospectingResearchQuestions'
let f=0;const ck=(x:boolean,m:string)=>{if(!x){f++;console.error('FAIL '+m)}}
ck(PROSPECTING_RESEARCH_QUESTIONS.every(q=>q.learningPathId==='PATH:SSF:NOX-SCIENTIFIC-OBSERVATION-0001'),'all questions connect to canonical SSF path')
const seismic=planProspectingQuestion('subsurface-structure',['seismic'])
ck(seismic!==null&&!seismic.gap&&seismic.sufficientInstrumentIds.includes('seismic'),'owned adequate seismic instrument closes measurement gap')
const missing=planProspectingQuestion('subsurface-structure',[])
ck(missing!==null&&missing.gap!==null,'missing instrument produces capability gap')
const wrong=planProspectingQuestion('magnetic-anomaly',['hyperspectral'])
ck(wrong!==null&&wrong.gap?.missingDimensions.includes('observable')===true,'wrong measurement method does not satisfy question')
const orbital=planProspectingQuestion('regional-survey',['orbital'])
ck(orbital!==null&&!orbital.gap,'owned orbital instrument satisfies regional survey')
if(f)throw new Error(String(f));console.log('Prospecting research question planner: tests passed')
