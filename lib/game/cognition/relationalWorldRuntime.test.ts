import { advanceClock, areConcurrent, decayTrace, happensBefore, mergeClock, provenanceIndependent, reconstruct, resolveOpenValue, type RelationalTrace } from './relationalWorldRuntime'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL: ' + label) } }

const a1 = advanceClock({}, 'a')
const b1 = advanceClock({}, 'b')
check(areConcurrent(a1, b1), 'independent local events are concurrent')
const joined = advanceClock(mergeClock(a1, b1), 'a')
check(happensBefore(a1, joined) && happensBefore(b1, joined), 'merge preserves partial causal order')

const photo: RelationalTrace<'black' | 'white'> = {
  id: 'photo', subjectRef: 'evening:shirt', attribute: 'colour', value: 'black',
  sourceRef: 'camera:1', parentTraceIds: [], clock: a1, durability: 'persistent', active: true,
}
const memory: RelationalTrace<'black' | 'white'> = {
  id: 'memory', subjectRef: 'evening:shirt', attribute: 'colour', value: 'black',
  sourceRef: 'npc:lan', parentTraceIds: [], clock: b1, durability: 'ephemeral', active: true,
}
check(provenanceIndependent('photo', 'memory', [photo, memory]), 'independent provenance paths remain distinguishable')

const copiedMemory: RelationalTrace<'black' | 'white'> = {
  ...memory, id: 'copied-memory', sourceRef: 'npc:hana', parentTraceIds: ['memory'],
}
check(!provenanceIndependent('memory', 'copied-memory', [memory, copiedMemory]), 'copied reports do not create false breadth')

const open = reconstruct('evening:shirt', 'colour', ['black', 'white'], [])
check(open.status === 'open', 'untraced detail remains open')
check(resolveOpenValue(open, allowed => allowed[0]) === 'black', 'lazy resolver may choose only among compatible values')

const determined = reconstruct('evening:shirt', 'colour', ['black', 'white'], [photo])
check(determined.status === 'determined' && determined.candidates.find(c => c.value === 'white')?.compatible === false, 'existing trace constrains lazy determination')

const reopened = reconstruct('evening:shirt', 'colour', ['black', 'white'], [decayTrace(photo)])
check(reopened.status === 'open', 'lost trace can reopen a detail when no effective consequence remains')

if (failures) throw new Error(String(failures) + ' relational runtime test(s) failed')
console.log('Relational world runtime v0.1: tests passed; external_llm_calls=0; persistence_writes=0')
