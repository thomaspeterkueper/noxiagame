/** Pure idempotency contract; caller must authenticate and scope lookups to owner. */
// Supabase Auth identities are UUIDs. Reject malformed IDs before treating an
// absent database row as a new submission; this does not replace JWT validation.
const AUTH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function classifyFeedbackRetry(existing: unknown, ownerId: unknown, key: unknown, fingerprint: unknown): 'new' | 'replay' | 'conflict' | 'invalid' {
  if (typeof ownerId !== 'string' || !AUTH_UUID.test(ownerId) ||
      typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(key) ||
      typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint)) return 'invalid'
  if (existing === null) return 'new'
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return 'invalid'
  const record = existing as Record<string, unknown>
  // PostgreSQL uuid equality is case-insensitive; a database round trip may
  // return lowercase even when the verified auth UUID was supplied uppercase.
  // Keep the same owner binding without making retries spuriously conflict.
  if (typeof record.owner_user_id !== 'string' || !AUTH_UUID.test(record.owner_user_id) ||
      record.owner_user_id.toLowerCase() !== ownerId.toLowerCase() ||
      record.idempotency_key !== key) return 'conflict'
  return record.payload_fingerprint === fingerprint ? 'replay' : 'conflict'
}
