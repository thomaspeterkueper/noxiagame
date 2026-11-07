import { rankBiographyIntentions } from './socialIntentionRanking'
import type { SocialGoalSignal } from './biographyGoalSignals'
let fails=0
const check=(v:boolean,label:string)=>{if(!v){fails++;console.error('FAIL',label)}}
const s:SocialGoalSignal={npcId:'a',relatedPersonId:'b',sourceEventId:'event-1',sourceMemoryId:'memory-1',goal:'offer_support',strength:0.8,canonical:false}
const opp={relatedPersonId:'b',reachable:true,contactAllowed:true,relationshipCloseness:0.9}
const needs={energy:0.9,safety:0.1,socialConnection:0.8}
const good=rankBiographyIntentions('a',[s],[opp],needs)
check(good.length===1 && good[0].executable===false,'only proposed intention')
check(rankBiographyIntentions('a',[s],[{...opp,contactAllowed:false}],needs).length===0,'contact boundary')
check(rankBiographyIntentions('a',[s],[{...opp,reachable:false}],needs).length===0,'reachability gate')
check(rankBiographyIntentions('other',[s],[opp],needs).length===0,'different NPC cannot borrow memory')
check(rankBiographyIntentions('a',[s],[opp,{...opp,relatedPersonId:'x'}],{...needs,safety:1})[0].score < good[0].score,'danger lowers social priority')
check(JSON.stringify(good)===JSON.stringify(rankBiographyIntentions('a',[s],[opp],needs)),'deterministic')
if(fails)throw Error(fails+' intention tests failed')
console.log('Social intention ranking tests passed')
