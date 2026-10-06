import { epistemicallyAllowedArtifactTypes } from './researchSupabaseStore'
let failures=0;const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}
const temporal=epistemicallyAllowedArtifactTypes(['temporal_protocol_revision'])
check(temporal.includes('research_finding') && temporal.includes('controversy_revision'),'persistent temporal grant maps to institutional research')
check(!temporal.includes('canonization_record'),'evidence grant never implies canon authority')
check(epistemicallyAllowedArtifactTypes(['unknown_evidence']).length===0,'unknown grant fails closed')
if(failures) throw new Error(String(failures)+' research group access test(s) failed')
console.log('Research group access contract: passed')
