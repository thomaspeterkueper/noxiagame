// lib/game/seeds/tharsisHubResilience.ts
// Erstellt: 02.09.2026
// OTA-Freigabe 2026-09-01: Safe Haven + ECLSS 2-von-3 für Tharsis Hub.

import { THARSIS_HUB_BUILDINGS, THARSIS_HUB_POPULATION } from './tharsisHubSeed'

export interface SafeHavenNode {
  id: string
  kind: 'habitat_cluster' | 'emergency_annex'
  evacuationCapacity: number
}

/**
 * Evakuierungskapazität ist ausdrücklich keine permanente Wohnkapazität.
 * 6 Habitatcluster besitzen lokale Storm-Shelter-Funktion; der Medical Annex
 * ergänzt als unabhängige Mehrzweck-/Notfallreserve.
 *
 * 7 × 14 = 98 Plätze; bei Verlust eines beliebigen Habitatclusters verbleiben
 * exakt 84 Plätze außerhalb des ausgefallenen Clusters.
 */
export const THARSIS_SAFE_HAVEN_NODES: SafeHavenNode[] = [
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `habitat_cluster_${index + 1}`,
    kind: 'habitat_cluster' as const,
    evacuationCapacity: 14,
  })),
  { id: 'medical_annex', kind: 'emergency_annex', evacuationCapacity: 14 },
]

export const THARSIS_REQUIRED_EVACUATION_CAPACITY = 84

export function availableEvacuationCapacity(failedNodeId?: string): number {
  return THARSIS_SAFE_HAVEN_NODES
    .filter(node => node.id !== failedNodeId)
    .reduce((sum, node) => sum + node.evacuationCapacity, 0)
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

  for (const node of THARSIS_SAFE_HAVEN_NODES) {
    if (!buildingIds.has(node.id)) {
      issues.push({ message: `Safe-Haven-Knoten '${node.id}' existiert nicht im Start-Seed` })
    }
    if (node.evacuationCapacity <= 0) {
      issues.push({ message: `Safe-Haven-Knoten '${node.id}' besitzt keine Evakuierungskapazität` })
    }
  }

  const habitatNodes = THARSIS_SAFE_HAVEN_NODES.filter(node => node.kind === 'habitat_cluster')
  if (habitatNodes.length !== 6) {
    issues.push({ message: `Lokale Habitat-Safe-Havens: ${habitatNodes.length} statt 6` })
  }

  for (const habitat of habitatNodes) {
    const remaining = availableEvacuationCapacity(habitat.id)
    if (remaining < THARSIS_REQUIRED_EVACUATION_CAPACITY) {
      issues.push({
        message: `Ausfall ${habitat.id}: nur ${remaining} Evakuierungsplätze statt mindestens ${THARSIS_REQUIRED_EVACUATION_CAPACITY}`,
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
