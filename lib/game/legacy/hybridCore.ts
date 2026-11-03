import { canReadHistoricalSource, hasConsent, type EvolvingMemory, type HistoricalFact, type LegacyConsent, type LegacyIdentity, type LegacyInstance, type LegacySource } from './identity'

export interface HistoricalSnapshot {
  readonly identityId: string
  readonly version: number
  readonly sourceIds: readonly string[]
  readonly facts: readonly HistoricalFact[]
}

/** Historical facts only from verified, explicit source references. Never copy evolving memories here. */
export function createHistoricalSnapshot(input: {
  identity: LegacyIdentity
  version: number
  sources: readonly LegacySource[]
  facts: readonly HistoricalFact[]
  consent: LegacyConsent | null
  audience: 'owner' | 'player'
}): HistoricalSnapshot {
  if (input.consent?.subjectId !== input.identity.subjectId || input.consent.ownerUserId !== input.identity.ownerUserId)\n    throw new Error('Legacy consent identity mismatch')\n  const allowed = input.sources.filter(source =>
    source.subjectId === input.identity.subjectId &&
    canReadHistoricalSource(source, input.consent, input.audience)
  )
  const sourceIds = new Set(allowed.map(source => source.id))
  return {
    identityId: input.identity.id,
    version: input.version,
    sourceIds: Object.freeze([...sourceIds]),
    facts: Object.freeze(input.facts
      .filter(fact => fact.subjectId === input.identity.subjectId &&
        fact.sourceIds.length > 0 &&
        fact.sourceIds.every(id => sourceIds.has(id)))
      .map(fact => Object.freeze({ ...fact, sourceIds: Object.freeze([...fact.sourceIds]) }))),
  }
}

export function appendEvolvingExperience(input: {
  identity: LegacyIdentity
  instance: LegacyInstance
  consent: LegacyConsent | null
  existing: readonly EvolvingMemory[]
  newMemory: EvolvingMemory
}): readonly EvolvingMemory[] {
  if (input.identity.status !== 'active' || input.instance.status !== 'active')
    throw new Error('Legacy instance not active')
  if (input.instance.identityId !== input.identity.id || input.instance.mode !== 'evolving')
    throw new Error('Only evolving instances may learn')
  if (!hasConsent(input.consent, 'autonomous-npc') || input.consent?.subjectId !== input.identity.subjectId)
    throw new Error('Autonomous legacy consent missing')
  if (input.newMemory.instanceId !== input.instance.id)
    throw new Error('Memory must belong to this instance')
  if (!Number.isSafeInteger(input.newMemory.observedAtTick) || input.newMemory.observedAtTick < 0)
    throw new Error('Invalid memory tick')
  if (!input.newMemory.originEventId.trim()) throw new Error('Provenance event required')
  if (input.existing.some(item => item.id === input.newMemory.id || item.originEventId === input.newMemory.originEventId))
    throw new Error('Duplicate memory event')
  return [...input.existing, Object.freeze({ ...input.newMemory })]
}

export function labelLegacyReply(mode: LegacyInstance['mode'], text: string, sourceIds: readonly string[] = []) {
  if (mode === 'historical' && sourceIds.length === 0)
    throw new Error('Historical claims require provenance')
  return Object.freeze({
    mode,
    text,
    sourceIds: Object.freeze(mode === 'historical' ? [...sourceIds] : []),
    disclaimer: mode === 'historical'
      ? 'Quellenbasierte KI-Rekonstruktion, kein Originalgespräch.'
      : 'Autonome digitale NOXIA-Persönlichkeit, nicht die reale Person.',
  })
}
