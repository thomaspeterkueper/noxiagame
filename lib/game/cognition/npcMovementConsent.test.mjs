import assert from 'node:assert/strict'
import test from 'node:test'
import { hasNpcMovementConsent as allows } from './npcMovementConsent.ts'

const visit = (playerText, previousNpcReply = null, targetName = 'Bank') => allows({ playerText, previousNpcReply, action: 'visit_place', targetName })
const walk = (playerText, previousNpcReply = null) => allows({ playerText, previousNpcReply, action: 'lead_walk' })

test('model action markers alone never grant player consent', () => {
  assert.equal(visit('Wie geht es dir?', 'Soll ich dich zur Bank bringen?'), false)
  assert.equal(walk('Wie geht es dir?', 'Soll ich dir den Weg zeigen?'), false)
  assert.equal(visit('ja'), false)
})
test('explicit acceptance of the immediately preceding offer permits the offered target', () => {
  assert.equal(visit('Ja!', 'Soll ich dich zur Bank bringen?'), true)
  assert.equal(visit('Ja, gerne!', 'Soll ich dich zur Bank bringen?'), true)
  assert.equal(walk('Gerne.', 'Soll ich dir den Weg zeigen?'), true)
})
test('refusal overrides affirmation, even if an offer exists', () => {
  assert.equal(visit('Ja, aber nicht jetzt', 'Soll ich dich zur Bank bringen?'), false)
  assert.equal(walk('Nein, lieber später', 'Soll ich dir den Weg zeigen?'), false)
})
test('unrelated affirmative utterances and unrelated target substitutions do not start movement', () => {
  assert.equal(visit('Ja, tolles Buch', 'Soll ich dich zur Bank bringen?'), false)
  assert.equal(visit('Ja', 'Soll ich dich zum Café bringen?', 'Bank'), false)
  assert.equal(visit('Bring mich zur Bank', null, 'Café'), false)
})
test('a direct player request can initiate movement without a previous offer', () => {
  assert.equal(visit('Bitte bring mich zur Bank'), true)
  assert.equal(walk('Führe mich ein Stück'), true)
})
