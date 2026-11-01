import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const read = path => readFileSync(path, 'utf8')
const interior = read('app/earth/LandmarkWalkableInterior.tsx')
const conversation = read('app/api/game/npc-conversation/route.ts')
const catalogue = read('lib/game/landmarks/theologicalEssays.ts')
const registry = read('lib/game/landmarks/readingTexts.ts')
test('interior UI allows 500 characters, with no premature truncation', () => {
  assert.match(interior, /maxLength=\{500\}/)
  assert.equal((interior.match(/message\.trim\(\)\.slice\(0, 500\)/g) || []).length, 2)
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
test('all published manuscripts are registered, including Kinder Gottes', () => {
  for (const slug of ['kinder-gottes','gott-ist-eine-wolke','philosophie-der-omnizedenz','die-verkoerperte-seele','die-physik-des-ich','agurs-worte','der-erhellte-blick','gottesdienst','isaak','was-ist-durch-dich-geschehen','ueber-die-sanftmut']) {
    assert.ok(registry.includes("readings/" + slug), slug)
  }
  assert.match(catalogue, /sachbuecher:kinder-gottes/)
  assert.match(interior, /THEOLOGICAL_ESSAYS/)
  assert.match(interior, /readingText\.sections/)
})
