// lib/game/seeds/tharsisHubMigrationResolution.ts
// Erstellt: 06.09.2026
// Prüft die absichtliche Historie des Tharsis-Seeds:
//   1. historische Startmigration enthielt das Pflanzenmodul,
//   2. aktueller TS-Kanon enthält es nicht mehr,
//   3. Forward-Migration entfernt ausschließlich das alte STATE-Seedobjekt.

import { readFileSync } from 'node:fs'
import {
  SEED_OWNERSHIP,
  THARSIS_HUB_BUILDINGS,
  THARSIS_HUB_SEED_MIGRATION,
} from './tharsisHubSeed'
import { validateCounts } from './tharsisHubValidation'

export interface TharsisMigrationIssue { message: string }

export const THARSIS_HUB_SEED_REVIEW_MIGRATION =
  'supabase/migrations/20260906170000_tharsis_hub_seed_review_resolution.sql'

const HISTORICAL_MIGRATION_URL = new URL(`../../../${THARSIS_HUB_SEED_MIGRATION}`, import.meta.url)
const REVIEW_MIGRATION_URL = new URL(`../../../${THARSIS_HUB_SEED_REVIEW_MIGRATION}`, import.meta.url)

const LEGACY_PLANT_COUNT_ISSUE = 'Frischproduktions-Komplex: 0 statt 1'

/**
 * validateCounts() stammt aus dem ursprünglichen 2026-08-30-Vertrag und trägt
 * noch genau eine inzwischen aufgehobene Erwartung: ein gebautes plant_module.
 * Alle anderen Stückzahl-, Reserve-, Energie- und Thermikprüfungen bleiben
 * unverändert aktiv. Die Abweichung wird nur hier, zusammen mit der expliziten
 * Forward-Migrationsprüfung, aufgelöst und kann daher nicht still verschwinden.
 */
export function validateTharsisResolvedCounts(): TharsisMigrationIssue[] {
  return validateCounts().filter(issue => issue.message !== LEGACY_PLANT_COUNT_ISSUE)
}

function readMigration(url: URL, label: string, issues: TharsisMigrationIssue[]): string {
  try {
    return readFileSync(url, 'utf8')
  } catch {
    issues.push({ message: `${label} nicht lesbar: ${url.pathname}` })
    return ''
  }
}

function sectionText(migration: string, banner: string, nextBanner: string): string {
  const start = migration.indexOf(banner)
  if (start < 0) return ''
  const from = start + banner.length
  const end = migration.indexOf(nextBanner, from)
  return migration.slice(from, end < 0 ? migration.length : end)
}

export function validateTharsisMigrationResolution(): TharsisMigrationIssue[] {
  const issues: TharsisMigrationIssue[] = []
  const historical = readMigration(HISTORICAL_MIGRATION_URL, 'Historische Tharsis-Seed-Migration', issues)
  const review = readMigration(REVIEW_MIGRATION_URL, 'Tharsis-Forward-Migration', issues)

  if (!historical || !review) return issues

  const currentPlantCount = THARSIS_HUB_BUILDINGS.filter(b => b.entityId === 'plant_module').length
  if (currentPlantCount !== 0) {
    issues.push({ message: `Aktueller TS-Kanon enthält ${currentPlantCount} gebautes Pflanzenmodul statt 0` })
  }

  const legacyCountIssues = validateCounts().filter(issue => issue.message === LEGACY_PLANT_COUNT_ISSUE)
  if (legacyCountIssues.length !== 1) {
    issues.push({ message: `Legacy-Count-Annahme ist nicht mehr eindeutig (${legacyCountIssues.length} Treffer)` })
  }

  const historicalBuildings = sectionText(
    historical,
    '-- 6. Startobjekte — staatlich owned',
    '-- 7. Fahrzeug-Startbestand',
  )
  const historicalRows = historicalBuildings.match(
    /\(\s*'[a-z0-9_]+'\s*,\s*'[a-z0-9_]+'\s*,\s*\d+\s*,\s*\d+\s*\)/g,
  ) ?? []

  if (historicalRows.length !== THARSIS_HUB_BUILDINGS.length + 1) {
    issues.push({
      message: `Historische Gebäudeliste: ${historicalRows.length} Zeilen; erwartet aktueller Kanon + genau 1 Legacy-Objekt (${THARSIS_HUB_BUILDINGS.length + 1})`,
    })
  }

  if (!historicalBuildings.includes("('plant_module','plant_module',12,16)")) {
    issues.push({ message: 'Historische Migration dokumentiert das Legacy-Pflanzenmodul auf (12,16) nicht' })
  }

  const historicalUtilities = sectionText(
    historical,
    '-- 9b. Doppelte Medienanbindung',
    '-- 10. Personen-Zuordnungen',
  )
  for (const expected of ["('plant_module','A',11,14)", "('plant_module','B',16,8)"]) {
    if (!historicalUtilities.includes(expected)) {
      issues.push({ message: `Historische Migration enthält Legacy-Utility-Link ${expected} nicht` })
    }
  }

  const { ownerClass, isStateOwned, ownerId } = SEED_OWNERSHIP
  if (ownerClass !== 'STATE' || !isStateOwned || ownerId !== null) {
    issues.push({ message: 'Aktuelles Seed-Eigentumsmodell ist nicht STATE / is_state_owned=true / owner_id=NULL' })
  }

  const requiredForwardMarkers = [
    "tile_row = 12",
    "tile_col = 16",
    "entity_id = 'plant_module'",
    "owner_class = 'STATE'",
    'is_state_owned = true',
    'owner_id IS NULL',
    'DELETE FROM location_utilities',
    'DELETE FROM tile_entities',
  ]
  for (const marker of requiredForwardMarkers) {
    if (!review.includes(marker)) {
      issues.push({ message: `Forward-Migration fehlt Schutz-/Korrekturmarker: ${marker}` })
    }
  }

  const utilityDelete = review.indexOf('DELETE FROM location_utilities')
  const buildingDelete = review.indexOf('DELETE FROM tile_entities')
  if (utilityDelete < 0 || buildingDelete < 0 || utilityDelete > buildingDelete) {
    issues.push({ message: 'Forward-Migration muss Utility-Anbindungen vor dem Seed-Gebäude entfernen' })
  }

  if (review.includes('DELETE FROM building_definitions')) {
    issues.push({ message: 'Forward-Migration darf die weiterhin baubare plant_module-Baukatalogdefinition nicht löschen' })
  }

  return issues
}
