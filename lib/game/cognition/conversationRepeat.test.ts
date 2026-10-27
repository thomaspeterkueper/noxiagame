import assert from 'node:assert/strict'
import {
  assessRepeat,
  breakoffLine,
  inBreakoffCooldown,
  isRepeatCandidate,
  normalizeUtterance,
  utteranceSimilarity,
  BREAKOFF_COOLDOWN_MS,
} from './conversationRepeat'

assert.equal(normalizeUtterance('Wo gibt’s hier Arbeit?!'), 'wo gibt s hier arbeit')
assert.equal(normalizeUtterance('Grüße'), 'gruesse')

// Kurze Zustimmungen zählen nicht.
assert.equal(isRepeatCandidate('ja'), false)
assert.equal(isRepeatCandidate('okay!'), false)
assert.equal(isRepeatCandidate('Wo finde ich Arbeit?'), true)

// Fast dieselbe Frage.
assert.ok(utteranceSimilarity('Wo finde ich hier Arbeit?', 'wo finde ich arbeit') >= 0.6)
assert.ok(utteranceSimilarity('Wo finde ich Arbeit?', 'Was kostet der Kaffee?') < 0.6)

const asks = ['Wo finde ich Arbeit?', 'wo finde ich hier arbeit', 'Wo kann ich Arbeit finden?']
assert.equal(assessRepeat('Wo finde ich Arbeit?', []).level, 'none')
assert.equal(assessRepeat('Wo finde ich Arbeit?', asks.slice(0, 1)).level, 'none')
assert.equal(assessRepeat('Wo finde ich Arbeit?', asks.slice(0, 2)).level, 'hint')
assert.equal(assessRepeat('Wo finde ich Arbeit?', asks).level, 'breakoff')
// Andere Fragen dazwischen zählen nicht mit.
assert.equal(assessRepeat('Was kostet der Kaffee?', asks).level, 'none')
// „ja“ dreimal ist kein Grund zum Abbruch.
assert.equal(assessRepeat('ja', ['ja', 'ja', 'ja', 'ja']).level, 'none')

assert.equal(breakoffLine('x', 0), 'Ich habe keine Zeit, sie hier mit dir zu vertrödeln.')
assert.equal(typeof breakoffLine('x', 2), 'string')

const now = Date.parse('2026-10-27T12:00:00Z')
assert.equal(inBreakoffCooldown(null, now), false)
assert.equal(inBreakoffCooldown(new Date(now - 60_000).toISOString(), now), true)
assert.equal(inBreakoffCooldown(new Date(now - BREAKOFF_COOLDOWN_MS - 1).toISOString(), now), false)


// Dasselbe Anliegen in anderen Worten (aus dem Testprotokoll, 27.10.2026).
const tanz = ['Ich möchte, dass du einen Tanz mit dem Buch machst', 'Ich möchte Tanz sehen', 'Tanzt du für mich?']
assert.equal(assessRepeat('Ich möchte, dass du für mich tanzt', tanz).level, 'breakoff')
// Bestellen ist kein Kreisen.
const orders = ['Noch einen Kaffee bitte', 'noch einen kaffee bitte', 'Noch einen Kaffee, bitte!']
assert.equal(assessRepeat('Noch einen Kaffee bitte', orders).level, 'none')
// Verschiedene Themen nacheinander.
const varied = ['Wo ist die Akademie?', 'Was kostet ein Ticket zum Mond?', 'Wer war zuletzt hier?']
assert.equal(assessRepeat('Kennst du die Verwaltung?', varied).level, 'none')

console.log('conversationRepeat: ok')
