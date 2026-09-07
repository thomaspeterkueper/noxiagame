// lib/game/seeds/tharsisHubResilience.ts
// Erstellt: 02.09.2026
// OTA-Klärung 2026-09-06: Safe Haven = temporäre Überbelegung der fünf
// verbleibenden Habitatcluster; kein separater 84-Plätze-Reservepool.

import {
  HABITAT_CLUSTER_CAPACITY,
  THARSIS_HUB_BUILDINGS,
  THARSIS_HUB_POPULATION,
} from './tharsisHubSeed'

export interface SafeHavenNode {
  id: string
  kind: 'habitat_cluster'
  nominalCapacity: number
  temporaryEmergencyCapacity: number
}

/**
 * Jeder der sechs Habitatcluster besitzt lokale Safe-Haven-/Storm-Shelter-
 * Funktion. Fällt ein Cluster vollständig aus, werden seine Bewohner auf die
 * fünf verbleibenden Cluster verteilt. Diese dürfen dafür vorübergehend auf
 * 100 Personen je Cluster überbelegt werden.
 *
 * Das ist ausdrücklich KEINE zusätzliche dauerhafte Wohn- oder Annex-Reserve:
 * nominal bleiben es 6 × 84 = 504 Plätze; im Einzelausfall stehen in den fünf
 * verbleibenden Clustern temporär 5 × 100 = 500 Plätze zur Verfügung.
 */
export const THARSIS_SAFE_HAVEN_NODES: SafeHavenNode[] = Array.from(
  { length: 6 },
  (_, index) => ({
    id: `habitat_cluster_${index + 1}`,
    kind: 'habitat_cluster' as const,
    nominalCapacity: HABITAT_CLUSTER_CAPACITY,
    temporaryEmergencyCapacity: 100,
  }),
)

export const THARSIS_REQUIRED_SURVIVING_CLUSTER_COUNT = 5
export const THARSIS_TEMPORARY_CAPACITY_PER_SURVIVING_CLUSTER = 100
export const THARSIS_REQUIRED_EVACUATION_CAPACITY =
  THARSIS_REQUIRED_SURVIVING_CLUSTER_COUNT * THARSIS_TEMPORARY_CAPACITY_PER_SURVIVING_CLUSTER

export function availableEvacuationCapacity(failedNodeId?: string): number {
  return THARSIS_SAFE_HAVEN_NODES
    .filter(node => node.id !== failedNodeId)
    .reduce((sum, node) => sum + node.temporaryEmergencyCapacity, 0)
}

export interface EclssRegionalNode {
  id: string
  criticalDemandShare: number
}

/**
 * OTA-Freigabe: jeder regionale Knoten soll 55–60 % des kolonieweiten
 * kritischen Bedarfs tragen können. 56 % liefert bei beliebigem Einzelausfall
 * 112 % rechnerische Restkapazität für den degradierten Betrieb.
 */
export const THARSIS_ECLSS_REGIONAL_NODES: EclssRegionalNode[] = [
  { id: 'eclss_hub_1', criticalDemandShare: 0.56 },
  { id: 'eclss_hub_2', criticalDemandShare: 0.56 },
  { id: 'eclss_hub_3', criticalDemandShare: 0.56 },
]

export const THARSIS_ECLSS_LOCAL_CLUSTER_CAPABILITIES = [
  'pressure-control',
  'air-circulation',
  'environment-sensing',
  'isolation',
  'short-term-island-operation',
] as const

export function degradedEclssCapacity(failedNodeId: string): number {
  return THARSIS_ECLSS_REGIONAL_NODES
    .filter(node => node.id !== failedNodeId)
    .reduce((sum, node) => sum + node.criticalDemandShare, 0)
}

export interface TharsisResilienceIssue { message: string }

export function validateTharsisLifeSupportResilience(): TharsisResilienceIssue[] {
  const issues: TharsisResilienceIssue[] = []
  const buildingIds = new Set(THARSIS_HUB_BUILDINGS.map(building => building.id))

  const habitatNodes = THARSIS_SAFE_HAVEN_NODES
  if (habitatNodes.length !== 6) {
    issues.push({ message: `Lokale Habitat-Safe-Havens: ${habitatNodes.length} statt 6` })
  }

  for (const node of habitatNodes) {
    if (!buildingIds.has(node.id)) {
      issues.push({ message: `Safe-Haven-Habitat '${node.id}' existiert nicht im Start-Seed` })
    }
    if (node.nominalCapacity !== HABITAT_CLUSTER_CAPACITY) {
      issues.push({ message: `${node.id}: nominal ${node.nominalCapacity} statt ${HABITAT_CLUSTER_CAPACITY} Plätze` })
    }
    if (node.temporaryEmergencyCapacity !== THARSIS_TEMPORARY_CAPACITY_PER_SURVIVING_CLUSTER) {
      issues.push({
        message: `${node.id}: temporär ${node.temporaryEmergencyCapacity} statt ${THARSIS_TEMPORARY_CAPACITY_PER_SURVIVING_CLUSTER} Plätze`,
      })
    }

    const remainingNodes = habitatNodes.filter(candidate => candidate.id !== node.id)
    if (remainingNodes.length !== THARSIS_REQUIRED_SURVIVING_CLUSTER_COUNT) {
      issues.push({
        message: `Ausfall ${node.id}: ${remainingNodes.length} verbleibende Cluster statt ${THARSIS_REQUIRED_SURVIVING_CLUSTER_COUNT}`,
      })
    }
    const remaining = availableEvacuationCapacity(node.id)
    if (remaining < THARSIS_REQUIRED_EVACUATION_CAPACITY) {
      issues.push({
        message: `Ausfall ${node.id}: nur ${remaining} temporäre Plätze statt mindestens ${THARSIS_REQUIRED_EVACUATION_CAPACITY}`,
      })
    }
    if (remaining < THARSIS_HUB_POPULATION) {
      issues.push({
        message: `Ausfall ${node.id}: temporäre Safe-Haven-Kapazität ${remaining} reicht nicht für ${THARSIS_HUB_POPULATION} Bewohner`,
      })
    }
  }

  for (const node of THARSIS_ECLSS_REGIONAL_NODES) {
    if (!buildingIds.has(node.id)) {
      issues.push({ message: `Regionaler ECLSS-Knoten '${node.id}' existiert nicht im Start-Seed` })
    }
    if (node.criticalDemandShare < 0.55 || node.criticalDemandShare > 0.60) {
      issues.push({ message: `${node.id}: ${Math.round(node.criticalDemandShare * 100)} % statt 55–60 % kritischer Bedarf` })
    }
    const remaining = degradedEclssCapacity(node.id)
    if (remaining < 1) {
      issues.push({ message: `Ausfall ${node.id}: nur ${(remaining * 100).toFixed(0)} % kritische ECLSS-Restkapazität` })
    }
  }

  if (THARSIS_HUB_POPULATION !== 497) {
    issues.push({ message: `ECLSS-Auslegung referenziert ${THARSIS_HUB_POPULATION} statt 497 Bewohner` })
  }

  return issues
}
