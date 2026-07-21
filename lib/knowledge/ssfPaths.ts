// lib/knowledge/ssfPaths.ts
// Erstellt:     19.07.2026
// Aktualisiert: 20.07.2026 — SSF-0019 implementiert: /learn?path=...&module=...
// Version:      1.2.0
//
// Kanonische SSF Pfad-IDs (von SSF-0008 bis SSF-0018 geliefert)
// Mapping: PATH:SSF:* → UNL:NOX:*

export const SSF_PATH_UNLOCKS: Record<string, string> = {
  'PATH:SSF:ECO-KREDIT-NOXIA-0001':     'UNL:NOX:bank-credit',
  'PATH:SSF:ECO-ZINSESZINS-NOXIA-0001': 'UNL:NOX:bank-compound',
  'PATH:SSF:AST-SONNENSYSTEM-0001':      'UNL:NOX:NAV:ORBITAL',
  'PATH:SSF:PHY-SPEKTRALANALYSE-0001':   'UNL:NOX:SENSOR:SPECTRAL',
  'PATH:SSF:PHY-WASSER-DIPOL-0001':      'UNL:NOX:CHEM:WATER-MOLECULE',
  'PATH:SSF:PHY-WASSER-PHASEN-0001':     'UNL:NOX:PHY:PHASE-DIAGRAM',
  'PATH:SSF:PHY-WASSER-EIS-0001':        'UNL:NOX:PHY:DENSITY-ANOMALY',
  'PATH:SSF:PHY-WASSER-OBERFL-0001':     'UNL:NOX:PHY:SURFACE-TENSION',
  'PATH:SSF:PHY-WASSER-SUBLIM-0001':     'UNL:NOX:PHY:SUBLIMATION',
  'PATH:SSF:PHY-WASSER-WAERME-0001':     'UNL:NOX:PHY:HEAT-CAPACITY',
}

// Modul-ID → Pfad-ID (für SSF-Links in SchoolOverlay)
export const MODULE_TO_PATH: Record<string, string> = {
  'ECO-L0-000001': 'PATH:SSF:ECO-KREDIT-NOXIA-0001',
  'ECO-L0-000002': 'PATH:SSF:ECO-ZINSESZINS-NOXIA-0001',
  'AST-L1-000001': 'PATH:SSF:AST-SONNENSYSTEM-0001',
  'PHY-L1-000001': 'PATH:SSF:PHY-SPEKTRALANALYSE-0001',
  'PHY-L1-000003': 'PATH:SSF:PHY-WASSER-DIPOL-0001',
  'PHY-L1-000004': 'PATH:SSF:PHY-WASSER-PHASEN-0001',
  'PHY-L1-000005': 'PATH:SSF:PHY-WASSER-EIS-0001',
  'PHY-L1-000006': 'PATH:SSF:PHY-WASSER-OBERFL-0001',
  'PHY-L1-000007': 'PATH:SSF:PHY-WASSER-SUBLIM-0001',
  'PHY-L1-000008': 'PATH:SSF:PHY-WASSER-WAERME-0001',
}

export const SSF_BASE_URL = 'https://solarsciencefoundation.vercel.app'

// SSF-0019 implementiert: /learn?path=...&uid=... → Redirect zu Lernpfad
// https://solarsciencefoundation.vercel.app/learn?path=PATH:SSF:ECO-KREDIT-NOXIA-0001&ref=noxia&uid={uid}

export function getSsfPathUrl(moduleId: string, noxiaUid?: string): string | null {
  if (!moduleId) return null
  const pathId = MODULE_TO_PATH[moduleId]
  const uid    = noxiaUid ? `&uid=${encodeURIComponent(noxiaUid)}` : ''
  if (pathId) {
    // Option 1: path= Parameter → direkter Redirect zur Lernpfad-Seite
    return `${SSF_BASE_URL}/learn?path=${encodeURIComponent(pathId)}&ref=noxia${uid}`
  }
  // Fallback: module= Parameter
  return `${SSF_BASE_URL}/learn?module=${encodeURIComponent(moduleId)}&ref=noxia${uid}`
}

// Redirect-API (Option 2 aus SSF-0019)
export function getSsfRedirectUrl(moduleId: string, noxiaUid?: string): string | null {
  const pathId = MODULE_TO_PATH[moduleId]
  if (!pathId) return null
  const uid = noxiaUid ? `&uid=${encodeURIComponent(noxiaUid)}` : ''
  return `${SSF_BASE_URL}/api/noxia/redirect?path=${encodeURIComponent(pathId)}${uid}`
}
