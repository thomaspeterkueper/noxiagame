// lib/game/population/actionEffects.ts
// Pure per-tick effects of a population action. Shared by the persistence
// engine and the in-memory research runner so both advance needs identically.

import type { PersonActivityState, PopulationAction } from './types'

export function activityForAction(action: PopulationAction): PersonActivityState {
  if (action === 'work') return 'working'
  if (action === 'rest') return 'resting'
  if (action === 'travel_home' || action === 'travel_work') return 'travelling'
  if (action === 'social_interaction') return 'socialising'
  if (action === 'seek_medical_care') return 'travelling'
  if (action === 'inspect_problem' || action === 'report_problem') return 'inspecting'
  return 'idle'
}

/** Conditions at the person's location that change what an action yields. */
export interface NeedEnvironment {
  /** 0..1 supply of the settlement with food, water and air. 1 = fully supplied. */
  supply?: number
  /** Level below which this person's need for variety does not sink by itself (see `varietyFloor`). */
  varietyFloor?: number
}

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * How content a person is with routine. Homebodies settle at about 0.5 and never
 * get restless; novelty seekers sink to about 0.1 and eventually want to move on.
 * Uses the trait `novelty_seeking` (0..1) when present, else a stable value per person.
 */
export function varietyFloor(personId: string, traits?: Record<string, unknown> | null): number {
  const seeking = typeof traits?.novelty_seeking === 'number' && Number.isFinite(traits.novelty_seeking)
    ? Math.max(0, Math.min(1, Number(traits.novelty_seeking)))
    : (hash(`novelty:${personId}`) % 101) / 100
  return 0.5 - 0.4 * seeking
}

const clampUnit = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback

/**
 * Effect of one action on one need. NOXIA-LIVING-0009: under scarcity a meal
 * restores less. A visit brings variety only through whom one meets there.
 */
export function needDelta(action: PopulationAction, needCode: string, environment: NeedEnvironment = {}): number {
  if (action === 'satisfy_basic_need' && needCode === 'sustenance') return 0.16 * clampUnit(environment.supply, 1)
  return baseNeedDelta(action, needCode)
}

/**
 * What happens to a need every hour regardless of the action (NOXIA-LIVING-0009):
 * contact and variety wear off, and a badly supplied settlement feels unsafe.
 */
export function passiveNeedDrift(needCode: string, environment: NeedEnvironment = {}, current = 1): number {
  if (needCode === 'social') return -0.012
  if (needCode === 'variety') {
    // Routine wears variety down to the person's floor, not further.
    const floor = clampUnit(environment.varietyFloor, 0.3)
    return Math.min(0, Math.max(-0.002, floor - current))
  }
  if (needCode === 'safety') {
    const supply = clampUnit(environment.supply, 1)
    return supply < 0.5 ? -0.04 * (0.5 - supply) : 0
  }
  return 0
}

/**
 * Effect of meeting someone (qualities from cognition/personAffect.encounterQualities).
 * Someone close answers the need for contact; someone new answers the need for
 * variety. The daily meeting with a well-known colleague gives little of either.
 */
export function encounterNeedDelta(needCode: string, qualities: { novelty: number; closeness: number }): number {
  if (needCode === 'social') return 0.01 + 0.2 * clampUnit(qualities.closeness, 0)
  // Someone you know well is not news, however long you have not seen them.
  if (needCode === 'variety') return 0.25 * Math.max(0, clampUnit(qualities.novelty, 0) - 0.2) / 0.8
  return 0
}

/** A new home or workplace is a strong change of scene. */
export const RELOCATION_VARIETY_GAIN = 0.6

function baseNeedDelta(action: PopulationAction, needCode: string): number {
  if (action === 'work') return needCode === 'rest' ? -0.05 : needCode === 'sustenance' ? -0.025 : needCode === 'purpose' ? 0.04 : needCode === 'social' ? 0.01 : 0
  if (action === 'rest') return needCode === 'rest' ? 0.12 : needCode === 'sustenance' ? -0.015 : needCode === 'purpose' ? -0.01 : 0
  if (action === 'satisfy_basic_need') return needCode === 'sustenance' ? 0.16 : needCode === 'safety' ? 0.05 : 0
  if (action === 'social_interaction') return needCode === 'social' ? 0.12 : needCode === 'rest' || needCode === 'sustenance' ? -0.01 : 0
  if (action === 'seek_medical_care') return needCode === 'rest' || needCode === 'sustenance' ? -0.01 : 0
  if (action === 'inspect_problem' || action === 'report_problem') return needCode === 'rest' ? -0.03 : needCode === 'sustenance' ? -0.015 : needCode === 'purpose' ? 0.05 : 0
  if (action === 'travel_home' || action === 'travel_work') return needCode === 'rest' ? -0.015 : needCode === 'sustenance' ? -0.01 : 0
  return 0
}
