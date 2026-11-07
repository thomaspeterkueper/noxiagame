/** Restrict disposable Supabase fixture traffic to one explicit loopback origin.
 * Prevent accidental HTTP redirects to a remote service during RLS tests.
 * This is defense in depth; a local proxy can still forward traffic elsewhere.
 */
'use strict'

function createLocalOnlyFetch(expectedOrigin, delegate = globalThis.fetch) {
  const expected = new URL(expectedOrigin)
  if (expected.protocol !== 'http:' ||
      !['127.0.0.1', '[::1]', 'localhost'].includes(expected.hostname) ||
      expected.username || expected.password || expected.origin !== expectedOrigin)
    throw Error('Local feedback fetch requires an exact loopback HTTP origin')
  if (typeof delegate !== 'function') throw Error('Fetch implementation required')

  return async (input, init = {}) => {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url
    let target
    try { target = new URL(raw) } catch { throw Error('Invalid local feedback request URL') }
    if (target.origin !== expected.origin || target.username || target.password)
      throw Error('Refusing non-local or different-origin feedback request')
    const response = await delegate(input, { ...init, redirect: 'manual' })
    if (response.status >= 300 && response.status < 400)
      throw Error('Refusing redirect from local feedback test endpoint')
    return response
  }
}

module.exports = { createLocalOnlyFetch }
