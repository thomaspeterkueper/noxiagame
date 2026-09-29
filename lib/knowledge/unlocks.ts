// lib/knowledge/unlocks.ts
// Erstellt:     19.07.2026
// Aktualisiert: 2026-09-29 — Robotikfertigung und Präzisionsinstrumentierung
// Version:      1.2.0
//
// Lädt player_unlocks aus der DB und prüft Feature-Gates.
// Verwendet von: BankOverlay, ColonyGrid, SchoolOverlay, Robotikfertigung

import { createServiceClient } from '@/lib/supabase/service'

export const ROBOT_FABRICATION_UNLOCK = 'UNL:NOX:ENG:ROBOT-FABRICATION'
export const PRECISION_INSTRUMENTATION_UNLOCK = 'UNL:NOX:ENG:PRECISION-INSTRUMENTATION'

export async function getPlayerUnlocks(profileId: string): Promise<string[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('player_unlocks')
    .select('unlock_id')
    .eq('profile_id', profileId)
  return (data ?? []).map((u: any) => u.unlock_id as string)
}

export function hasUnlock(unlocks: string[], unlockId: string): boolean {
  return unlocks.includes(unlockId)
}

export function canAccessBankCredit(unlocks: string[]): boolean { return hasUnlock(unlocks, 'UNL:NOX:bank-credit') }
export function canAccessBankCompound(unlocks: string[]): boolean { return hasUnlock(unlocks, 'UNL:NOX:bank-compound') }
export function canUseSpectralSensor(unlocks: string[]): boolean { return hasUnlock(unlocks, 'UNL:NOX:SENSOR:SPECTRAL') }
export function canUseOrbitalNav(unlocks: string[]): boolean { return hasUnlock(unlocks, 'UNL:NOX:NAV:ORBITAL') }
export function canStartObservationDeck(unlocks: string[]): boolean { return hasUnlock(unlocks, 'UNL:NOX:MISSION:OBSERVATION-DECK') }
export function canFoundColony(unlocks: string[]): boolean { return hasUnlock(unlocks, 'UNL:NOX:COLONY:FOUND') }
export function canFoundStation(unlocks: string[]): boolean { return hasUnlock(unlocks, 'UNL:NOX:STATION:FOUND') }
export function canBuildScout(unlocks: string[]): boolean { return hasUnlock(unlocks, 'UNL:NOX:SHIP:SCOUT') }
export function canBuildPioneer(unlocks: string[]): boolean { return hasUnlock(unlocks, 'UNL:NOX:SHIP:PIONEER') }

// SSF/KG capability gates. These helpers never grant knowledge; they only read persisted player_unlocks.
export function canFabricateRobotModules(unlocks: string[]): boolean { return hasUnlock(unlocks, ROBOT_FABRICATION_UNLOCK) }
export function canFabricatePrecisionInstruments(unlocks: string[]): boolean { return hasUnlock(unlocks, PRECISION_INSTRUMENTATION_UNLOCK) }

export function getFeatureGates(unlocks: string[]) {
  return {
    bankCredit: canAccessBankCredit(unlocks),
    bankCompound: canAccessBankCompound(unlocks),
    spectralSensor: canUseSpectralSensor(unlocks),
    orbitalNav: canUseOrbitalNav(unlocks),
    observationDeck: canStartObservationDeck(unlocks),
    robotFabrication: canFabricateRobotModules(unlocks),
    precisionInstrumentation: canFabricatePrecisionInstruments(unlocks),
    phaseAnalysis: hasUnlock(unlocks, 'UNL:NOX:PHY:PHASE-DIAGRAM'),
    surfaceTension: hasUnlock(unlocks, 'UNL:NOX:PHY:SURFACE-TENSION'),
    waterChemistry: hasUnlock(unlocks, 'UNL:NOX:CHEM:WATER-MOLECULE'),
    solubility: hasUnlock(unlocks, 'UNL:NOX:CHEM:SOLUBILITY'),
    curvature: hasUnlock(unlocks, 'UNL:NOX:NAV:CURVATURE'),
  }
}
