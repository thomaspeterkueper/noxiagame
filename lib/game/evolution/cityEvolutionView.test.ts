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

const check = (condition: boolean, label: string) => { if (!condition) throw Error(label) }
const project = (overrides: Record<string, unknown> = {}) => cityEvolutionView({
 settlementId:'seelenberg', fromYear:2026, toYear:2100,
 importedBaseline:[{id:'old',kind:'building',name:'Altes Haus',districtId:'core',introducedYear:2026}],
 authoritativeReceipts:[], ...overrides
} as Parameters<typeof cityEvolutionView>[0])

// Untrusted JSON must not crash the view before the receipt adapter can reject it.
const malformed = project({authoritativeReceipts:[
 null, undefined,
 {eventId:'missing-settlement',committed:true},
 {eventId:'foreign',settlementId:'brombach',committed:true},
 {eventId:'proposal',settlementId:'seelenberg',worldYear:2050,sequence:1,domain:'buildings',
  domainEventRef:'proposal:1',actorRef:'npc:1',committed:false,change:{action:'retire',assetId:'old'}}
]})
check(malformed.before.assets.length===1 && malformed.after.assets.length===1,
 'malformed receipts and uncommitted ideas cannot alter the world')
check(malformed.rejectedReceipts.length===4 &&
 malformed.rejectedReceipts.filter(r=>r.reason==='invalid_receipt').length===3 &&
 malformed.rejectedReceipts.some(r=>r.reason==='not_committed'),
 'malformed and proposed receipts must be reported, foreign settlements ignored')
for (const overrides of [
 {fromYear:NaN}, {toYear:Infinity}, {fromYear:2026.5},
 {fromYear:2101,toYear:2100}, {settlementId:' '},
 {authoritativeReceipts:null}, {importedBaseline:null}
]) {
 let threw=false
 try { project(overrides) } catch { threw=true }
 check(threw, 'invalid city view input must be rejected')
}
// Imported map baseline is the starting snapshot, never a source of arbitrary state.
const validAsset = {id:'old',kind:'building',name:'Altes Haus',districtId:'core',introducedYear:2026}
for (const importedBaseline of [
 [null],
 [undefined],
 ['old'],
 [{...validAsset,id:' '}],
 [{...validAsset,kind:'unknown'}],
 [{...validAsset,introducedYear:NaN}],
 [{...validAsset,introducedYear:'2026'}],
 [{...validAsset,name:null}],
 [{...validAsset,districtId:''}],
 [validAsset,{...validAsset,name:'Konflikt'}],
]) {
 let threw=false
 try { project({importedBaseline}) } catch { threw=true }
 check(threw, 'invalid or duplicate imported asset must fail closed before replay')
}
// A baseline is a snapshot, not a queue of future construction instructions.
// Otherwise a future-dated imported building could appear without a Core event.
let rejectedFutureImport=false
try { project({importedBaseline:[{...validAsset,id:'phantom',introducedYear:2080}]}) }
catch { rejectedFutureImport=true }
check(rejectedFutureImport, 'future-dated import cannot materialize without committed Core event')
const historicalImport=project({importedBaseline:[{...validAsset,introducedYear:2020}]})
check(historicalImport.before.assets[0]?.id==='old' && historicalImport.after.assets[0]?.id==='old',
 'already-existing historical baseline asset remains visible')

const emptyBaseline = project({importedBaseline:[]})
check(emptyBaseline.before.assets.length===0 && emptyBaseline.after.assets.length===0,
 'empty initial import is valid and remains empty without confirmed events')

let rejectedNullInput=false
try { cityEvolutionView(null as unknown as Parameters<typeof cityEvolutionView>[0]) }
catch { rejectedNullInput=true }
check(rejectedNullInput, 'null view input must fail closed')
