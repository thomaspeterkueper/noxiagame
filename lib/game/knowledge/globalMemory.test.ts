import {
  recordHistoricalEvent, publishHistoricalSource, learnFromHistoricalSource, redactWorldEvent,
} from './globalMemory'

let checks = 0
function check(value: unknown, message: string) {
  if (!value) throw new Error('GLOBAL-MEMORY-618: ' + message)
  checks++
}
function rejects(fn: () => unknown, reason: string) {
  let failed = false
  try { fn() } catch { failed = true }
  check(failed, reason)
}

// No actor who witnessed the historical flood is assumed alive at tick 1000.
const flood = recordHistoricalEvent({
  id: 'world:flood:1', tick: 10, kind: 'flood',
  summary: 'A severe flood changed the settlement',
  retention: 'world-public', provenanceRef: 'world-event:10',
})
const chronicle = publishHistoricalSource({
  id: 'library:chronicle:1', eventId: flood.id, kind: 'archive',
  visibility: 'public', availableFromTick: 20,
  permittedActorIds: [], claimText: 'The town was saved by a brave visitor',
})
const heard = publishHistoricalSource({
  id: 'oral:myth:1', eventId: flood.id, kind: 'testimony',
  visibility: 'public', availableFromTick: 100,
  permittedActorIds: [], claimText: 'The town was saved by a mythical river spirit',
})
const scholar = learnFromHistoricalSource({
  event: flood, source: chronicle,
  exposure: { actorId: 'npc:scholar-2150', sourceId: chronicle.id, tick: 1000, channel: 'read' },
})
check(scholar.eventId === flood.id, 'old event remains accessible through a durable source')
check(scholar.claimText === chronicle.claimText, 'knowledge comes from a source, not omniscient event text')
check(scholar.epistemicStatus === 'reported', 'archive must not count as firsthand observation')
check(flood.summary !== scholar.claimText, 'event and historical account remain distinct')
const myth = learnFromHistoricalSource({
  event: flood, source: heard,
  exposure: { actorId: 'npc:scholar-2150', sourceId: heard.id, tick: 1000, channel: 'heard' },
})
check(myth.claimText !== scholar.claimText, 'diverging historical narratives coexist')
check(flood.summary === 'A severe flood changed the settlement', 'narratives cannot mutate history')
rejects(() => learnFromHistoricalSource({
  event: flood, source: chronicle,
  exposure: { actorId: 'npc:early', sourceId: chronicle.id, tick: 12, channel: 'read' },
}), 'actor cannot learn an archive before its creation')
rejects(() => learnFromHistoricalSource({
  event: flood, source: chronicle,
  exposure: { actorId: 'npc:scholar', sourceId: 'wrong', tick: 1000, channel: 'read' },
}), 'explicit exposure must identify the correct source')
rejects(() => learnFromHistoricalSource({
  event: flood, source: chronicle,
  exposure: { actorId: 'npc:scholar', sourceId: chronicle.id, tick: 1000, channel: 'observed' },
}), 'reading a chronicle does not imply firsthand observation')
const privateRecord = publishHistoricalSource({
  id: 'private:diary', eventId: flood.id, kind: 'archive',
  visibility: 'restricted', availableFromTick: 21,
  permittedActorIds: ['npc:heir'], claimText: 'My grandmother described the disaster',
})
rejects(() => learnFromHistoricalSource({
  event: flood, source: privateRecord,
  exposure: { actorId: 'npc:unrelated', sourceId: privateRecord.id, tick: 1000, channel: 'read' },
}), 'private archives are not world knowledge')
const heir = learnFromHistoricalSource({
  event: flood, source: privateRecord,
  exposure: { actorId: 'npc:heir', sourceId: privateRecord.id, tick: 1000, channel: 'read' },
})
check(heir.claimText === privateRecord.claimText, 'permitted heir can read source')
const erased = redactWorldEvent(flood)
check(erased.retention === 'erased' && !erased.summary.includes('flood'), 'redaction removes the public summary')
rejects(() => learnFromHistoricalSource({
  event: erased, source: chronicle,
  exposure: { actorId: 'npc:scholar', sourceId: chronicle.id, tick: 1000, channel: 'read' },
}), 'erased events must not be reintroduced from public projection')
check(flood.retention === 'world-public', 'redaction is immutable and does not modify original objects')
console.log('NOXIA Global Memory #618: ' + checks + ' checks passed')
