/**
 * Schmale Anbieter-Schicht für NPC-Gespräche (G-7/G-8, hospitality.md).
 * OpenAI-kompatibel. Reihenfolge der Anbieter kommt aus den Umgebungsvariablen;
 * bei Timeout, 429 oder 5xx geht es zum nächsten. Das Prompt bleibt unverändert,
 * es wechselt nur der Anbieter. Ohne Schlüssel ist ein Anbieter nicht vorhanden.
 */

export interface LlmProvider {
  id: string
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs: number
}

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface LlmAttempt { provider: string; status: number | 'timeout' | 'network'; ms: number }

export interface LlmResult {
  ok: true
  text: string
  provider: string
  model: string
  ms: number
  failedAttempts: LlmAttempt[]
}

export interface LlmFailure {
  ok: false
  /** Letzter Fehlerstatus (HTTP-Code, sonst 'timeout' oder 'network'). */
  status: number | 'timeout' | 'network' | 'no_provider' | 'empty'
  failedAttempts: LlmAttempt[]
}

type Env = Record<string, string | undefined>

const KNOWN: Record<string, (env: Env) => LlmProvider | null> = {
  deepseek: env => {
    const apiKey = env.DeepSeek_NPC_API_KEY
    if (!apiKey) return null
    return { id: 'deepseek', baseUrl: 'https://api.deepseek.com', apiKey, model: env.DEEPSEEK_MODEL || 'deepseek-chat', timeoutMs: 12000 }
  },
  xai: env => {
    const apiKey = env.XAI_API_KEY
    if (!apiKey) return null
    return { id: 'xai', baseUrl: 'https://api.x.ai/v1', apiKey, model: env.XAI_MODEL || 'grok-4.3', timeoutMs: 12000 }
  },
  groq: env => {
    const apiKey = env.GROQ_API_KEY
    if (!apiKey) return null
    return { id: 'groq', baseUrl: 'https://api.groq.com/openai/v1', apiKey, model: env.GROQ_MODEL || 'openai/gpt-oss-120b', timeoutMs: 8000 }
  },
  local: env => {
    const baseUrl = env.LOCAL_LLM_BASE_URL
    if (!baseUrl) return null
    return { id: 'local', baseUrl, apiKey: env.LOCAL_LLM_API_KEY || 'local', model: env.LOCAL_LLM_MODEL || 'gemma', timeoutMs: 6000 }
  },
}

function parseList(value: string | undefined): string[] {
  return (value ?? '').split(',').map(part => part.trim().toLowerCase()).filter(Boolean)
}

/** Normale Kette aus NPC_LLM_CHAIN (Standard: deepseek). Unbekannte oder schlüssellose Einträge entfallen. */
export function buildChain(env: Env): LlmProvider[] {
  const ids = parseList(env.NPC_LLM_CHAIN)
  return (ids.length ? ids : ['deepseek']).map(id => KNOWN[id]?.(env) ?? null).filter((p): p is LlmProvider => p !== null)
}

/**
 * Anbieter für Eskalationsfälle (NPC_LLM_ESCALATION, z. B. `xai`). Ohne Eintrag oder
 * Schlüssel leer – dann antwortet die normale Kette.
 */
export function buildEscalation(env: Env): LlmProvider[] {
  return parseList(env.NPC_LLM_ESCALATION).map(id => KNOWN[id]?.(env) ?? null).filter((p): p is LlmProvider => p !== null)
}

/** Zeigt, ob ein Fehlerstatus den nächsten Anbieter rechtfertigt. */
export function shouldFallBack(status: number | 'timeout' | 'network'): boolean {
  if (status === 'timeout' || status === 'network') return true
  return status === 429 || status >= 500
}

export interface CallOptions {
  maxTokens: number
  temperature: number
  fetchImpl?: typeof fetch
  now?: () => number
}

/** Fragt die Anbieter der Reihe nach, bis einer antwortet. */
export async function callChat(providers: LlmProvider[], messages: ChatMessage[], options: CallOptions): Promise<LlmResult | LlmFailure> {
  const doFetch = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now
  const failedAttempts: LlmAttempt[] = []
  if (!providers.length) return { ok: false, status: 'no_provider', failedAttempts }
  let last: LlmFailure['status'] = 'no_provider'

  for (const provider of providers) {
    const startedAt = now()
    try {
      const response = await doFetch(`${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
        body: JSON.stringify({
          model: provider.model,
          messages,
          max_tokens: options.maxTokens,
          temperature: options.temperature,
          stream: false,
        }),
        signal: AbortSignal.timeout(provider.timeoutMs),
      })
      const ms = now() - startedAt
      if (!response.ok) {
        failedAttempts.push({ provider: provider.id, status: response.status, ms })
        last = response.status
        if (shouldFallBack(response.status)) continue
        return { ok: false, status: response.status, failedAttempts }
      }
      const data = await response.json()
      const text = String(data?.choices?.[0]?.message?.content ?? '')
      if (!text.trim()) {
        failedAttempts.push({ provider: provider.id, status: 200, ms })
        last = 'empty'
        continue
      }
      return { ok: true, text, provider: provider.id, model: provider.model, ms, failedAttempts }
    } catch (error) {
      const ms = now() - startedAt
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
      const status = timedOut ? 'timeout' : 'network'
      failedAttempts.push({ provider: provider.id, status, ms })
      last = status
    }
  }
  return { ok: false, status: last, failedAttempts }
}
