import { strict as assert } from 'node:assert'
import { synthesizeNpcDream } from './dreamKnowledge'

const input = {
  npcId: 'artisan-1', tick: 100, worldYear: 2150, sleeping: true,
  memories: [{ id: 'm1', summary: 'I repaired a bridge', emotionalWeight: 0.8 }],
  sources: [
    { id: 's1', text: 'Ancient joinery technique', sourceUri: 'https://example.org/1', observedAtTick: 99, availableFromYear: 2020, license: 'CC-BY', worldProjection: { availableFromYear: 2100, accessible: true } },
    { id: 'future', text: 'Unpublished future invention', sourceUri: 'https://example.org/2', observedAtTick: 99, availableFromYear: 2200, license: 'CC-BY' },
    { id: 'unlicensed', text: 'Restricted text', sourceUri: 'https://example.org/3', observedAtTick: 99, availableFromYear: 2020, license: '' },
  ]
}
const first = synthesizeNpcDream(input)
assert.deepEqual(first, synthesizeNpcDream(input))
assert.deepEqual(first?.sourceIds, ['s1'])
assert.equal(first?.epistemicStatus, 'subjective-dream')
assert.equal(first?.provenance, 'dream_recombination')
assert.equal(first?.canonical, false)
assert.deepEqual(first?.sourceMemoryIds, first?.memoryIds)
assert.equal(first?.createdAtTick, first?.atTick)
assert.ok(first?.id.startsWith('dream-association:'))

assert.equal(synthesizeNpcDream({ ...input, sleeping: false }), null)
assert.equal(synthesizeNpcDream({ ...input, memories: [], sources: [] }), null)
assert.throws(() => synthesizeNpcDream({ ...input, tick: -1 }))
console.log('dreamKnowledge offline tests passed')

const nightmare = synthesizeNpcDream({
  ...input,
  sources: [{ ...input.sources[0], emotionalIntensity: 1 }],
  emotionalSensitivity: 1,
})
assert.equal(nightmare?.emotionalTone, 'nightmare')
assert.equal(nightmare?.epistemicStatus, 'subjective-dream')
assert.equal(synthesizeNpcDream({
  ...input, sources: [{ ...input.sources[0], emotionalIntensity: 0 }],
  memories: [], emotionalSensitivity: 0,
})?.emotionalTone, 'neutral')
assert.throws(() => synthesizeNpcDream({ ...input, emotionalSensitivity: 2 }), /sensitivity/)

const related = synthesizeNpcDream({
  ...input,
  budget: { maxSources: 1, maxMemories: 1, maxTextLength: 180 },
  sources: [
    { ...input.sources[0], id: 'unrelated', text: 'Stars galaxies nebulas', worldProjection: { availableFromYear: 2100, accessible: true } },
    { ...input.sources[0], id: 'related', text: 'Bridge repair and construction', worldProjection: { availableFromYear: 2100, accessible: true } },
  ],
})
assert.deepEqual(related?.sourceIds, ['related'])
assert.equal(synthesizeNpcDream({ ...input, sources: [{ ...input.sources[0], worldProjection: undefined }] })?.sourceIds.length, 0)
assert.equal(synthesizeNpcDream({ ...input, sources: [{ ...input.sources[0], worldProjection: { availableFromYear: 2200, accessible: true } }] })?.sourceIds.length, 0)
const sourceText = 'Bridge repair contains a very long passage that should never be repeated in the dream motif list'
const protectedDream = synthesizeNpcDream({ ...input, sources: [{ ...input.sources[0], text: sourceText }] })
assert.equal(protectedDream?.motifs.some(m => m.includes('Bridge repair contains a very long passage')), false)
assert.equal(protectedDream?.motifs.every(m => m.split(/\s+/).length < 8), true)
