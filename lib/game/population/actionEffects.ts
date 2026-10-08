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

export function needDelta(action: PopulationAction, needCode: string): number {
  if (action === 'work') return needCode === 'rest' ? -0.05 : needCode === 'sustenance' ? -0.025 : needCode === 'purpose' ? 0.04 : needCode === 'social' ? 0.01 : 0
  if (action === 'rest') return needCode === 'rest' ? 0.12 : needCode === 'sustenance' ? -0.015 : needCode === 'purpose' ? -0.01 : 0
  if (action === 'satisfy_basic_need') return needCode === 'sustenance' ? 0.16 : needCode === 'safety' ? 0.05 : 0
  if (action === 'social_interaction') return needCode === 'social' ? 0.12 : needCode === 'rest' || needCode === 'sustenance' ? -0.01 : 0
  if (action === 'seek_medical_care') return needCode === 'rest' || needCode === 'sustenance' ? -0.01 : 0
  if (action === 'inspect_problem' || action === 'report_problem') return needCode === 'rest' ? -0.03 : needCode === 'sustenance' ? -0.015 : needCode === 'purpose' ? 0.05 : 0
  if (action === 'travel_home' || action === 'travel_work') return needCode === 'rest' ? -0.015 : needCode === 'sustenance' ? -0.01 : 0
  return 0
}
