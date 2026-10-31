/** Pure idempotency contract; caller must authenticate and scope lookups to owner. */
export function classifyFeedbackRetry(existing: unknown, ownerId: unknown, key: unknown, fingerprint: unknown): 'new' | 'replay' | 'conflict' | 'invalid' {
  if (typeof ownerId !== 'string' || !/^[0-9a-f-]{36}$/i.test(ownerId) ||
      typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(key) ||
      typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint)) return 'invalid'
  if (existing === null) return 'new'
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return 'invalid'
  const record = existing as Record<string, unknown>
  if (record.owner_user_id !== ownerId || record.idempotency_key !== key) return 'conflict'
  return record.payload_fingerprint === fingerprint ? 'replay' : 'conflict'
}
