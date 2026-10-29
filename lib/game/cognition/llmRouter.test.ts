import assert from 'node:assert/strict'
import { buildChain, buildEscalation, callChat, shouldFallBack, type LlmFailure, type LlmProvider, type LlmResult } from './llmRouter'

function failure(r: LlmResult | LlmFailure): LlmFailure { assert.equal(r.ok, false); return r as LlmFailure }

// Kette aus Umgebungsvariablen
assert.deepEqual(buildChain({}).map(p => p.id), [])
assert.deepEqual(buildChain({ DeepSeek_NPC_API_KEY: 'k' }).map(p => p.id), ['deepseek'])
assert.deepEqual(buildChain({ NPC_LLM_CHAIN: 'groq, deepseek', GROQ_API_KEY: 'g', DeepSeek_NPC_API_KEY: 'k' }).map(p => p.id), ['groq', 'deepseek'])
// Ohne Schlüssel entfällt der Eintrag; unbekannte Namen auch
assert.deepEqual(buildChain({ NPC_LLM_CHAIN: 'groq,unbekannt,deepseek', DeepSeek_NPC_API_KEY: 'k' }).map(p => p.id), ['deepseek'])
// Eskalation nur, wenn gesetzt und Schlüssel da
assert.deepEqual(buildEscalation({ XAI_API_KEY: 'x' }), [])
assert.deepEqual(buildEscalation({ NPC_LLM_ESCALATION: 'xai' }), [])
assert.deepEqual(buildEscalation({ NPC_LLM_ESCALATION: 'xai', XAI_API_KEY: 'x' }).map(p => p.id), ['xai'])

assert.equal(shouldFallBack(429), true)
assert.equal(shouldFallBack(503), true)
assert.equal(shouldFallBack('timeout'), true)
assert.equal(shouldFallBack(401), false)
assert.equal(shouldFallBack(400), false)

const a: LlmProvider = { id: 'a', baseUrl: 'https://a.test/v1/', apiKey: 'ka', model: 'ma', timeoutMs: 1000 }
const b: LlmProvider = { id: 'b', baseUrl: 'https://b.test', apiKey: 'kb', model: 'mb', timeoutMs: 1000 }
const msgs = [{ role: 'user' as const, content: 'hi' }]
const opts = { maxTokens: 50, temperature: 0.5 }
const okResponse = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 })

async function main() {
  // Erster Anbieter antwortet
  const urls: string[] = []
  let r = await callChat([a, b], msgs, { ...opts, fetchImpl: async (url: RequestInfo | URL) => { urls.push(String(url)); return okResponse('Hallo') } })
  assert.ok(r.ok && r.text === 'Hallo' && r.provider === 'a' && r.failedAttempts.length === 0)
  assert.deepEqual(urls, ['https://a.test/v1/chat/completions'])

  // 429 beim ersten → zweiter antwortet, Fehlversuch wird vermerkt
  r = await callChat([a, b], msgs, { ...opts, fetchImpl: async (url: RequestInfo | URL) => String(url).startsWith('https://a.') ? new Response('', { status: 429 }) : okResponse('Zweiter') })
  assert.ok(r.ok && r.provider === 'b' && r.failedAttempts.length === 1 && r.failedAttempts[0].status === 429)

  // 401 bricht ab, kein Ausweichen (falscher Schlüssel soll auffallen)
  let calls = 0
  r = await callChat([a, b], msgs, { ...opts, fetchImpl: async () => { calls++; return new Response('', { status: 401 }) } })
  assert.equal(failure(r).status, 401); assert.equal(calls, 1)

  // Netzwerkfehler → nächster
  r = await callChat([a, b], msgs, { ...opts, fetchImpl: async (url: RequestInfo | URL) => { if (String(url).startsWith('https://a.')) throw new Error('boom'); return okResponse('ok') } })
  assert.ok(r.ok && r.provider === 'b' && r.failedAttempts[0].status === 'network')

  // Leere Antwort → nächster
  r = await callChat([a, b], msgs, { ...opts, fetchImpl: async (url: RequestInfo | URL) => okResponse(String(url).startsWith('https://a.') ? '  ' : 'voll') })
  assert.ok(r.ok && r.text === 'voll')

  // Alle scheitern
  r = await callChat([a, b], msgs, { ...opts, fetchImpl: async () => new Response('', { status: 503 }) })
  assert.equal(failure(r).status, 503); assert.equal(failure(r).failedAttempts.length, 2)

  // Kein Anbieter
  r = await callChat([], msgs, opts)
  assert.equal(failure(r).status, 'no_provider')
  console.log('llmRouter ok')
}
main()
