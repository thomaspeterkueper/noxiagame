// ssfKnowledge.ts
// Aktualisiert: 2026-07-20 — Bypass-Secret Header für Vercel Protection
// Version:      0.3.0
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
    const bypassSecret = process.env.SSF_BYPASS_SECRET ?? process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? ''
    const response = await fetch(`${baseUrl}/api/noxia/modules`, {
      headers: {
        accept: 'application/json',
        // Bypass Vercel Deployment Protection if secret is set
        // Set in NOXIA Vercel: SSF_BYPASS_SECRET=<secret from SSF project>
        ...(bypassSecret ? { 'x-vercel-protection-bypass': bypassSecret } : {}),
      },
      // next: { revalidate: 300 } — inherit from page
    })

    if (!response.ok) return []

    const data = (await response.json()) as SsfModulesPayload
    return Array.isArray(data.modules) ? data.modules : []
  } catch {
    return []
  }
}
