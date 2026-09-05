import assert from 'node:assert/strict'
import {
  LOGISTICS_NODES,
  getLogisticsNodeSemantics,
  requiresSeparateSurfaceLeg,
  type CanonicalLogisticsNodeId,
} from './logisticsNodes'

const expectedIds: CanonicalLogisticsNodeId[] = ['earth', 'moon', 'mars', 'phobos', 'prometheus']
assert.deepEqual(Object.keys(LOGISTICS_NODES).sort(), [...expectedIds].sort())

for (const id of expectedIds) {
  const node = getLogisticsNodeSemantics(id)
  assert.ok(node, `${id} must have canonical logistics semantics`)
  assert.equal(node.id, id)
  assert.equal(node.surfaceLegSeparate, requiresSeparateSurfaceLeg(id))
}

assert.equal(LOGISTICS_NODES.earth.domainMeaning, 'aggregated-logistics-domain')
assert.equal(LOGISTICS_NODES.earth.transferEndpoint, 'orbital-interface')
assert.equal(LOGISTICS_NODES.earth.surfaceLegSeparate, true)

for (const id of ['moon', 'mars'] as const) {
  assert.equal(LOGISTICS_NODES[id].domainMeaning, 'surface-domain')
  assert.equal(LOGISTICS_NODES[id].transferEndpoint, 'orbital-interface')
  assert.equal(LOGISTICS_NODES[id].surfaceLegSeparate, true)
}

for (const id of ['phobos', 'prometheus'] as const) {
  assert.equal(LOGISTICS_NODES[id].domainMeaning, 'orbital-station')
  assert.equal(LOGISTICS_NODES[id].transferEndpoint, 'node-itself')
  assert.equal(LOGISTICS_NODES[id].surfaceLegSeparate, false)
}

assert.equal(getLogisticsNodeSemantics('unknown'), null)
assert.equal(requiresSeparateSurfaceLeg('unknown'), false)

console.log('Logistics-node semantics: OK')
