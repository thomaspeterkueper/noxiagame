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
// Malformed owner IDs must fail closed even when no previous row exists.
for (const invalidOwner of [
  '------------------------------------',
  '123e4567e89b42d3a456426614174000',
  '123e4567-e89b-02d3-a456-426614174000',
  '123e4567-e89b-42d3-7456-426614174000',
  '123e4567-e89b-42d3-a456-42661417400z',
  '', null, 42,
]) {
  assert(check(null, invalidOwner, key, hash) === 'invalid', 'invalid owner cannot start a new submission')
  assert(check(record, invalidOwner, key, hash) === 'invalid', 'invalid owner cannot replay')
}
assert(check(null, '123E4567-E89B-42D3-A456-426614174000', key, hash) === 'new',
  'case-insensitive UUID syntax remains supported')
console.log('Feedback idempotency contract tests passed')
