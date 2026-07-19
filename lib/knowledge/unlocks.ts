// lib/knowledge/unlocks.ts
// Erstellt:     19.07.2026
// Aktualisiert: 19.07.2026 — Schritt 4: Feature-Gates für player_unlocks
// Version:      1.0.0
//
// Lädt player_unlocks aus der DB und prüft Feature-Gates.
// Verwendet von: BankOverlay, ColonyGrid, SchoolOverlay

import { createServiceClient } from '@/lib/supabase/service'

// ── Alle Unlocks eines Spielers laden ────────────────────────────────────────
export async function getPlayerUnlocks(profileId: string): Promise<string[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('player_unlocks')
    .select('unlock_id')
    .eq('profile_id', profileId)
  return (data ?? []).map((u: any) => u.unlock_id as string)
}

// ── Feature-Gate Checks ───────────────────────────────────────────────────────
export function hasUnlock(unlocks: string[], unlockId: string): boolean {
  return unlocks.includes(unlockId)
}

// Bank-Kredit freigeschalten?
export function canAccessBankCredit(unlocks: string[]): boolean {
  return hasUnlock(unlocks, 'UNL:NOX:bank-credit')
}

// Zinseszins-Vorschau freigeschalten?
export function canAccessBankCompound(unlocks: string[]): boolean {
  return hasUnlock(unlocks, 'UNL:NOX:bank-compound')
}

// Spektral-Sensor freigeschalten?
export function canUseSpectralSensor(unlocks: string[]): boolean {
  return hasUnlock(unlocks, 'UNL:NOX:SENSOR:SPECTRAL')
}

// Orbitale Navigation freigeschalten?
export function canUseOrbitalNav(unlocks: string[]): boolean {
  return hasUnlock(unlocks, 'UNL:NOX:NAV:ORBITAL')
}

// Beobachtungsdeck-Mission freigeschalten?
export function canStartObservationDeck(unlocks: string[]): boolean {
  return hasUnlock(unlocks, 'UNL:NOX:MISSION:OBSERVATION-DECK')
}

// Alle Gate-Checks als Objekt (für Client-seitige Nutzung)
export function getFeatureGates(unlocks: string[]) {
  return {
    bankCredit:        canAccessBankCredit(unlocks),
    bankCompound:      canAccessBankCompound(unlocks),
    spectralSensor:    canUseSpectralSensor(unlocks),
    orbitalNav:        canUseOrbitalNav(unlocks),
    observationDeck:   canStartObservationDeck(unlocks),
    // Wasser-Physik
    phaseAnalysis:     hasUnlock(unlocks, 'UNL:NOX:PHY:PHASE-DIAGRAM'),
    surfaceTension:    hasUnlock(unlocks, 'UNL:NOX:PHY:SURFACE-TENSION'),
    // Chemie
    waterChemistry:    hasUnlock(unlocks, 'UNL:NOX:CHEM:WATER-MOLECULE'),
    solubility:        hasUnlock(unlocks, 'UNL:NOX:CHEM:SOLUBILITY'),
    // Navigation
    curvature:         hasUnlock(unlocks, 'UNL:NOX:NAV:CURVATURE'),
  }
}
