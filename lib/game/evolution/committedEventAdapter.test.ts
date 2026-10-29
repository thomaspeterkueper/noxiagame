import { adaptCommittedWorldEvents, type CommittedWorldReceipt } from './committedEventAdapter'
import { cityAtYear, compareCityYears, type CityAsset } from './cityChronicle'
const assert = (ok: boolean, label: string) => { if (!ok) throw new Error(label) }
const baseline: CityAsset[] = [{ id:'hall',kind:'building',name:'Alte Halle',districtId:'center',introducedYear:2026 }]
const receipt = (eventId:string,year:number,committed:boolean,change:CommittedWorldReceipt['change']):CommittedWorldReceipt =>
 ({eventId,worldYear:year,sequence:1,settlementId:'seelenberg',domain:'buildings',domainEventRef:'core:'+eventId,actorRef:'npc:lan',committed,change})
const receipts = [
 receipt('proposal',2040,false,{ action:'retire',assetId:'hall' }),
 receipt('approved',2050,true,{ action:'rename',assetId:'hall',name:'Bürgerzentrum' }),
 receipt('build',2070,true,{ action:'establish',asset:{id:'lab',kind:'institution',name:'Forschungshaus',districtId:'center',introducedYear:2070} }),
]
const adapted = adaptCommittedWorldEvents(receipts)
assert(adapted.events.length===2 && adapted.rejected[0].reason==='not_committed','uncommitted proposal excluded')
const at = (year:number)=> cityAtYear({settlementId:'seelenberg',year,baseline,events:adapted.events})
assert(at(2040).assets[0].name==='Alte Halle','uncommitted proposal has no effect')
assert(at(2050).assets[0].name==='Bürgerzentrum','approved change appears at correct year')
assert(at(2070).assets.length===2,'later building appears')
assert(compareCityYears(at(2026),at(2070)).added.length===1,'city diff shows new building')
assert(adaptCommittedWorldEvents([...receipts, receipts[1]]).rejected.some(r=>r.reason==='duplicate'),'duplicate event rejected')
console.log('Committed city event adapter: tests passed')
