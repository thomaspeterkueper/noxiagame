import { reviewPersistedEncounter } from './npcSymbolicSnapshotBridge'
import type { PersonNeed, PersonRelationship } from '../population/types'
const check=(x:boolean,m:string)=>{if(!x)throw Error(m)}
const needs=(id:string,satisfaction:number)=>[{personId:id,needCode:'rest',satisfaction,updatedTick:42}] as PersonNeed[]
const relation=(id:string,trust:number)=>[{id:'r:'+id,personId:id,otherPersonId:'target',relationshipType:'friend',familiarity:.7,trust,affinity:.8,lastInteractionTick:40}] as PersonRelationship[]
const a=reviewPersistedEncounter({npcId:'a',needs:needs('a',.95),relationships:relation('a',.9),observedPersonId:'target',observedDistress:.8,rememberedConflict:false})
const b=reviewPersistedEncounter({npcId:'b',needs:needs('b',.1),relationships:relation('b',.2),observedPersonId:'target',observedDistress:.8,rememberedConflict:true})
check(a.baseline.approach>b.baseline.approach,'own persisted needs and trust impact decision')
check(a.symbolic.sourceRefs.every(x=>x.endsWith(':a')),'no hidden cross-NPC memories')
check(b.symbolic.sourceRefs.every(x=>x.endsWith(':b')),'no cross-NPC knowledge leak')
check(a.diagnostics.missingAffect&& !a.diagnostics.missingRelationship,'missing affect explicitly surfaced')
const missing=reviewPersistedEncounter({npcId:'c',needs:[],relationships:[],observedPersonId:'target',observedDistress:.8,rememberedConflict:false})
check(missing.diagnostics.missingRelationship,'relationship fallback disclosed')
console.log('NPC persisted-snapshot symbolic comparison passed')
