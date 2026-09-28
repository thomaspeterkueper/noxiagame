import { strict as assert } from 'node:assert'
import { DWARKA_PROVENANCE, validateProvenanceGraph } from './historicalProvenance'

assert.deepEqual(validateProvenanceGraph(DWARKA_PROVENANCE), [])

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
