import { evaluateKnowledgeAccess, type KnowledgeProjection } from './knowledgeExposureGate'

let failures = 0
function check(ok: boolean, label: string) {
  if (!ok) { failures++; console.error('FAIL', label) }
}

const source: KnowledgeProjection = {
  id: 'seelenberg-library-projection',
  sourceId: 'botany-book',
  availableFromTick: 100,
  availableUntilTick: 200,
  locationIds: ['library'],
  requiredRoles: ['reader'],
}
const npc = { npcId: 'npc-botanist', tick: 150, locationId: 'library', roles: ['reader'] }
const result = evaluateKnowledgeAccess(source, npc)

check(result?.sourceId === 'botany-book' && result.canonical === false, 'eligible NPC can encounter a noncanonical source')
check(evaluateKnowledgeAccess(source, { ...npc, tick: 99 }) === null, 'source unavailable before publication')
check(evaluateKnowledgeAccess(source, { ...npc, tick: 201 }) === null, 'source unavailable after expiry')
check(evaluateKnowledgeAccess(source, { ...npc, locationId: 'cafe' }) === null, 'location controls exposure')
check(evaluateKnowledgeAccess(source, { ...npc, roles: ['guest'] }) === null, 'role controls exposure')
check(evaluateKnowledgeAccess(source, { ...npc, tick: Number.NaN }) === null, 'invalid tick rejected')
check(JSON.stringify(result) === JSON.stringify(evaluateKnowledgeAccess(source, npc)), 'deterministic access')

if (failures) throw new Error(`${failures} knowledge exposure tests failed`)
console.log('Knowledge exposure gate tests passed')
