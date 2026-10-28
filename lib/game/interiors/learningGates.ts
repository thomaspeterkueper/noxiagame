// lib/game/interiors/learningGates.ts
// Lernschwellen der Gebäude (Thomas, 27.10.2026: „so wie es in der Bank schon
// existiert auch bei anderen Gebäuden Zugang zu Lernmodulen öffnen, damit man
// bestimmte Dinge überhaupt erst nutzen kann“).
//
// Jedes Gebäude nennt, welches Wissen es für welche Handlung verlangt oder wofür
// es hilft – und öffnet das Lernmodul gleich im Raum (WalkableInterior).
// Quelle der Zuordnung ist der Wissenskatalog des Spiels (lib/knowledge/data.ts:
// learningModules → knowledgeUnlocks → knowledgeBuildings) und die SSF-Pfade
// (lib/knowledge/ssfPaths.ts). Erfunden wird nichts: Gibt SSF für eine
// Freischaltung noch kein Modul her, sagt das Gebäude das.
//
// `need`:
//   'required' – das Spiel prüft es serverseitig; ohne geht die Handlung nicht.
//   'helps'    – das Wissen wirkt (z. B. Navigationsgüte) oder ist im Katalog
//                dem Gebäude zugeordnet, aber noch nicht als Sperre gebaut.
// Reine Regeln, keine Datenbank.

import { moduleIdsForUnlock, moduleTeachesUnlock } from '../../knowledge/learningCatalog'

export type LearningNeed = 'required' | 'helps'

export interface LearningGate {
  id: string
  /** Was man damit hier tun kann – „Kredit aufnehmen“. */
  label: string
  /** Freischaltung (player_unlocks.unlock_id). */
  unlock: string
  /** Modulkennungen, deren Abschluss zählt (academy_completions.module_id). */
  moduleIds: readonly string[]
  /** Titel des Lernmoduls laut Wissenskatalog. */
  moduleTitle: string
  need: LearningNeed
  /** Ein Satz, warum – so, wie das Personal es sagen würde. */
  why: string
}

export interface LearningProgress {
  unlocks: readonly string[]
  completedModules: readonly string[]
}

const CREDIT: LearningGate = {
  id: 'bank-credit', label: 'Kredit aufnehmen', unlock: 'UNL:NOX:bank-credit',
  moduleIds: moduleIdsForUnlock('UNL:NOX:bank-credit'), moduleTitle: 'Was ist Kredit?', need: 'required',
  why: 'Ohne den Nachweis „Was ist Kredit?“ vergibt die Bank keinen Kredit',
}

export const BUILDING_LEARNING_GATES: Readonly<Record<string, readonly LearningGate[]>> = {
  bank: [
    CREDIT,
    {
      id: 'bank-collateral', label: 'Sicherheiten verstehen', unlock: 'UNL:NOX:bank-collateral',
      moduleIds: moduleIdsForUnlock('UNL:NOX:bank-collateral'), moduleTitle: 'Was ist ein Sicherheitenwert?', need: 'helps',
      why: 'Wie viel Kredit möglich ist, hängt am Wert der Sicherheiten',
    },
    {
      id: 'bank-compound', label: 'Zinseszins verstehen', unlock: 'UNL:NOX:bank-compound',
      moduleIds: moduleIdsForUnlock('UNL:NOX:bank-compound'), moduleTitle: 'Was ist Zinseszins?', need: 'helps',
      why: 'Zinsen laufen je Tick weiter – auf Guthaben wie auf Schulden',
    },
  ],
  warehouse: [
    {
      id: 'advanced-trading', label: 'Erweiterter Handel', unlock: 'UNL:NOX:advanced-trading',
      moduleIds: moduleIdsForUnlock('UNL:NOX:advanced-trading'), moduleTitle: 'Was ist Arbitrage?', need: 'helps',
      why: 'Wer Preisunterschiede zwischen Orten versteht, handelt mit Gewinn',
    },
  ],
  administration: [
    {
      id: 'land-value', label: 'Bodenwert verstehen', unlock: 'UNL:NOX:land-value',
      moduleIds: moduleIdsForUnlock('UNL:NOX:land-value'), moduleTitle: 'Was ist Bodenwert?', need: 'helps',
      why: 'Bodenwert und Grundsteuer bestimmen, was ein Haus kostet und einbringt',
    },
  ],
  spaceport: [
    {
      id: 'nav-orbital', label: 'Orbitale Navigation', unlock: 'UNL:NOX:NAV:ORBITAL',
      moduleIds: moduleIdsForUnlock('UNL:NOX:NAV:ORBITAL'), moduleTitle: 'Das Sonnensystem', need: 'helps',
      why: 'Wer Umlaufbahnen versteht, navigiert genauer; die Flugkontrolle rechnet damit',
    },
    {
      id: 'nav-curvature', label: 'Bahnkrümmung', unlock: 'UNL:NOX:NAV:CURVATURE',
      moduleIds: [], moduleTitle: 'Krümmung und Bahnen', need: 'helps',
      why: 'Bahnkrümmung verbessert die Navigation weiter',
    },
  ],
}

export function learningGatesFor(kind: string): readonly LearningGate[] {
  return BUILDING_LEARNING_GATES[kind] ?? []
}

/** Offen, wenn die Freischaltung vorliegt oder eines der Module abgeschlossen ist. */
export function gateOpen(gate: LearningGate, progress: LearningProgress | null): boolean {
  if (!progress) return false
  return progress.unlocks.includes(gate.unlock) || gate.moduleIds.some(id => progress.completedModules.includes(id))
}

export interface LearningGateStatus {
  gate: LearningGate
  open: boolean
  /** Lernmodul, das SSF für diese Freischaltung liefert; null = noch keins. */
  moduleId: string | null
}

type GateModule = { id: string; legacyId?: string | null; pathId?: string | null; unlocks?: readonly string[] }

/**
 * Ein Modul aus der SSF-Liste: SSF-Kennung, Legacy-ID oder Freischaltung muss
 * passen. Die SSF liefert z. B. „LRN:SSF:ECO-L0-000001“ mit Legacy-ID
 * „ECO-L0-000001“ – beides zählt (28.10.2026).
 */
export function moduleForGate(gate: LearningGate, modules: ReadonlyArray<GateModule>): string | null {
  const byId = modules.find(m => [m.id, m.legacyId, m.pathId].some(id => typeof id === 'string' && gate.moduleIds.includes(id)))
  if (byId) return byId.id
  const byUnlock = modules.find(m => moduleTeachesUnlock(m, gate.unlock))
  return byUnlock?.id ?? null
}

export function gateStatuses(kind: string, progress: LearningProgress | null, modules: ReadonlyArray<GateModule>): LearningGateStatus[] {
  return learningGatesFor(kind).map(gate => ({ gate, open: gateOpen(gate, progress), moduleId: moduleForGate(gate, modules) }))
}

/**
 * Was das Personal über die Lernschwellen des Hauses weiß. Allgemein (welches Wissen
 * wofür) immer; den Stand des Gegenübers nur, wenn es ihn kennen kann (`aboutCustomer`).
 */
export function learningGateFacts(statuses: readonly LearningGateStatus[], aboutCustomer: boolean): string[] {
  if (statuses.length === 0) return []
  const facts: string[] = []
  const required = statuses.filter(s => s.gate.need === 'required')
  const helps = statuses.filter(s => s.gate.need === 'helps')
  if (required.length) facts.push('Hier nur mit Nachweis: ' + required.map(s => `${s.gate.label} (Modul „${s.gate.moduleTitle}“)`).join('; '))
  if (helps.length) facts.push('Hilfreiches Wissen hier: ' + helps.map(s => `„${s.gate.moduleTitle}“`).join(', '))
  if (statuses.some(s => s.moduleId)) facts.push('Die Lernmodule kann man gleich hier im Haus durcharbeiten')
  if (aboutCustomer) {
    const missing = statuses.filter(s => !s.open)
    const done = statuses.filter(s => s.open)
    if (done.length) facts.push('Dein Gegenüber hat schon: ' + done.map(s => `„${s.gate.moduleTitle}“`).join(', '))
    if (missing.length) facts.push('Deinem Gegenüber fehlt noch: ' + missing.map(s => `„${s.gate.moduleTitle}“`).join(', '))
  }
  return facts.map(f => f.length > 140 ? f.slice(0, 139) + '…' : f)
}

/** Aus dem, was der Motor geladen hat (GateView), wieder Schwellen mit Stand machen. */
export function statusesFromViews(kind: string, views: ReadonlyArray<{ id: string; open: boolean; moduleId: string | null }>): LearningGateStatus[] {
  return learningGatesFor(kind).map(gate => {
    const view = views.find(v => v.id === gate.id)
    return { gate, open: view?.open ?? false, moduleId: view?.moduleId ?? null }
  })
}
