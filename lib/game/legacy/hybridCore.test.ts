import { describe, expect, it } from 'vitest'
import { appendEvolvingExperience, createHistoricalSnapshot, labelLegacyReply } from './hybridCore'
import type { LegacyConsent, LegacyIdentity, LegacyInstance, LegacySource } from './identity'

const identity: LegacyIdentity = { id: 'legacy:1', subjectId: 'person:1', displayName: 'Pilot', ownerUserId: 'user:1', status: 'active', visibility: 'private', createdAt: '2026-11-03' }
const consent: LegacyConsent = { subjectId: 'person:1', ownerUserId: 'user:1', scope: ['archive', 'conversation', 'autonomous-npc'], grantedAt: '2026-11-03', sourceReference: 'approval:1' }
const instance: LegacyInstance = { id: 'instance:1', identityId: 'legacy:1', mode: 'evolving', status: 'active', historicalVersion: 1 }
const sources: LegacySource[] = [
  { id: 'public:1', subjectId: 'person:1', title: 'Approved', sourceUri: 'private://source', checksum: 'sha256:a', access: 'public', approvedForGame: true },
  { id: 'private:1', subjectId: 'person:1', title: 'Unapproved', sourceUri: 'private://draft', checksum: 'sha256:b', access: 'private', approvedForGame: false },
]
const facts = [
  { id: 'fact:1', subjectId: 'person:1', statement: 'Public fact', sourceIds: ['public:1'], recordedAt: '2026-11-03' },
  { id: 'fact:2', subjectId: 'person:1', statement: 'Private fact', sourceIds: ['private:1'], recordedAt: '2026-11-03' },
]

describe('NOXIA Living Legacy invariants', () => {
  it('filters unapproved source material for players', () => {
    const snapshot = createHistoricalSnapshot({ identity, version: 1, sources, facts, consent, audience: 'player' })
    expect(snapshot.facts.map(f => f.id)).toEqual(['fact:1'])
    expect(snapshot.sourceIds).toEqual(['public:1'])
  })
  it('does not expose sources with revoked consent', () => {
    const snapshot = createHistoricalSnapshot({ identity, version: 1, sources, facts, consent: { ...consent, revokedAt: '2026-11-04' }, audience: 'player' })
    expect(snapshot.facts).toHaveLength(0)
  })
  it('prevents learning by the historical instance', () => {
    expect(() => appendEvolvingExperience({ identity, instance: { ...instance, mode: 'historical' }, consent, existing: [], newMemory: { id: 'm1', instanceId: instance.id, experience: 'Hello', observedAtTick: 1, originEventId: 'event:1' } })).toThrow()
  })
  it('adds an experience without modifying historical facts', () => {
    const snapshot = createHistoricalSnapshot({ identity, version: 1, sources, facts, consent, audience: 'player' })
    const next = appendEvolvingExperience({ identity, instance, consent, existing: [], newMemory: { id: 'm1', instanceId: instance.id, experience: 'Hello', observedAtTick: 1, originEventId: 'event:1' } })
    expect(next).toHaveLength(1)
    expect(snapshot.facts).toHaveLength(1)
    expect(snapshot.facts[0].statement).toBe('Public fact')
  })
  it('rejects replayed events and unauthorized autonomy', () => {
    const m = { id: 'm1', instanceId: instance.id, experience: 'Hello', observedAtTick: 1, originEventId: 'event:1' }
    expect(() => appendEvolvingExperience({ identity, instance, consent, existing: [m], newMemory: { ...m, id: 'm2' } })).toThrow('Duplicate')
    expect(() => appendEvolvingExperience({ identity, instance, consent: { ...consent, scope: ['archive'] }, existing: [], newMemory: m })).toThrow('consent')
  })
  it('requires provenance for historical mode', () => {
    expect(() => labelLegacyReply('historical', 'claim')).toThrow('provenance')
    expect(labelLegacyReply('evolving', 'new opinion').disclaimer).toContain('nicht die reale Person')
  })
})
