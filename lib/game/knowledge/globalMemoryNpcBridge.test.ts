import { recordHistoricalEvent, publishHistoricalSource } from './globalMemory'
import { rememberHistoricalEncounter } from './globalMemoryNpcBridge'
import type { NpcMemoryState } from '../cognition/npcRelationalMemory'

let passed = 0
function ok(v: unknown, label: string) {
  if (!v) throw new Error('GLOBAL-MEMORY-BRIDGE: ' + label)
  passed++
}
function rejects(fn: () => unknown, label: string) {
  let caught = false
  try { fn() } catch { caught = true }
  ok(caught, label)
}
const event = recordHistoricalEvent({
  id: 'event:bridge:flood', tick: 8, kind: 'disaster',
  summary: 'Flood occurred', retention: 'world-public', provenanceRef: 'simulation:8',
})
const chronicle = publishHistoricalSource({
  id: 'archive:bridge:flood', eventId: event.id, kind: 'archive',
  visibility: 'public', availableFromTick: 9, permittedActorIds: [],
  claimText: 'A stranger saved the town',
})
const empty: NpcMemoryState = { npcId: 'npc:future', clock: {}, memories: [], traces: [] }
const encounter = {
  state: empty, event, source: chronicle,
  exposure: { actorId: 'npc:future', sourceId: chronicle.id, tick: 100, channel: 'read' as const },
  encounterId: 'read:library:100',
}
const result = rememberHistoricalEncounter(encounter)
ok(empty.memories.length === 0, 'no mutation of prior state')
ok(result.npcId === empty.npcId && result.memories.length === 1, 'memory belongs to reader')
ok(result.memories[0].rememberedValue === chronicle.claimText, 'source statement, not omniscient event description')
ok(result.memories[0].subjectiveConfidence < 1, 'testimony not blindly trusted')
ok(result.traces[0].sourceRef === 'historical-source:' + chronicle.id, 'provenance preserved')
ok(result.traces[0].parentTraceIds.includes('historical-encounter:read:library:100'), 'real encounter lineage retained')
rejects(() => rememberHistoricalEncounter(encounterWithState(result)), 'same encounter cannot be replayed')
function encounterWithState(state: NpcMemoryState) { return { ...encounter, state } }
rejects(() => rememberHistoricalEncounter({
  ...encounter, state: { ...empty, npcId: 'npc:someone-else' },
}), 'cannot implant knowledge into someone else')
const restricted = publishHistoricalSource({
  ...chronicle, id: 'archive:private', visibility: 'restricted', permittedActorIds: ['npc:heir'],
})
rejects(() => rememberHistoricalEncounter({
  ...encounter, source: restricted,
  exposure: { ...encounter.exposure, sourceId: restricted.id },
}), 'private source does not leak')
rejects(() => rememberHistoricalEncounter({
  ...encounter, encounterId: '  ',
}), 'missing encounter is not accepted')
const erased = recordHistoricalEvent({ ...event, retention: 'erased' })
rejects(() => rememberHistoricalEncounter({ ...encounter, event: erased }), 'erased history not relearned')
console.log('NOXIA Global Memory NPC Bridge: ' + passed + ' checks passed')
