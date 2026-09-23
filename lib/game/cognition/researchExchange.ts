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
