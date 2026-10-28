// lib/knowledge/learningCatalog.ts
// Erstellt: 28.10.2026 — Lernvoraussetzungen wieder mit den Lernmodulen verbinden
//
// Thomas, 28.10.2026: „es gibt oft Lernvoraussetzungen, z. B. Solarfeld, Kredit
// usw. In der Akademie kann man das nicht auswählen, an der Stelle wo es
// angezeigt wird auch nicht, dabei sind die Lernmodule vorhanden.“
//
// Befund: NOXIA fragte das passende Modul nur über `module.unlocks[]` bei der SSF
// ab. Die SSF liefert die Module zwar (z. B. LRN:SSF:ECO-L0-000001 „Kredit“),
// trägt aber nicht immer die NOXIA-Freischaltung ein (governed Finanzpfade:
// `unlocks: []`). Außerdem wurden Modulabschlüsse unter der SSF-Kennung
// (LRN:SSF:…) gespeichert, während Bank und Gebäude die alte Kurzkennung
// (ECO-L0-000001) erwarteten.
//
// Dieses Verzeichnis ist NOXIAs eigene Zuordnung „Freischaltung → Module, die
// sie lehren“ (dieselbe Quelle wie lib/knowledge/data.ts und ssfPaths.ts, nur
// mit allen bekannten Kennungen je Modul). Es ist Rückfall, nicht Ersatz:
// liefert die SSF `module.unlocks[]`, gilt das zuerst.

import { getUnlockDefinition } from './unlockRegistry'

export type LearningCatalogEntry = {
  unlock: string
  /** Was man damit kann – „Kredit aufnehmen“. */
  label: string
  /** Titel des Lernmoduls, wie es im Spiel heißt. */
  moduleTitle: string
  /** Alle Kennungen desselben Moduls: SSF-ID (LRN:SSF:…), Legacy-ID, alte Schreibweisen. */
  moduleIds: readonly string[]
}

export const LEARNING_CATALOG: readonly LearningCatalogEntry[] = [
  // Finanzen (Bank)
  { unlock: 'UNL:NOX:bank-credit', label: 'Kredit aufnehmen', moduleTitle: 'Was ist Kredit?',
    moduleIds: ['LRN:SSF:ECO-L0-000001', 'ECO-L0-000001', 'LRN:SSF:ECO-L0-0001', 'PATH:SSF:ECO-KREDIT-NOXIA-0001'] },
  { unlock: 'UNL:NOX:bank-compound', label: 'Zinseszins verstehen', moduleTitle: 'Was ist Zinseszins?',
    moduleIds: ['LRN:SSF:ECO-L0-000002', 'ECO-L0-000002', 'LRN:SSF:ECO-L0-0002', 'PATH:SSF:ECO-ZINSESZINS-NOXIA-0001'] },
  { unlock: 'UNL:NOX:bank-collateral', label: 'Sicherheiten verstehen', moduleTitle: 'Was ist ein Sicherheitenwert?',
    moduleIds: ['LRN:SSF:ECO-L0-000003', 'ECO-L0-000003', 'LRN:SSF:ECO-L0-0003'] },
  { unlock: 'UNL:NOX:advanced-trading', label: 'Erweiterter Handel', moduleTitle: 'Was ist Arbitrage?',
    moduleIds: ['LRN:SSF:ECO-L1-000001', 'ECO-L1-000001', 'LRN:SSF:ECO-L1-0001'] },
  { unlock: 'UNL:NOX:land-value', label: 'Bodenwert verstehen', moduleTitle: 'Was ist Bodenwert?',
    moduleIds: ['LRN:SSF:ECO-L1-000002', 'ECO-L1-000002', 'LRN:SSF:ECO-L1-0002'] },

  // Bauen (Gebäude-Voraussetzungen, lib/knowledge/buildRequirements.ts)
  { unlock: 'UNL:NOX:power-generation', label: 'Solarfeld bauen', moduleTitle: 'Energieerzeugung I',
    moduleIds: ['LRN:SSF:ENG-POWER-GENERATION-0001', 'ENG-L1-000001', 'PATH:SSF:NOX-POWER-GENERATION-0001'] },
  { unlock: 'UNL:NOX:water-processing', label: 'Wasseraufbereitung bauen', moduleTitle: 'Wasseraufbereitung I',
    moduleIds: ['LRN:SSF:NOX-WATER-PROCESSING', 'SSF-NOX-WATER-0001', 'CHE-L1-000015', 'LRN:SSF:NOX-WATER-0001'] },
  { unlock: 'UNL:NOX:resource-extraction', label: 'Mine bauen', moduleTitle: 'Rohstoffgewinnung I',
    moduleIds: ['LRN:SSF:NOX-RESOURCE-EXTRACTION', 'ENG-L1-000005'] },
  { unlock: 'UNL:NOX:pressure-systems', label: 'Drucksysteme', moduleTitle: 'Drucksysteme I',
    moduleIds: ['LRN:SSF:NOX-PRESSURE-SYSTEMS', 'PHY-L1-000026'] },
  { unlock: 'UNL:NOX:airlock', label: 'Luftschleuse bauen', moduleTitle: 'Luftschleusen I',
    moduleIds: ['LRN:SSF:NOX-AIRLOCK', 'ENG-L1-000006'] },
  { unlock: 'UNL:NOX:life-support', label: 'Lebenserhaltung bauen', moduleTitle: 'Lebenserhaltung I',
    moduleIds: ['LRN:SSF:NOX-LIFE-SUPPORT', 'BIO-L1-000002'] },
  { unlock: 'UNL:NOX:thermal-control', label: 'Thermische Kontrolle bauen', moduleTitle: 'Thermische Kontrolle I',
    moduleIds: ['LRN:SSF:NOX-THERMAL-CONTROL', 'PHY-L1-000027'] },
  { unlock: 'UNL:NOX:radiation-protection', label: 'Strahlenschutz', moduleTitle: 'Strahlenschutz I',
    moduleIds: ['LRN:SSF:NOX-RADIATION-PROTECTION', 'PHY-L1-000028'] },
  { unlock: 'UNL:NOX:environment-monitoring', label: 'Umweltüberwachung bauen', moduleTitle: 'Umweltüberwachung I',
    moduleIds: ['LRN:SSF:NOX-ENVIRONMENT-MONITORING', 'ENG-L1-000007'] },
  { unlock: 'UNL:NOX:habitat-redundancy', label: 'Systemredundanz bauen', moduleTitle: 'Systemredundanz I',
    moduleIds: ['LRN:SSF:NOX-HABITAT-REDUNDANCY', 'ENG-L1-000008'] },
  { unlock: 'UNL:NOX:mars-habitat', label: 'Mars-Habitat bauen', moduleTitle: 'Mars-Habitat I',
    moduleIds: ['LRN:SSF:NOX-MARS-HABITAT', 'ENG-L1-000009'] },

  // Navigation
  { unlock: 'UNL:NOX:NAV:ORBITAL', label: 'Orbitale Navigation', moduleTitle: 'Das Sonnensystem',
    moduleIds: ['LRN:SSF:AST-L1-000001', 'AST-L1-000001', 'PATH:SSF:AST-SONNENSYSTEM-0001'] },
]

const BY_UNLOCK = new Map(LEARNING_CATALOG.map(entry => [entry.unlock, entry]))

export function catalogEntryForUnlock(unlockId: string): LearningCatalogEntry | null {
  return BY_UNLOCK.get(unlockId) ?? null
}

/** Alle bekannten Kennungen der Module, die diese Freischaltung lehren. */
export function moduleIdsForUnlock(unlockId: string): readonly string[] {
  return BY_UNLOCK.get(unlockId)?.moduleIds ?? []
}

/** Freischaltungen, die NOXIA einem Modul (irgendeine seiner Kennungen) zuordnet. */
export function unlocksForModule(...moduleIds: Array<string | null | undefined>): string[] {
  const ids = new Set(moduleIds.filter((id): id is string => Boolean(id)))
  if (ids.size === 0) return []
  return LEARNING_CATALOG.filter(entry => entry.moduleIds.some(id => ids.has(id))).map(entry => entry.unlock)
}

/** Alle Kennungen, unter denen ein Abschluss desselben Moduls gespeichert sein kann. */
export function equivalentModuleIds(moduleId: string): string[] {
  const out = new Set<string>([moduleId])
  for (const entry of LEARNING_CATALOG) {
    if (entry.moduleIds.includes(moduleId)) entry.moduleIds.forEach(id => out.add(id))
  }
  return [...out]
}

type ModuleLike = { id: string; legacyId?: string | null; pathId?: string | null; unlocks?: ReadonlyArray<unknown> }

function unlockKey(u: unknown): string | null {
  if (typeof u === 'string') return u
  if (u && typeof u === 'object' && typeof (u as { key?: unknown }).key === 'string') return (u as { key: string }).key
  return null
}

/** Trägt ein Modul (laut SSF oder laut NOXIA-Verzeichnis) diese Freischaltung? */
export function moduleTeachesUnlock(module: ModuleLike, unlockId: string): boolean {
  if (Array.isArray(module.unlocks) && module.unlocks.some(u => unlockKey(u) === unlockId)) return true
  const known = moduleIdsForUnlock(unlockId)
  return [module.id, module.legacyId, module.pathId].some(id => typeof id === 'string' && known.includes(id))
}

/** Freischaltungen eines Moduls: SSF-Angaben plus NOXIA-Verzeichnis, ohne Doppelte. */
export function effectiveModuleUnlocks(module: ModuleLike): string[] {
  const fromSsf = (Array.isArray(module.unlocks) ? module.unlocks : []).map(unlockKey).filter((u): u is string => Boolean(u))
  return [...new Set([...fromSsf, ...unlocksForModule(module.id, module.legacyId, module.pathId)])]
}

/** Lesbarer Name einer Freischaltung: NOXIA-Register zuerst, dann Lernverzeichnis. */
export function unlockDisplayLabel(unlockId: string): string {
  return getUnlockDefinition(unlockId)?.label ?? BY_UNLOCK.get(unlockId)?.label ?? unlockId
}

/** Nur NOXIA-Freischaltungen (UNL:NOX:…), die das Spiel tatsächlich als Voraussetzung kennt. */
export function isGameRequirementUnlock(unlockId: string): boolean {
  return Boolean(getUnlockDefinition(unlockId) || BY_UNLOCK.has(unlockId))
}
