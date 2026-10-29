import assert from 'node:assert/strict'
import { examPremiumForModule, examRetryBlocked, parseExamAnswers, scoreExam } from './academyExam'

assert.deepEqual(scoreExam([0, 1, 2], [0, 1, 0]), { correct: 2, total: 3, passed: false, needed: 3 })
assert.equal(scoreExam([0, 1, 2, 3], [0, 1, 2, 0]).passed, true)
assert.equal(scoreExam([], []).passed, false)
assert.deepEqual(parseExamAnswers('0,2,,x,1'), [0, 2, null, null, 1])
assert.equal(parseExamAnswers(''), null)
assert.equal(examPremiumForModule('ECO-L0-000002'), 30)
assert.equal(examPremiumForModule('ECO-L1-000003'), 60)
assert.equal(examPremiumForModule('PHY-L2-000001'), 120)
const now = 10_000_000
assert.equal(examRetryBlocked([now - 60_000, now - 120_000], now).blocked, false)
const b = examRetryBlocked([now - 60_000, now - 120_000, now - 5 * 60_000], now)
assert.equal(b.blocked, true)
assert.equal(b.retryInMin, 25)
assert.equal(examRetryBlocked([now - 40 * 60_000, now - 60_000, now - 120_000], now).blocked, false)
console.log('academyExam ok')
