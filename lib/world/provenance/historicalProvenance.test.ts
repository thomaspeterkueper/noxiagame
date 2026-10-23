import { strict as assert } from 'node:assert'
import { DWARKA_PROVENANCE, PHAISTOS_PROVENANCE, SENCKENBERG_YIN_HUA_PROVENANCE, validateProvenanceGraph } from './historicalProvenance'

assert.deepEqual(validateProvenanceGraph(DWARKA_PROVENANCE), [])
assert.deepEqual(validateProvenanceGraph(PHAISTOS_PROVENANCE), [])
assert.deepEqual(validateProvenanceGraph(SENCKENBERG_YIN_HUA_PROVENANCE), [])

assert.ok(PHAISTOS_PROVENANCE.assertions.some(a => a.layer === 'artifact' && a.subjectId === 'artifact:phaistos-disc'))
assert.ok(PHAISTOS_PROVENANCE.assertions.some(a => a.layer === 'interpretation' && a.confidence === 'contested'))
assert.ok(PHAISTOS_PROVENANCE.assertions.some(a => a.layer === 'fiction-canon' && a.subjectId.includes('vladikavkaz')))

const adar = SENCKENBERG_YIN_HUA_PROVENANCE.assertions.find(a => a.subjectId === 'fiction:YIN-HUA:Adar-collection')
assert.equal(adar?.layer, 'fiction-canon')
assert.ok(SENCKENBERG_YIN_HUA_PROVENANCE.assertions.filter(a => a.subjectId.startsWith('fiction:YIN-HUA:')).every(a => a.sourceRef === 'KUEPER:YIN-HUA'))

const layers = new Set(DWARKA_PROVENANCE.assertions.map(assertion => assertion.layer))
assert.ok(layers.has('observation'))
assert.ok(layers.has('interpretation'))
assert.ok(layers.has('received-tradition'))
assert.ok(layers.has('fiction-canon'))

const bad = {
  ...DWARKA_PROVENANCE,
  edges: [...DWARKA_PROVENANCE.edges, { from: 'missing', to: 'dwarka:site:modern', relation: 'located-at' as const }],
}
assert.deepEqual(validateProvenanceGraph(bad), ['unknown edge.from: missing'])

console.log('historical provenance tests passed')
