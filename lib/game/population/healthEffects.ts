import type { PersonHealthState } from './health'

export type HealthAffectingEvent =
  | { eventType: 'workplace_accident'; severity: number }
  | { eventType: 'environmental_exposure'; severity: number }
  | { eventType: 'exhaustion'; severity: number }

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

const CONDITION: Record<HealthAffectingEvent['eventType'], string> = {
  workplace_accident: 'minor_injury',
  environmental_exposure: 'environmental_exposure',
  exhaustion: 'exhaustion',
}

/**
 * Pure deterministic projection from an explicit simulation event into health.
 * No random illness is generated here: without a causal event, health is unchanged.
 */
export function projectHealthEffect(
  current: PersonHealthState,
  event: HealthAffectingEvent,
  tick: number,
): PersonHealthState {
  const severity = clamp01(event.severity)
  const wellbeingLoss = event.eventType === 'workplace_accident'
    ? severity * 0.45
    : event.eventType === 'environmental_exposure'
      ? severity * 0.35
      : severity * 0.3
  const nextSeverity = Math.max(current.severity, severity)

  return {
    ...current,
    wellbeing: clamp01(current.wellbeing - wellbeingLoss),
    conditionCode: CONDITION[event.eventType],
    severity: nextSeverity,
    requiresMedicalCare: nextSeverity >= 0.35 || current.wellbeing - wellbeingLoss <= 0.55,
    updatedTick: tick,
  }
}
