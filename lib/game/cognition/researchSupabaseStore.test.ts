import { epistemicallyAllowedArtifactTypes } from './researchSupabaseStore'
let failures=0; const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}
const allowed=epistemicallyAllowedArtifactTypes(['temporal_protocol_revision'])
check(allowed.includes('research_finding') && allowed.includes('controversy_revision'),'subscribed research group can retrieve relevant institutional science')
check(!allowed.includes('narrative_review') && !allowed.includes('canonization_record'),'research subscription does not grant canon authority records')
check(epistemicallyAllowedArtifactTypes([]).length===0,'no subscription means no institutional research visibility')
if(failures) throw new Error(String(failures)+' Supabase cognitive adapter test(s) failed')
console.log('Supabase cognitive adapter: access contract passed')
