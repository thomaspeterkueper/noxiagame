import { applyForgetting, consolidateDuringSleep, createNpcMemory, exchangeMemory, memoriesAreIndependent, reconstructNpcMemory } from './npcRelationalMemory'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}

const lan=createNpcMemory({npcId:'lan',subjectRef:'cafe:door',attribute:'open',value:true,sourceRef:'perception:lan',confidence:.72,salience:.8,atTick:10})
const slept=consolidateDuringSleep(lan.memory,lan.trace,20)
check(slept.memory.state==='consolidated' && slept.trace.durability==='persistent','sleep consolidates salient memory without LLM')

const hana=exchangeMemory({listenerId:'hana',speakerMemory:slept.memory,speakerTrace:slept.trace,listenerClock:{},atTick:21})
check(!memoriesAreIndependent(slept.memory,hana.memory,[slept.trace,hana.trace]),'hearsay preserves common provenance')

const directHana=createNpcMemory({npcId:'hana',subjectRef:'cafe:door',attribute:'open',value:false,sourceRef:'perception:hana',confidence:.8,salience:.7,atTick:22,clock:hana.clock})
check(memoriesAreIndependent(slept.memory,directHana.memory,[slept.trace,hana.trace,directHana.trace]),'independent perceptions remain independent even when contradictory')

const lanView=reconstructNpcMemory({npcId:'lan',subjectRef:'cafe:door',attribute:'open',possibleValues:[true,false],memories:[slept.memory],traces:[slept.trace,directHana.trace]})
const hanaView=reconstructNpcMemory({npcId:'hana',subjectRef:'cafe:door',attribute:'open',possibleValues:[true,false],memories:[directHana.memory],traces:[slept.trace,directHana.trace]})
check(lanView.status==='determined' && lanView.candidates.find(c=>c.value===true)?.compatible===true,'Lan can honestly reconstruct open')
check(hanaView.status==='determined' && hanaView.candidates.find(c=>c.value===false)?.compatible===true,'Hana can honestly reconstruct closed')

const forgotten=applyForgetting(directHana.memory,directHana.trace,200,20)
check(forgotten.memory.state==='forgotten' && !forgotten.trace.active,'forgetting removes the NPC-accessible trace')
const reopened=reconstructNpcMemory({npcId:'hana',subjectRef:'cafe:door',attribute:'open',possibleValues:[true,false],memories:[forgotten.memory],traces:[forgotten.trace]})
check(reopened.status==='open','forgotten unsupported detail becomes open for that NPC')

if(failures) throw new Error(String(failures)+' npc relational memory test(s) failed')
console.log('NPC relational memory v0.2: tests passed; external_llm_calls=0; persistence_writes=0')
