import { cityEvolutionView } from './cityEvolutionView'
const view=cityEvolutionView({
 settlementId:'seelenberg',fromYear:2026,toYear:2100,
 importedBaseline:[{id:'old',kind:'building',name:'Altes Haus',districtId:'core',introducedYear:2026}],
 authoritativeReceipts:[
  {eventId:'idea',settlementId:'seelenberg',worldYear:2040,sequence:1,domain:'buildings',
   domainEventRef:'proposal:1',actorRef:'npc:1',committed:false,
   change:{action:'retire',assetId:'old'}},
  {eventId:'built',settlementId:'seelenberg',worldYear:2080,sequence:1,domain:'buildings',
   domainEventRef:'core:build:1',actorRef:'npc:2',committed:true,
   change:{action:'establish',asset:{id:'future',kind:'institution',name:'Gemeinschaftslabor',districtId:'core',introducedYear:2080}}}
 ]
})
if(view.before.assets.length!==1 || view.after.assets.length!==2) throw Error('historical projection mismatch')
if(view.changes.added[0]?.id!=='future') throw Error('future building absent')
if(view.rejectedReceipts[0]?.reason!=='not_committed') throw Error('proposal must not alter history')
console.log('City evolution view composition checks passed')
