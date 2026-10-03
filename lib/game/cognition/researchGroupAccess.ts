import type { SupabaseClient } from '@supabase/supabase-js'
import type { CognitiveArtifactRow } from './researchPersistence'
import { epistemicallyAllowedArtifactTypes, SupabaseCognitiveArtifactStore } from './researchSupabaseStore'

export interface PersistentResearchGroup {
  id:string
  domain:'chronobiology'|'plant_science'|'life_support'
  displayName:string
  status:'active'|'inactive'|'dissolved'
  createdAtTick:number
}

export interface ResearchGroupAccess {
  group:PersistentResearchGroup
  evidenceTypes:string[]
}

export async function loadResearchGroupAccess(client:SupabaseClient,groupId:string,atTick:number):Promise<ResearchGroupAccess|null>{
  const {data:group,error:gerr}=await client.from('cognitive_research_groups')
    .select('id,domain,display_name,status,created_at_tick').eq('id',groupId).maybeSingle()
  if(gerr) throw new Error('research group lookup failed: '+gerr.message)
  if(!group || group.status!=='active' || group.created_at_tick>atTick) return null
  const {data:grants,error}=await client.from('cognitive_research_group_grants')
    .select('evidence_type,granted_at_tick,revoked_at_tick').eq('group_id',groupId)
    .lte('granted_at_tick',atTick)
  if(error) throw new Error('research group grants lookup failed: '+error.message)
  const evidenceTypes=[...new Set((grants??[]).filter(g=>g.revoked_at_tick==null || g.revoked_at_tick>atTick).map(g=>g.evidence_type))]
  return {group:{id:group.id,domain:group.domain,displayName:group.display_name,status:group.status,createdAtTick:group.created_at_tick},evidenceTypes}
}

export async function discoverInstitutionalResearch(input:{
  client:SupabaseClient; groupId:string; subjectRef:string; atTick:number
}):Promise<CognitiveArtifactRow[]>{
  const access=await loadResearchGroupAccess(input.client,input.groupId,input.atTick)
  if(!access) return []
  const allowed=epistemicallyAllowedArtifactTypes(access.evidenceTypes)
  return new SupabaseCognitiveArtifactStore(input.client).findPublishedForGroup({subjectRef:input.subjectRef,allowedArtifactTypes:allowed})
}
