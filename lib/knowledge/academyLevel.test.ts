import assert from 'node:assert/strict'
import { domainScores, nextAcademyLevel, quizResultLine, weakestDomain } from './academyLevel'

const T = true, F = false
assert.equal(nextAcademyLevel(3, [T, T, T]), 3, 'zu wenige Ergebnisse')
assert.equal(nextAcademyLevel(3, [T, T, T, T, F]), 4)
assert.equal(nextAcademyLevel(3, [F, F, T, F, F]), 2)
assert.equal(nextAcademyLevel(3, [T, F, T, F, F]), 3)
assert.equal(nextAcademyLevel(6, [T, T, T, T, T]), 6)
assert.equal(nextAcademyLevel(1, [F, F, F, F, F]), 1)
assert.equal(nextAcademyLevel(3, [T, T, T, T, T, F, F, F]), 4, 'nur die letzten fünf')

const qs = [{ domain: 'Physik', correct: 1 }, { domain: 'Physik', correct: 0 }, { domain: 'Logik', correct: 2 }]
const scores = domainScores(qs, [1, 2, 2])
assert.deepEqual(scores, { Physik: { right: 1, total: 2 }, Logik: { right: 1, total: 1 } })
assert.equal(weakestDomain(scores), 'Physik')
assert.equal(weakestDomain({ Logik: { right: 1, total: 1 } }), null)
assert.equal(quizResultLine(7, 7, 6), '7 von 7 richtig – du beginnst in der Akademie auf Stufe 6. Die Stufe passt sich später an deine Ergebnisse an.')

console.log('academyLevel: ok')
