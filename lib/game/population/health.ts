import type { PopulationAction } from './types'

export interface PersonHealthState {
  personId: string
  wellbeing: number
  conditionCode: string | null
  severity: number
  requiresMedicalCare: boolean
  updatedTick: number | null
}

export interface MedicalCareDecision {
  action: Extract<PopulationAction, 'seek_medical_care'>
  score: number
  factors: Record<string, number | string | boolean>
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** Deterministic health decision; no diagnosis is invented by the decision layer. */
export function decideMedicalCare(health: PersonHealthState): MedicalCareDecision | null {
  const severity = clamp01(health.severity)
  const wellbeingPressure = 1 - clamp01(health.wellbeing)
  if (!health.requiresMedicalCare && severity < 0.35 && wellbeingPressure < 0.45) return null
  const score = Math.min(1, 0.35 + severity * 0.45 + wellbeingPressure * 0.35)
  return {
    action: 'seek_medical_care',
    score: Math.round(score * 1_000_000) / 1_000_000,
    factors: {
      severity,
      wellbeingPressure,
      requiresMedicalCare: health.requiresMedicalCare,
      conditionCode: health.conditionCode ?? '',
    },
  }
}
