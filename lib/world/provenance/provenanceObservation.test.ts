import { strict as assert } from 'node:assert'
import { knowledgeFromObservation } from '../../game/population/observation'
import { PHAISTOS_PROVENANCE, SENCKENBERG_YIN_HUA_PROVENANCE } from './historicalProvenance'
import { isFictionCanonKnowledgeType, observationFromProvenance } from './provenanceObservation'

const signs = PHAISTOS_PROVENANCE.assertions.find(a => a.id === 'phaistos:observation:signs')
assert.ok(signs)
const obs = observationFromProvenance({
  assertion: signs,
  observerPersonId: 'person:test',
  observedTick: 42,
  communicationSourceRef: 'source:museum-guide',
})
assert.equal(obs.sourceType, 'communication')
assert.equal(obs.observationType, 'provenance:observation')
assert.equal(obs.confidence, 0.95)
assert.ok(obs.evidenceRefs.includes(signs.id))

const knowledge = knowledgeFromObservation(obs)
assert.equal(knowledge.knowledgeType, 'provenance:observation')
assert.equal(knowledge.subjectRef, 'artifact:phaistos-disc')

const adar = SENCKENBERG_YIN_HUA_PROVENANCE.assertions.find(a => a.id === 'yinhua:fiction:adar-collection')
assert.ok(adar)
const fictionObs = observationFromProvenance({
  assertion: adar,
  observerPersonId: 'person:test',
  observedTick: 43,
  communicationSourceRef: 'source:novel',
})
assert.ok(isFictionCanonKnowledgeType(fictionObs.observationType))
assert.equal(fictionObs.payload.provenanceLayer, 'fiction-canon')

console.log('provenance observation tests passed')
