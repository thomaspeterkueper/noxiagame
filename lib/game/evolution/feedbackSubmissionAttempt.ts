/** Stable retry identity for an unchanged draft; pure and browser-independent. */
export function selectFeedbackAttempt(previous: { body: string; key: string } | null, body: string, nextKey: string) {
  if (typeof body !== 'string' || body.length === 0 || body.length > 8192 ||
      typeof nextKey !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(nextKey)) return null
  if (previous && previous.body === body && /^[a-zA-Z0-9_-]{16,128}$/.test(previous.key))
    return { body, key: previous.key }
  return { body, key: nextKey }
}
