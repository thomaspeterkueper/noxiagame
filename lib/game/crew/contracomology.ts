// lib/game/crew/contracomology.ts
// Erstellt: 31.08.2026 — NOXIA-Spielwirkung der freigegebenen Contracomology-Domain
//
// KG ist Source of Truth fuer die Wissensidentitaet KD:KON:N1.
// NOXIA ist Source of Truth fuer diese Spielwirkung und ihr Balancing.
// Eine SSF-Path-ID wird hier absichtlich noch nicht fest verdrahtet.

export const CONTRACOMOLOGY_KG_DOMAIN = 'KD:KON:N1' as const

export const CONTRACOMOLOGY_REFERENCES = [
  'CON:L1:zeitform',
  'CON:L1:avi-punkt',
  'CON:L1:oem',
  'CON:L1:paradigma-1',
  'CON:L1:paradigma-2',
  'CON:L1:paradigma-3',
] as const

export type LongMissionContext = {
  durationDays: number
  communicationDelayMinutes: number
  communicationBlackoutHours: number
  culturalDiversity: number // 0..1
  isolation: number // 0..1
}

export type ContracomologyCrewEffect = {
  active: boolean
  stressResistance: number
  conflictDetection: number
  culturalOrientation: number
  autonomy: number
  reasons: string[]
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

/**
 * Conservative first balancing model.
 * Contracomology does not create a generic morale bonus. It becomes useful
 * specifically where crews must orient themselves under long duration,
 * delayed/absent communication, isolation and heterogeneous interpretations.
 */
export function evaluateContracomologyCrewEffect(
  context: LongMissionContext,
  hasCompetency: boolean,
): ContracomologyCrewEffect {
  if (!hasCompetency) {
    return { active: false, stressResistance: 0, conflictDetection: 0, culturalOrientation: 0, autonomy: 0, reasons: [] }
  }

  const duration = clamp01(context.durationDays / 540)
  const delay = clamp01(context.communicationDelayMinutes / 22)
  const blackout = clamp01(context.communicationBlackoutHours / 72)
  const diversity = clamp01(context.culturalDiversity)
  const isolation = clamp01(context.isolation)

  const reasons: string[] = []
  if (duration >= 0.25) reasons.push('Langzeitmission')
  if (delay >= 0.25) reasons.push('Kommunikationsverzoegerung')
  if (blackout >= 0.25) reasons.push('Kommunikationsstille')
  if (diversity >= 0.4) reasons.push('kulturell heterogene Crew')
  if (isolation >= 0.4) reasons.push('hohe Isolation')

  return {
    active: reasons.length > 0,
    // Effects deliberately stay modest: competency mitigates situational risk,
    // it never replaces engineering, leadership or psychological support.
    stressResistance: Number((0.08 * duration * isolation).toFixed(3)),
    conflictDetection: Number((0.10 * diversity * Math.max(delay, blackout)).toFixed(3)),
    culturalOrientation: Number((0.12 * diversity * Math.max(duration, isolation)).toFixed(3)),
    autonomy: Number((0.08 * Math.max(delay, blackout) * duration).toFixed(3)),
    reasons,
  }
}
