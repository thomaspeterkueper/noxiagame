// ssfKnowledge.ts
// Aktualisiert: 24.08.2026 — BUGFIX React error #31. Die SSF-Schnittstelle
// (externes Repo, andere Vercel-Deployment) liefert `unlocks`-Einträge
// inzwischen z.T. als Objekt { key, condition } statt als reinen String —
// der statische Typ `string[]` schützte nicht, weil die JSON-Antwort zur
// Laufzeit nie validiert wurde. SchoolOverlay.tsx rendert m.unlocks![0]
// direkt als Text → React versuchte ein Objekt zu rendern → Error #31,
// unabhängig von Location/Account/Plattform, weil die Akademie bei jedem
// Öffnen /api/ssf/modules lädt. Fix: SsfUnlock-Union-Type + unlockLabel()
// normalisiert JEDEN Eintrag beim Import auf einen reinen String — kein
// ungeprüftes externes JSON gelangt mehr bis ins JSX, für alle Consumer.
// Version:      0.4.0

// Ein SSF-Unlock-Eintrag kann ein reiner String sein (Normalfall) oder ein
// Objekt mit key/condition (aktuelles Verhalten der SSF-Schnittstelle).
export type SsfUnlock = string | { key: string; condition?: unknown }

// Extrahiert einen anzeigbaren String aus einem SsfUnlock-Eintrag, egal in
// welcher Form er ankommt. Einziger Ort, an dem diese Fallunterscheidung
// nötig ist — alles danach arbeitet garantiert mit string.
export function unlockLabel(u: SsfUnlock): string {
  if (typeof u === 'string') return u
  if (u && typeof u === 'object' && typeof (u as any).key === 'string') return (u as any).key
  return String(u)
}

export type SsfKnowledgeModule = {
  id: string
  title: string
  domain: string
  difficulty: number
  durationMinutes: number
  summary: string
  unlocks: string[]   // ← nach Normalisierung immer reine Strings, garantiert
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
    const modules = Array.isArray(data.modules) ? data.modules : []

    // Normalisierung: unlocks können roh { key, condition } enthalten (siehe
    // Kommentar oben) — hier auf reine Strings gebracht, für alle Consumer
    // im Projekt garantiert sicher.
    return modules.map(m => ({
      ...m,
      unlocks: Array.isArray(m.unlocks)
        ? (m.unlocks as unknown as SsfUnlock[]).map(unlockLabel)
        : [],
    }))
  } catch {
    return []
  }
}
