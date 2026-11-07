/** NOXIA-LEGACY-0001: Separate real-person provenance from in-world agency. */
export type LegacyMode = 'historical' | 'evolving'
export type LegacyVisibility = 'private' | 'approved' | 'public'
export type LegacyStatus = 'draft' | 'active' | 'suspended' | 'retired'

export interface LegacyIdentity {
  id: string
  subjectId: string
  displayName: string
  ownerUserId: string
  status: LegacyStatus
  visibility: LegacyVisibility
  createdAt: string
}

export interface LegacyConsent {
  subjectId: string
  ownerUserId: string
  scope: readonly ('archive' | 'conversation' | 'autonomous-npc' | 'posthumous')[]
  grantedAt: string
  revokedAt?: string
  sourceReference: string
}

export interface LegacySource {
  id: string
  subjectId: string
  title: string
  sourceUri: string
  checksum: string
  authoredAt?: string
  access: LegacyVisibility
  approvedForGame: boolean
}

export interface HistoricalFact {
  id: string
  subjectId: string
  statement: string
  sourceIds: readonly string[]
  recordedAt: string
}

export interface EvolvingMemory {
  id: string
  instanceId: string
  experience: string
  observedAtTick: number
  originEventId: string
}

export interface LegacyInstance {
  id: string
  identityId: string
  mode: LegacyMode
  npcId?: string
  status: LegacyStatus
  historicalVersion: number
}

export function hasConsent(consent: LegacyConsent | null, scope: LegacyConsent['scope'][number]): boolean {
  return Boolean(consent && !consent.revokedAt && consent.scope.includes(scope))
}

export function canReadHistoricalSource(source: LegacySource, consent: LegacyConsent | null, audience: 'owner' | 'player'): boolean {
  if (!hasConsent(consent, 'archive')) return false
  if (audience === 'owner') return true
  return source.approvedForGame && source.access === 'public' && hasConsent(consent, 'conversation')
}
