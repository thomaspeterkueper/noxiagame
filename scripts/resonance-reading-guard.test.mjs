import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
const read = path => readFileSync(path, 'utf8')
const interior = read('app/earth/LandmarkWalkableInterior.tsx')
const conversation = read('app/api/game/npc-conversation/route.ts')
const shelf = read('app/earth/ResonanceShelf.tsx')
const releases = read('lib/game/readings/releases.server.ts')
test('interior UI allows 160 characters, with no premature truncation', () => {
  assert.match(interior, /maxLength=\{160\}/)
  assert.equal((interior.match(/message\.trim\(\)\.slice\(0, 160\)/g) || []).length, 2)
  assert.doesNotMatch(interior, /message\.trim\(\)\.slice\(0, 80\)/)
})
test('server accepts same message length', () => {
  assert.match(conversation, /const MAX_PLAYER_CHARS = 500/)
})
test('model output cannot execute NPC credit transfers', () => {
  assert.doesNotMatch(conversation, /transferPlayerToNpcCredits\s*\(/)
  assert.doesNotMatch(conversation, /creditConsentFromConversation\s*\(/)
  assert.match(conversation, /creditTransfer\s*[,}]/)
})
test('NPC movement needs consent beyond model action marker', () => {
  assert.match(conversation, /followConsent && requestedVisitPlace/)
  assert.match(conversation, /followConsent && requestedLeadWalk/)
})
test('Schriften kommen nur aus buecherwelten – keine Handkopien im Spiel', () => {
  assert.equal(existsSync('lib/game/landmarks/readings'), false)
  assert.equal(existsSync('lib/game/landmarks/readingTexts.ts'), false)
  assert.match(interior, /<ResonanceShelf /)
  assert.match(shelf, /\/api\/game\/readings/)
})
test('Leseproben werden auf dem Server gekürzt', () => {
  assert.match(releases, /sections\.slice\(0, readable\)/)
  assert.match(releases, /mode === 'hidden'\) return null/)
})
