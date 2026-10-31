import { classifyFeedbackRetry as check } from './feedbackIdempotency'
const assert = (ok: boolean, message: string) => { if (!ok) throw Error(message) }
const owner = '123e4567-e89b-42d3-a456-426614174000', key = 'feedback-request-0001', hash = 'a'.repeat(64)
const record = { owner_user_id: owner, idempotency_key: key, payload_fingerprint: hash }
assert(check(null, owner, key, hash) === 'new', 'new request')
assert(check(record, owner, key, hash) === 'replay', 'same payload is replay')
assert(check(record, owner, key, 'b'.repeat(64)) === 'conflict', 'different payload is conflict')
assert(check(record, '123e4567-e89b-42d3-a456-426614174001', key, hash) === 'conflict', 'different owner conflict')
assert(check(record, owner, 'feedback-request-0002', hash) === 'conflict', 'different key conflict')
assert(check(null, owner, 'short', hash) === 'invalid', 'invalid key')
assert(check(null, owner, key, 'wrong') === 'invalid', 'invalid fingerprint')
assert(check({}, owner, key, hash) === 'conflict', 'incomplete stored record')
console.log('Feedback idempotency contract tests passed')
