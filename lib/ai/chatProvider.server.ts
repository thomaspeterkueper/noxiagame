// lib/ai/chatProvider.server.ts
// Sprachmodell für Gespräche, Predigten und Wünsche (31.10.2026).
//
// Zuerst DeepSeek, dann Grok (xAI). Beide sprechen dieselbe Chat-Schnittstelle.
// Lehnt ein Anbieter ab, weil das Guthaben fehlt (402), der Schlüssel nicht passt
// (401/403), das Modell unbekannt ist (404), zu viele Anfragen kommen (429) oder der
// Dienst gestört ist (5xx), versucht es der nächste. Welche Reihenfolge gilt, lässt
// sich mit CHAT_PROVIDERS="xai,deepseek" ändern, ohne Code anzufassen.

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

interface Provider {
  id: 'xai' | 'deepseek'
  url: string
  key: string | undefined
  model: string
}

function providers(): Provider[] {
  const all: Record<Provider['id'], Provider> = {
    xai: {
      id: 'xai',
      url: 'https://api.x.ai/v1/chat/completions',
      key: process.env.XAI_API_KEY,
      model: process.env.XAI_MODEL || 'grok-4-1-fast-non-reasoning',
    },
    deepseek: {
      id: 'deepseek',
      url: 'https://api.deepseek.com/chat/completions',
      key: process.env.DeepSeek_NPC_API_KEY,
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    },
  }
  const order = (process.env.CHAT_PROVIDERS || 'deepseek,xai')
    .split(',').map(id => id.trim()).filter((id): id is Provider['id'] => id in all)
  return order.map(id => all[id]).filter(provider => !!provider.key)
}

export function chatProviderAvailable() {
  return providers().length > 0
}

/** Diese Fehler liegen beim Anbieter, nicht an der Anfrage: dann den nächsten versuchen. */
export function shouldFallBack(status: number) {
  return status === 401 || status === 402 || status === 403 || status === 404 || status === 429 || status >= 500
}

export type ChatResult =
  | { ok: true; content: string; model: string; provider: Provider['id'] }
  | { ok: false; error: string; model: string | null }

export async function chatComplete(options: {
  messages: ChatMessage[]
  maxTokens: number
  temperature: number
  json?: boolean
  timeoutMs: number
}): Promise<ChatResult> {
  const list = providers()
  if (!list.length) return { ok: false, error: 'no_provider', model: null }
  const deadline = Date.now() + options.timeoutMs
  let last: ChatResult = { ok: false, error: 'no_provider', model: null }
  for (const provider of list) {
    const remaining = deadline - Date.now()
    if (remaining < 1500) break
    try {
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
        body: JSON.stringify({
          model: provider.model,
          messages: options.messages,
          max_tokens: options.maxTokens,
          temperature: options.temperature,
          stream: false,
          ...(options.json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: AbortSignal.timeout(remaining),
      })
      if (!response.ok) {
        last = { ok: false, error: `${provider.id}_${response.status}`, model: provider.model }
        console.error('chat provider refused', { provider: provider.id, status: response.status })
        if (shouldFallBack(response.status)) continue
        return last
      }
      const data = await response.json()
      return { ok: true, content: String(data?.choices?.[0]?.message?.content ?? ''), model: provider.model, provider: provider.id }
    } catch {
      last = { ok: false, error: `${provider.id}_timeout`, model: provider.model }
    }
  }
  return last
}
