import type {
  ResearchFinding, ResearchChallenge, ScientificControversy, ControversyRevision,
  EvidenceBackedDecision, NarrativeCandidate, NarrativeReview, CanonizationRecord,
} from './researchExchange'

export type PersistentCognitiveArtifact =
  | ResearchFinding | ResearchChallenge | ScientificControversy | ControversyRevision
  | EvidenceBackedDecision | NarrativeCandidate | NarrativeReview | CanonizationRecord

export interface CognitiveArtifactRow {
  id:string
  artifact_type:string
  subject_ref:string
  producer_ref:string|null
  simulation_tick:number
  confidence:number|null
  status:string
  evidence_refs:string[]
  payload:Record<string,unknown>
}

export function cognitiveArtifactToRow(a:PersistentCognitiveArtifact):CognitiveArtifactRow {
  if('evidenceType' in a) return {id:a.id,artifact_type:'research_finding',subject_ref:a.subjectRef,producer_ref:a.producerGroupId,simulation_tick:a.createdAtTick,confidence:a.confidence,status:'published',evidence_refs:a.evidenceRefs,payload:{...a}}
  if('challengedFindingId' in a) return {id:a.id,artifact_type:'research_challenge',subject_ref:a.subjectRef,producer_ref:a.challengerGroupId,simulation_tick:a.createdAtTick,confidence:a.confidence,status:a.status,evidence_refs:a.evidenceRefs,payload:{...a}}
  if('challengeIds' in a) return {id:a.id,artifact_type:'scientific_controversy',subject_ref:a.subjectRef,producer_ref:null,simulation_tick:a.openedAtTick,confidence:null,status:a.status,evidence_refs:[...a.findingIds,...a.challengeIds],payload:{...a}}
  if('supportForFinding' in a) return {id:a.id,artifact_type:'controversy_revision',subject_ref:a.controversyId,producer_ref:null,simulation_tick:a.atTick,confidence:null,status:a.status,evidence_refs:[],payload:{...a}}
  if('controversyRevisionId' in a) return {id:a.id,artifact_type:'evidence_backed_decision',subject_ref:a.subjectRef,producer_ref:a.authorityId,simulation_tick:a.effectiveAtTick,confidence:null,status:a.status,evidence_refs:a.evidenceRefs,payload:{...a}}
  if('sourceDecisionId' in a) return {id:a.id,artifact_type:'narrative_candidate',subject_ref:a.subjectRef,producer_ref:null,simulation_tick:a.occurredAtTick,confidence:a.significance,status:a.status,evidence_refs:a.evidenceRefs,payload:{...a}}
  if('reviewerId' in a) return {id:a.id,artifact_type:'narrative_review',subject_ref:a.candidateId,producer_ref:a.reviewerId,simulation_tick:a.reviewedAtTick,confidence:null,status:a.decision,evidence_refs:a.evidenceRefs,payload:{...a}}
  return {id:a.id,artifact_type:'canonization_record',subject_ref:a.candidateId,producer_ref:a.canonizedBy,simulation_tick:a.canonizedAtTick,confidence:null,status:a.status,evidence_refs:a.approvedReviewIds,payload:{...a}}
}

export interface CognitiveArtifactStore {
  save(row:CognitiveArtifactRow):Promise<void>
  findBySubject(subjectRef:string):Promise<CognitiveArtifactRow[]>
}

export class InMemoryCognitiveArtifactStore implements CognitiveArtifactStore {
  private rows=new Map<string,CognitiveArtifactRow>()
  async save(row:CognitiveArtifactRow){ this.rows.set(row.id,structuredClone(row)) }
  async findBySubject(subjectRef:string){
    return [...this.rows.values()].filter(r=>r.subject_ref===subjectRef).sort((a,b)=>a.simulation_tick-b.simulation_tick).map(r=>structuredClone(r))
  }
}
