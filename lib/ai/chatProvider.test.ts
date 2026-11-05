import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatComplete, shouldFallBack } from './chatProvider.server'

const env = { ...process.env }
afterEach(() => { process.env = { ...env }; vi.unstubAllGlobals() })

function reply(status: number, content = 'Hallo') {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status })
}

describe('chatComplete', () => {
  it('fällt bei fehlendem Guthaben auf den nächsten Anbieter zurück', async () => {
    process.env.XAI_API_KEY = 'x'; process.env.DeepSeek_NPC_API_KEY = 'd'; delete process.env.CHAT_PROVIDERS
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(402)).mockResolvedValueOnce(reply(200, 'von Grok'))
    vi.stubGlobal('fetch', fetchMock)
    const result = await chatComplete({ messages: [{ role: 'user', content: 'hi' }], maxTokens: 10, temperature: 0, timeoutMs: 5000 })
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.deepseek.com')
    expect(result).toMatchObject({ ok: true, content: 'von Grok', provider: 'xai' })
  })

  it('nutzt DeepSeek zuerst und hört bei Erfolg auf', async () => {
    process.env.XAI_API_KEY = 'x'; process.env.DeepSeek_NPC_API_KEY = 'd'
    const fetchMock = vi.fn().mockResolvedValue(reply(200, 'von DeepSeek'))
    vi.stubGlobal('fetch', fetchMock)
    const result = await chatComplete({ messages: [{ role: 'user', content: 'hi' }], maxTokens: 10, temperature: 0, timeoutMs: 5000 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ ok: true, provider: 'deepseek' })
  })

  it('wechselt nicht bei einer fehlerhaften Anfrage', () => {
    expect(shouldFallBack(400)).toBe(false)
    expect(shouldFallBack(402)).toBe(true)
    expect(shouldFallBack(503)).toBe(true)
  })
})
