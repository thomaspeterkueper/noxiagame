import { biographyGoalSignals } from './biographyGoalSignals'
import { rememberBiographyEvent } from './biographyMemoryAdapter'
import type { NpcMemoryState } from './npcRelationalMemory'
import type { BiographyEvent } from './biographyEvents'
let failures=0
function check(ok:boolean,s:string){if(!ok){failures++;console.error('FAIL',s)}}
const initial:NpcMemoryState={npcId:'observer',clock:{},memories:[],traces:[]}
const birth:BiographyEvent={id:'birth-1',personId:'child',tick:10,kind:'birth'}
const witnessed=rememberBiographyEvent(initial,birth,{npcId:'observer',perceivedEventId:birth.id,atTick:12,sourceRef:'observed:birth-1',confidence:0.9,salience:0.8})
const goals=biographyGoalSignals(witnessed,[birth],13)
check(goals.length===1 && goals[0].goal==='offer_support','birth motivates help')
check(goals[0].canonical===false,'not a world command')
check(biographyGoalSignals(initial,[birth],13).length===0,'unobserved event does not cause goals')
check(biographyGoalSignals(witnessed,[],13).length===0,'source event required')
check(biographyGoalSignals(witnessed,[birth],1000)[0].strength<goals[0].strength,'motivation decays')
check(biographyGoalSignals(witnessed,[birth],11).length===0,'future memory inaccessible')
check(JSON.stringify(goals)===JSON.stringify(biographyGoalSignals(witnessed,[birth],13)),'deterministic')
if(failures)throw Error(failures+' social goal tests failed')
console.log('Biography goal signal tests passed')
