// ssfKnowledge.ts
// Aktualisiert: 31.08.2026 — strukturierte SSF-Interactives
// Aktualisiert: 01.09.2026 — EXT-KG-NOX-20260901-POWER-GENERATION-MAPPING:
//                              resolveModuleForUnlock() + legacyId
// Aktualisiert: 28.10.2026 — NOXIA-Lernverzeichnis als Rückfall: Module ohne
//                              eingetragene NOXIA-Freischaltung (z. B. Kredit)
//                              werden ihrer Freischaltung wieder zugeordnet
// Aktualisiert: 29.10.2026 — Prüfung aus Kurztests der Lernpfade lesen, wenn die SSF
//                              keine assessment-Liste liefert (EXT-NOXIA-SSF-20261029)
// Version:      0.9.0

import { effectiveModuleUnlocks, moduleTeachesUnlock } from './knowledge/learningCatalog'

export type SsfUnlock = string | { key: string; condition?: unknown }

export function unlockLabel(u: SsfUnlock): string {
  if (typeof u === 'string') return u
  if (u && typeof u === 'object' && typeof (u as { key?: unknown }).key === 'string') return (u as { key: string }).key
  return String(u)
}

export type SsfKnowledgeModule = {
  id: string
  legacyId: string | null
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

export function normalizeModule<T extends SsfKnowledgeModule>(m: T): T {
  return {
    ...m,
    legacyId: typeof m.legacyId === 'string' && m.legacyId ? m.legacyId : null,
    pathId: typeof m.pathId === 'string' && m.pathId ? m.pathId : null,
    // SSF-Angaben plus NOXIA-Lernverzeichnis (lib/knowledge/learningCatalog.ts)
    unlocks: effectiveModuleUnlocks({
      id: m.id,
      legacyId: m.legacyId,
      pathId: m.pathId,
      unlocks: Array.isArray(m.unlocks) ? (m.unlocks as unknown as SsfUnlock[]).map(unlockLabel) : [],
    }),
  }
}

// Kanonischer Unlock-Resolver: sucht das erste SSF-Modul, das den Unlock
// in module.unlocks[] freischaltet (Architektur laut KG/SSF-Vertrag:
// NOXIA behaelt die lokale Unlock-ID, SSF liefert die Module).
export function resolveModuleForUnlock(
  modules: SsfKnowledgeModule[],
  unlockId: string,
): SsfKnowledgeModule | null {
  // Zuerst die SSF-Angabe, dann NOXIAs eigenes Verzeichnis (Kennung/Legacy-ID).
  for (const candidate of modules) {
    if (Array.isArray(candidate.unlocks) && candidate.unlocks.some((u) => unlockLabel(u as SsfUnlock) === unlockId)) {
      return candidate
    }
  }
  return modules.find((candidate) => moduleTeachesUnlock(candidate, unlockId)) ?? null
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

// Kurztests der SSF-Lernpfade kommen heute als Aufgabe mit Rohtext an:
// „Frage||Antwort||richtige Antwort*||Antwort||Antwort---nächste Frage …“
// (SSF lib/learningQuiz.ts). Liefert die SSF keine assessment-Liste, macht NOXIA
// daraus die Prüfung und nimmt die Rohtexte aus den Abschnitten. Liefert die SSF
// eine Prüfung, gilt ihre.
export function parseSsfQuizText(text: string): SsfModuleAssessment[] | null {
  if (!text.includes('||') || !text.includes('*')) return null
  const out: SsfModuleAssessment[] = []
  for (const block of text.split('---').map(b => b.trim()).filter(Boolean)) {
    const parts = block.split('||').map(p => p.trim())
    if (parts.length < 3 || !parts[0]) return null
    const raw = parts.slice(1)
    const marked = raw.map((o, i) => (o.endsWith('*') ? i : -1)).filter(i => i >= 0)
    if (marked.length !== 1) return null
    const options = raw.map(o => (o.endsWith('*') ? o.slice(0, -1).trim() : o))
    if (options.some(o => !o)) return null
    out.push({ type: 'multiple_choice', question: parts[0], options, correctOption: marked[0], explanation: '' })
  }
  return out.length ? out : null
}

export function assessmentFromQuizSections<T extends { sections: SsfModuleSection[]; assessment: SsfModuleAssessment[] }>(m: T): T {
  if (m.assessment.length > 0) return m
  const assessment: SsfModuleAssessment[] = []
  const sections = m.sections.filter(section => {
    if (section.type !== 'task') return true
    const parsed = parseSsfQuizText(section.prompt)
    if (!parsed) return true
    assessment.push(...parsed)
    return false
  })
  return assessment.length ? { ...m, sections, assessment } : m
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
    return assessmentFromQuizSections(normalizeModule({
      ...data.module,
      sections: Array.isArray(data.module.sections) ? data.module.sections : [],
      assessment: Array.isArray(data.module.assessment) ? data.module.assessment : [],
      prerequisites: Array.isArray(data.module.prerequisites) ? data.module.prerequisites : [],
      sources: Array.isArray(data.module.sources) ? data.module.sources : [],
    }))
  } catch {
    return null
  }
}
