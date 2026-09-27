import type { SupabaseClient } from '@supabase/supabase-js'
import type { CognitiveArtifactRow, CognitiveArtifactStore } from './researchPersistence'

export class SupabaseCognitiveArtifactStore implements CognitiveArtifactStore {
  constructor(private readonly client: SupabaseClient) {}

  async save(row:CognitiveArtifactRow):Promise<void> {
    const { error }=await this.client.from('cognitive_research_artifacts').upsert(row,{onConflict:'id'})
    if(error) throw new Error('cognitive artifact save failed: '+error.message)
  }

  async findBySubject(subjectRef:string):Promise<CognitiveArtifactRow[]> {
    const { data,error }=await this.client.from('cognitive_research_artifacts')
      .select('id,artifact_type,subject_ref,producer_ref,simulation_tick,confidence,status,evidence_refs,payload')
      .eq('subject_ref',subjectRef).order('simulation_tick',{ascending:true})
    if(error) throw new Error('cognitive artifact lookup failed: '+error.message)
    return (data ?? []) as CognitiveArtifactRow[]
  }

  async findPublishedForGroup(input:{subjectRef:string; allowedArtifactTypes:string[]}):Promise<CognitiveArtifactRow[]> {
    if(input.allowedArtifactTypes.length===0) return []
    const { data,error }=await this.client.from('cognitive_research_artifacts')
      .select('id,artifact_type,subject_ref,producer_ref,simulation_tick,confidence,status,evidence_refs,payload')
      .eq('subject_ref',input.subjectRef).in('artifact_type',input.allowedArtifactTypes)
      .order('simulation_tick',{ascending:true})
    if(error) throw new Error('cognitive artifact group lookup failed: '+error.message)
    return (data ?? []) as CognitiveArtifactRow[]
  }
}

export function epistemicallyAllowedArtifactTypes(subscribedEvidenceTypes:string[]):string[] {
  const allowed=new Set<string>()
  if(subscribedEvidenceTypes.includes('temporal_protocol_revision')) {
    allowed.add('research_finding')
    allowed.add('research_challenge')
    allowed.add('scientific_controversy')
    allowed.add('controversy_revision')
  }
  return [...allowed]
}
