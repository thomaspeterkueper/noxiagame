// ssfKnowledge.ts
// Aktualisiert: 04.07.2026 — Header ergänzt; SSF-Modul-Fetch
// Version:      0.2.0
export type SsfKnowledgeModule = {
  id: string
  title: string
  domain: string
  difficulty: number
  durationMinutes: number
  summary: string
  unlocks: string[]
  sourceEntityIds: string[]
  ssfUrl: string
}

export type SsfModulesPayload = {
  schema: string
  source: string
  consumer: string
  modules: SsfKnowledgeModule[]
}

const DEFAULT_SSF_BASE_URL = 'https://solarsciencefoundation.vercel.app'

export function getSsfBaseUrl() {
  return process.env.SSF_BASE_URL ?? DEFAULT_SSF_BASE_URL
}

export async function fetchSsfKnowledgeModules(): Promise<SsfKnowledgeModule[]> {
  const baseUrl = getSsfBaseUrl().replace(/\/$/, '')

  try {
    const response = await fetch(`${baseUrl}/api/noxia/modules`, {
      next: { revalidate: 300 },
      headers: { accept: 'application/json' }
    })

    if (!response.ok) return []

    const data = (await response.json()) as SsfModulesPayload
    return Array.isArray(data.modules) ? data.modules : []
  } catch {
    return []
  }
}
