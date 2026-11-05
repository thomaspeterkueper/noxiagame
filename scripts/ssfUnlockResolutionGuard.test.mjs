import test from 'node:test'
import assert from 'node:assert/strict'
import { ssfUnlockCandidatesResolvedBeforePersistence as safe } from './ssfUnlockResolutionGuard.mjs'

const fixture = (input, mapping = 'resolved.grantable', write = 'toInsert') => `
  const candidateIds = new Set(['UNL:NOX:example'])
  const existingIds = new Set()
  const resolved = resolveGrantableUnlocks(${input}, existingIds)
  const toInsert = ${mapping}.map(id => ({ unlock_id: id }))
  await supabase.from('player_unlocks').insert(${write})
`

test('array candidates require NOXIA resolution', () => {
  assert.equal(safe(fixture('candidateIds')), true)
})
test('Set spread candidates require the same NOXIA resolution', () => {
  assert.equal(safe(fixture('[...candidateIds]')), true)
  assert.equal(safe(fixture('[ ... candidateIds ]')), true)
})
test('reject direct candidate persistence or bypassed mapping', () => {
  assert.equal(safe(fixture('[...candidateIds]', 'candidateIds')), false)
  assert.equal(safe(fixture('[...candidateIds]', 'resolved.grantable', 'candidateIds')), false)
})
test('reject missing resolver and persistence before resolution', () => {
  const good = fixture('[...candidateIds]')
  assert.equal(safe(good.replace('resolveGrantableUnlocks', 'resolveNothing')), false)
  assert.equal(safe(`await supabase.from('player_unlocks').insert(toInsert)\n${good}`), false)
  assert.equal(safe(good.replace('const toInsert', 'const notToInsert')), false)
})
test('reject second direct persistence path', () => {
  assert.equal(safe(fixture('[...candidateIds]') + "\nawait supabase.from('player_unlocks').upsert(candidateIds)"), false)
})
