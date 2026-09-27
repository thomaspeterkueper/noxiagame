import type { ProtocolRevision } from './runtime'

export type ResearchGroupDomain = 'chronobiology' | 'plant_science' | 'life_support'

export interface ResearchGroup {
  id: string
  domain: ResearchGroupDomain
  subscribedEvidenceTypes: string[]
}

export interface ResearchFinding {
  id: string
  producerGroupId: string
  subjectRef: string
  evidenceType: string
  evidenceRefs: string[]
  confidence: number
  createdAtTick: number
  payload: Record<string, unknown>
}

export interface ResearchInboxItem {
  id: string
  recipientGroupId: string
  findingId: string
  receivedAtTick: number
  status: 'unread' | 'reviewed' | 'adopted' | 'challenged'
}

export interface ProtocolAdoption {
  id: string
  groupId: string
  protocolId: string
  protocolVersion: number
  findingId: string
  adoptedAtTick: number
  status: 'adopted'
}

export function publishProtocolFinding(input: {
  groupId: string
  protocol: ProtocolRevision
  createdAtTick: number
}): ResearchFinding {
  return {
    id: 'finding:' + input.protocol.id + ':' + input.protocol.version,
    producerGroupId: input.groupId,
    subjectRef: input.protocol.subjectRef,
    evidenceType: 'temporal_protocol_revision',
    evidenceRefs: [...input.protocol.evidenceRefs],
    confidence: Math.max(0, Math.min(1, 1 - input.protocol.uncertainty)),
    createdAtTick: input.createdAtTick,
    payload: {
      protocolId: input.protocol.id,
      protocolVersion: input.protocol.version,
      phaseOffsetMinutes: input.protocol.phaseOffsetMinutes,
      supersedes: input.protocol.supersedes,
    },
  }
}

export function routeFinding(finding: ResearchFinding, groups: ResearchGroup[], receivedAtTick: number): ResearchInboxItem[] {
  return groups
    .filter((group) => group.id !== finding.producerGroupId && group.subscribedEvidenceTypes.includes(finding.evidenceType))
    .map((group) => ({
      id: 'inbox:' + group.id + ':' + finding.id,
      recipientGroupId: group.id,
      findingId: finding.id,
      receivedAtTick,
      status: 'unread' as const,
    }))
}

export function adoptProtocolFromFinding(input: {
  groupId: string
  finding: ResearchFinding
  atTick: number
  minConfidence?: number
}): ProtocolAdoption | null {
  const threshold = input.minConfidence ?? 0.7
  if (input.finding.evidenceType !== 'temporal_protocol_revision' || input.finding.confidence < threshold) return null
  const protocolId = input.finding.payload.protocolId
  const protocolVersion = input.finding.payload.protocolVersion
  if (typeof protocolId !== 'string' || typeof protocolVersion !== 'number') return null
  return {
    id: 'adoption:' + input.groupId + ':' + protocolId + ':' + protocolVersion,
    groupId: input.groupId,
    protocolId,
    protocolVersion,
    findingId: input.finding.id,
    adoptedAtTick: input.atTick,
    status: 'adopted',
  }
}


export interface ResearchChallenge {
  id: string
  challengerGroupId: string
  challengedFindingId: string
  subjectRef: string
  evidenceRefs: string[]
  confidence: number
  reasonCode: 'conflicting_measurement' | 'different_population' | 'side_effect' | 'failed_replication'
  createdAtTick: number
  status: 'open' | 'resolved'
}

export interface ScientificControversy {
  id: string
  subjectRef: string
  findingIds: string[]
  challengeIds: string[]
  participantGroupIds: string[]
  openedAtTick: number
  status: 'open' | 'resolved'
}

export function challengeFinding(input: {
  groupId: string
  finding: ResearchFinding
  evidenceRefs: string[]
  confidence: number
  reasonCode: ResearchChallenge['reasonCode']
  atTick: number
}): ResearchChallenge {
  return {
    id: 'challenge:' + input.groupId + ':' + input.finding.id,
    challengerGroupId: input.groupId,
    challengedFindingId: input.finding.id,
    subjectRef: input.finding.subjectRef,
    evidenceRefs: [...input.evidenceRefs],
    confidence: Math.max(0, Math.min(1, input.confidence)),
    reasonCode: input.reasonCode,
    createdAtTick: input.atTick,
    status: 'open',
  }
}

export function openControversy(input: { finding: ResearchFinding; challenge: ResearchChallenge }): ScientificControversy {
  return {
    id: 'controversy:' + input.finding.subjectRef + ':' + input.finding.id,
    subjectRef: input.finding.subjectRef,
    findingIds: [input.finding.id],
    challengeIds: [input.challenge.id],
    participantGroupIds: Array.from(new Set([input.finding.producerGroupId, input.challenge.challengerGroupId])),
    openedAtTick: input.challenge.createdAtTick,
    status: 'open',
  }
}

export function shouldEscalateControversy(input: { finding: ResearchFinding; challenges: ResearchChallenge[] }): boolean {
  const strong = input.challenges.filter((c) => c.status === 'open' && c.confidence >= 0.7)
  const independentGroups = new Set(strong.map((c) => c.challengerGroupId))
  return input.finding.confidence >= 0.7 && independentGroups.size >= 2
}


export interface ControversyEvidenceEvent {
  id: string
  controversyId: string
  groupId: string
  evidenceRefs: string[]
  direction: 'supports_finding' | 'supports_challenge'
  confidence: number
  occurredAtTick: number
}

export interface ControversyRevision {
  id: string
  controversyId: string
  revision: number
  atTick: number
  supportForFinding: number
  supportForChallenge: number
  participantGroupIds: string[]
  status: 'open' | 'resolved_finding_supported' | 'resolved_finding_revised'
  reason: 'new_evidence' | 'convergence'
}

export function reviseControversy(input: {
  controversy: ScientificControversy
  history: ControversyRevision[]
  events: ControversyEvidenceEvent[]
}): ControversyRevision {
  const clamp = (n:number) => Math.max(0,Math.min(1,n))
  const weighted = (direction:ControversyEvidenceEvent['direction']) => {
    const relevant=input.events.filter(e=>e.direction===direction)
    return relevant.length ? relevant.reduce((s,e)=>s+clamp(e.confidence),0)/relevant.length : 0
  }
  const supportForFinding=weighted('supports_finding')
  const supportForChallenge=weighted('supports_challenge')
  const delta=supportForFinding-supportForChallenge
  const status:ControversyRevision['status'] =
    input.events.length>=3 && delta>=0.35 ? 'resolved_finding_supported' :
    input.events.length>=3 && delta<=-0.35 ? 'resolved_finding_revised' : 'open'
  const participants=Array.from(new Set([
    ...input.controversy.participantGroupIds,
    ...input.events.map(e=>e.groupId),
  ]))
  return {
    id:'controversy-revision:'+input.controversy.id+':'+(input.history.length+1),
    controversyId:input.controversy.id,
    revision:input.history.length+1,
    atTick:Math.max(input.controversy.openedAtTick,...input.events.map(e=>e.occurredAtTick)),
    supportForFinding,
    supportForChallenge,
    participantGroupIds:participants,
    status,
    reason:status==='open'?'new_evidence':'convergence',
  }
}


export type SocietalImpactDomain = 'technical_standard' | 'station_operations' | 'economic_policy' | 'governance'

export interface EvidenceBackedDecision {
  id: string
  authorityId: string
  subjectRef: string
  domain: SocietalImpactDomain
  decisionType: string
  evidenceRefs: string[]
  controversyRevisionId: string
  effectiveAtTick: number
  reversible: boolean
  status: 'proposed' | 'adopted' | 'withdrawn'
}

export interface NarrativeCandidate {
  id: string
  sourceDecisionId: string
  subjectRef: string
  occurredAtTick: number
  significance: number
  reasonCodes: string[]
  evidenceRefs: string[]
  status: 'candidate'
}

export function decisionFromResolvedControversy(input: {
  authorityId: string
  controversy: ScientificControversy
  revision: ControversyRevision
  domain: SocietalImpactDomain
  decisionType: string
  effectiveAtTick: number
  reversible: boolean
}): EvidenceBackedDecision | null {
  if (input.revision.controversyId !== input.controversy.id || input.revision.status === 'open') return null
  return {
    id:'evidence-decision:'+input.authorityId+':'+input.revision.id,
    authorityId:input.authorityId,
    subjectRef:input.controversy.subjectRef,
    domain:input.domain,
    decisionType:input.decisionType,
    evidenceRefs:[input.revision.id,...input.controversy.findingIds,...input.controversy.challengeIds],
    controversyRevisionId:input.revision.id,
    effectiveAtTick:input.effectiveAtTick,
    reversible:input.reversible,
    status:'proposed',
  }
}

export function narrativeCandidateFromDecision(input: {
  decision: EvidenceBackedDecision
  affectedPopulation: number
  durationTicks: number
  crossDomainEffects: number
}): NarrativeCandidate | null {
  const population=Math.max(0,input.affectedPopulation)
  const duration=Math.max(0,input.durationTicks)
  const domains=Math.max(0,input.crossDomainEffects)
  const significance=Math.min(1,
    Math.min(1,population/1000)*0.4 +
    Math.min(1,duration/365)*0.3 +
    Math.min(1,domains/3)*0.3
  )
  if(significance<0.55) return null
  const reasonCodes:string[]=[]
  if(population>=500) reasonCodes.push('population_scale')
  if(duration>=180) reasonCodes.push('long_duration')
  if(domains>=2) reasonCodes.push('cross_domain_effect')
  return {
    id:'narrative-candidate:'+input.decision.id,
    sourceDecisionId:input.decision.id,
    subjectRef:input.decision.subjectRef,
    occurredAtTick:input.decision.effectiveAtTick,
    significance,
    reasonCodes,
    evidenceRefs:[...input.decision.evidenceRefs],
    status:'candidate',
  }
}
