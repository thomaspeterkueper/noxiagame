// lib/knowledge/navigationProficiency.ts
// Version 0.1.0 — pure navigation-knowledge -> transfer proficiency mapping
//
// This module is intentionally DB-free so server execution and client previews
// can use the exact same rule. The server remains authoritative because only
// persisted player_unlocks are used when a flight is started.

const NAVIGATION_UNLOCK_WEIGHTS: Record<string, number> = {
  // SSF: PATH:SSF:AST-SONNENSYSTEM-0001
  'UNL:NOX:NAV:ORBITAL': 0.35,
  // Existing advanced navigation gate. Represents curvature/trajectory insight.
  'UNL:NOX:NAV:CURVATURE': 0.20,
}

export const MAX_CURRENT_NAVIGATION_PROFICIENCY = 0.55

export function navigationProficiencyFromUnlocks(unlocks: readonly string[]): number {
  const uniqueUnlocks = new Set(unlocks)
  let proficiency = 0

  for (const [unlockId, weight] of Object.entries(NAVIGATION_UNLOCK_WEIGHTS)) {
    if (uniqueUnlocks.has(unlockId)) proficiency += weight
  }

  return Math.min(1, Math.max(0, proficiency))
}

export function navigationKnowledgeLabel(proficiency: number): string {
  if (proficiency >= 0.5) return 'fortgeschritten'
  if (proficiency >= 0.3) return 'orbital geschult'
  return 'Grundnavigation'
}
