// lib/game/population/bodyHealthBridge.ts
// NOXIA-LIVING-0006 — bridge from explicit health events to the physical body.
//
// population/healthEffects.ts speaks in event types; cognition/personBody.ts
// speaks in tissue insults and systemic stress. This is the only place that
// translates between the two, so the mapping stays reviewable in one file.

import { applyBodyInsult, type BodyRegion, type PersonBodyState } from '../cognition/personBody'
import type { HealthAffectingEvent } from './healthEffects'

const clamp01 = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0

// Hands and arms first: most workplace injuries are to the upper limbs.
const ACCIDENT_REGIONS: readonly BodyRegion[] = [
  'right_hand', 'left_hand', 'right_arm', 'left_arm',
  'right_leg', 'left_leg', 'right_foot', 'left_foot', 'torso', 'head',
]

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** The event does not say where it hurt. The region is derived from its id: stable on replay, not random. */
export function accidentRegion(sourceEventId: string): BodyRegion {
  return ACCIDENT_REGIONS[hash(sourceEventId) % ACCIDENT_REGIONS.length]
}

/**
 * Pure projection of one health event onto the body.
 *
 * - workplace_accident     → mechanical tissue injury at a deterministic region
 * - exhaustion             → fatigue (systemic, no injury, no nociception)
 * - environmental_exposure → core temperature stress (systemic)
 *
 * `sourceEventId` is the injury id, so replaying the same event deepens the
 * same injury rather than creating a second one.
 */
export function applyHealthEventToBody(
  body: PersonBodyState,
  event: HealthAffectingEvent,
  sourceEventId: string,
): PersonBodyState {
  const severity = clamp01(event.severity)
  switch (event.eventType) {
    case 'workplace_accident':
      return applyBodyInsult(body, {
        id: sourceEventId,
        kind: 'mechanical',
        region: accidentRegion(sourceEventId),
        tissue: severity >= 0.75 ? 'bone' : severity >= 0.4 ? 'muscle' : 'skin',
        intensity: severity,
        duration: 1,
      })
    case 'exhaustion':
      return { ...body, fatigue: Math.max(clamp01(body.fatigue), severity) }
    case 'environmental_exposure':
      return { ...body, coreTemperatureStress: Math.max(clamp01(body.coreTemperatureStress), severity) }
  }
}
