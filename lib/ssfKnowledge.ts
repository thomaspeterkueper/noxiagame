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
    // Option 1: Protection Bypass Secret (set SSF_BYPASS_SECRET in NOXIA Vercel env)
    const bypassSecret = process.env.SSF_BYPASS_SECRET ?? process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? ''
    // Option 2: Vercel OIDC token (automatic for same-team Trusted Sources)
    const oidcToken = process.env.VERCEL_OIDC_TOKEN ?? ''
    const response = await fetch(`${baseUrl}/api/noxia/modules`, {
      headers: {
        accept: 'application/json',
        // Bypass Vercel Deployment Protection — three methods in priority order:
        // 1. Protection Bypass Secret (manual, set in NOXIA env vars)
        ...(bypassSecret ? { 'x-vercel-protection-bypass': bypassSecret } : {}),
        // 2. OIDC Token (automatic for same-team Trusted Sources — noxiagame is listed)
        ...(oidcToken ? { 'x-vercel-trusted-oidc-idp-token': oidcToken } : {}),
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
