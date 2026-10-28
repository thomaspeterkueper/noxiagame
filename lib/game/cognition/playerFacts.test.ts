import assert from 'node:assert/strict'
import { playerNameFromUtterance as name, statedOwnAge } from './playerFacts'
import { ageAtTick, ageInGameYear, gameYearForTick, GAME_START_YEAR, TICKS_PER_YEAR } from '../gameCalendar'

assert.equal(name('Nenn mich Thomas, und ich gebe uns beiden einen Kaffee aus'), 'Thomas')
assert.equal(name('ich heisse übrigens Thomas'), 'Thomas')
assert.equal(name('Nenn mich Thomas und ich lade dich ein'), 'Thomas')
assert.equal(name('ich heiße Thomas'), 'Thomas')
assert.equal(name('mein name ist thomas küper'), 'Thomas Küper')
assert.equal(name('hallo, ich bin Thomas, wer bist du?'), 'Thomas')
assert.equal(name('ich bin neu hier'), null)
assert.equal(name('Ich bin Neu hier'), null)
assert.equal(name('ich bin müde'), null)
assert.equal(name('Hallo Elias, ich bin Aristeas, ja ich bin neu.'), 'Aristeas')
assert.equal(name('wie heißt du?'), null)

assert.equal(statedOwnAge('Ich bin 42 und arbeite hier seit Jahren.', 42), 42)
assert.equal(statedOwnAge('Mit 41 Jahren alt genug, um das zu wissen – ich bin 41 Jahre alt.', 42), 41)
assert.equal(statedOwnAge('Ich bin 30.', 42), null, 'erfundenes Alter wird nicht gelernt')
assert.equal(statedOwnAge('Ich bin 42.', null), null)
assert.equal(statedOwnAge('Das kostet 42 Credits.', 42), null)

assert.equal(GAME_START_YEAR, 2086)
assert.equal(gameYearForTick(0), 2086)
assert.equal(gameYearForTick(TICKS_PER_YEAR - 1), 2086)
assert.equal(gameYearForTick(TICKS_PER_YEAR), 2087)
assert.equal(ageInGameYear(2028, 2086), 58)
assert.equal(ageAtTick(2028, 2593), 58)
assert.equal(ageAtTick(null, 2593), null)

console.log('playerFacts: ok')
