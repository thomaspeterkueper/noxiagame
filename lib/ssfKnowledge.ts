// ssfKnowledge.ts
// Aktualisiert: 31.08.2026 — strukturierte SSF-Interactives
// Version:      0.6.0

export type SsfUnlock = string | { key: string; condition?: unknown }

export function unlockLabel(u: SsfUnlock): string {
  if (typeof u === 'string') return u
  if (u && typeof u === 'object' && typeof (u as any).key === 'string') return (u as any).key
  return String(u)
}

export type SsfKnowledgeModule = {
  id: string
  pathId: string | null
  title: string
  domain: string
  difficulty: number
  durationMinutes: number
  summary: string
  unlocks: string[]
  sourceEntityIds: string[]
  ssfUrl: string
  detailUrl: string
}

export type SsfInteractiveBody = {
  id: string
  label: string
  massKg: number
  radiusM: number
}

export type SsfInteractiveParams = {
  bodies: SsfInteractiveBody[]
  distance: {
    unit: 'body_radii'
    min: number
    max: number
    step: number
    default: number
  }
  testMassKg: number
  constants: { G: number }
}

export type SsfModuleSection =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'key_point'; text: string }
  | { type: 'example'; title: string; text: string }
  | { type: 'task'; prompt: string; hint?: string }
  | {
      type: 'interactive'
      interactiveId: string
      title: string
      instruction: string
      params: SsfInteractiveParams
      fallback: string
    }

export type SsfModuleAssessment = {
  type: 'multiple_choice'
  question: string
  options: string[]
  correctOption: number
  explanation: string
}

export type SsfKnowledgeModuleDetail = SsfKnowledgeModule & {
  schemaVersion: string
  contentVersion: string
  sections: SsfModuleSection[]
  assessment: SsfModuleAssessment[]
  prerequisites: string[]
  sources: Array<{ authority: string; entityIds: string[] }>
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

function ssfHeaders(): Record<string, string> {
  const bypassSecret = process.env.SSF_BYPASS_SECRET ?? process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? ''
  const oidcToken = process.env.VERCEL_OIDC_TOKEN ?? ''
  return {
    accept: 'application/json',
    ...(bypassSecret ? { 'x-vercel-protection-bypass': bypassSecret } : {}),
    ...(oidcToken ? { 'x-vercel-trusted-oidc-idp-token': oidcToken } : {}),
  }
}

function normalizeModule<T extends SsfKnowledgeModule>(m: T): T {
  return {
    ...m,
    pathId: typeof m.pathId === 'string' && m.pathId ? m.pathId : null,
    unlocks: Array.isArray(m.unlocks)
      ? (m.unlocks as unknown as SsfUnlock[]).map(unlockLabel)
      : [],
  }
}

export async function fetchSsfKnowledgeModules(): Promise<SsfKnowledgeModule[]> {
  const baseUrl = getSsfBaseUrl().replace(/\/$/, '')
  try {
    const response = await fetch(`${baseUrl}/api/noxia/modules`, { headers: ssfHeaders() })
    if (!response.ok) return []
    const data = (await response.json()) as SsfModulesPayload
    const modules = Array.isArray(data.modules) ? data.modules : []
    return modules.map(normalizeModule)
  } catch {
    return []
  }
}

export async function fetchSsfKnowledgeModule(moduleId: string): Promise<SsfKnowledgeModuleDetail | null> {
  const baseUrl = getSsfBaseUrl().replace(/\/$/, '')
  try {
    const response = await fetch(`${baseUrl}/api/noxia/modules/${encodeURIComponent(moduleId)}`, {
      headers: ssfHeaders(),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const data = await response.json() as { module?: SsfKnowledgeModuleDetail }
    if (!data.module) return null
    return normalizeModule({
      ...data.module,
      sections: Array.isArray(data.module.sections) ? data.module.sections : [],
      assessment: Array.isArray(data.module.assessment) ? data.module.assessment : [],
      prerequisites: Array.isArray(data.module.prerequisites) ? data.module.prerequisites : [],
      sources: Array.isArray(data.module.sources) ? data.module.sources : [],
    })
  } catch {
    return null
  }
}
