// lib/game/seeds/tharsisHubEngineeringPolicy.ts
// Erstellt: 02.09.2026
// OTA Engineering Release: mediumspezifische Redundanz + Pflanzenmodul-Grenze.

import { THARSIS_HUB_BUILDINGS } from './tharsisHubSeed'

export interface TharsisEngineeringIssue { message: string }

/**
 * Abwasser: keine künstliche A/B-Vollring-Symmetrie. Jeder Habitatcluster
 * besitzt lokale Pufferung und mindestens zwei unabhängige Weiterleitungs-/
 * Verarbeitungsziele.
 */
export const THARSIS_WASTEWATER_POLICY = {
  collectionMode: 'segmented' as const,
  localBuffering: true,
  processingTargets: ['material_complex_1', 'material_complex_2'] as const,
  requiresIdenticalDualRing: false,
}

/**
 * Thermik: fünf Radiatorfelder auf zwei isolierbaren Hauptkreisen. Kritische
 * Verbraucher müssen beide Wärmeabfuhrpfade erreichen können; die beiden
 * Kreise sind fachlich unabhängig von den Utility-Backbones A/B.
 */
export const THARSIS_THERMAL_POLICY = {
  circuits: ['thermal_circuit_A', 'thermal_circuit_B'] as const,
  minimumRadiatorFields: 5,
  requiresTwoIsolatablePathsForCriticalConsumers: true,
  separateHabitatAndProcessLoops: true,
}

/**
 * Prozessgase werden nach Kritikalität/Gefahr behandelt statt pauschal
 * dualisiert. Sauerstoff ist bereits separat als echtes A/B-Dualmedium
 * modelliert; diese Regel betrifft nur sonstige Prozessgase.
 */
export const THARSIS_PROCESS_GAS_POLICY = {
  mode: 'hazard-and-criticality-class' as const,
  requiresIdenticalDualRing: false,
  mayCreateSingleFailureColonyLifeSupportDependency: false,
}

/**
 * Pflanzenmodul: Frischproduktion ist strategisch nützlich, aber wegen der
 * getrennten >=27-t-Lagerreserve nicht survival-critical. Wasser/Nährstoffe
 * laufen in einem hygienisch vom Trinkwasserkreislauf getrennten Prozessloop.
 */
export const THARSIS_PLANT_MODULE_POLICY = {
  buildingId: 'plant_module',
  survivalCritical: false,
  potableWaterLoopShared: false,
  processLoopId: 'plant_water_nutrient_loop_1',
  minimumStrategicStoredFoodT: 27,
} as const

const CRITICAL_THERMAL_ENTITY_IDS = new Set([
  'habitat_cluster',
  'eclss_hub',
  'medical_core',
  'medical_annex',
  'command_node',
  'water_isru',
  'reactor_module',
])

export function validateTharsisEngineeringPolicy(): TharsisEngineeringIssue[] {
  const issues: TharsisEngineeringIssue[] = []
  const buildingIds = new Set(THARSIS_HUB_BUILDINGS.map(building => building.id))

  if (THARSIS_WASTEWATER_POLICY.processingTargets.length < 2) {
    issues.push({ message: 'Abwasser benötigt mindestens zwei Verarbeitungs-/Umleitungsziele' })
  }
  for (const target of THARSIS_WASTEWATER_POLICY.processingTargets) {
    if (!buildingIds.has(target)) {
      issues.push({ message: `Abwasserziel '${target}' fehlt im Tharsis-Seed` })
    }
  }
  if (!THARSIS_WASTEWATER_POLICY.localBuffering) {
    issues.push({ message: 'Abwasser benötigt lokale Pufferung je Segment' })
  }

  const radiatorFields = THARSIS_HUB_BUILDINGS.filter(building => building.entityId === 'radiator_field')
  if (radiatorFields.length < THARSIS_THERMAL_POLICY.minimumRadiatorFields) {
    issues.push({ message: `Nur ${radiatorFields.length} Radiatorfelder statt mindestens ${THARSIS_THERMAL_POLICY.minimumRadiatorFields}` })
  }
  const thermalCircuits = new Set(radiatorFields.map(field => field.circuitId).filter(Boolean))
  for (const circuit of THARSIS_THERMAL_POLICY.circuits) {
    if (!thermalCircuits.has(circuit)) {
      issues.push({ message: `Thermischer Hauptkreis '${circuit}' besitzt kein Radiatorfeld` })
    }
  }

  const criticalThermalConsumers = THARSIS_HUB_BUILDINGS.filter(
    building => building.critical && CRITICAL_THERMAL_ENTITY_IDS.has(building.entityId),
  )
  if (criticalThermalConsumers.length === 0) {
    issues.push({ message: 'Keine kritischen thermischen Verbraucher im Start-Seed gefunden' })
  }

  const plant = THARSIS_HUB_BUILDINGS.find(building => building.id === THARSIS_PLANT_MODULE_POLICY.buildingId)
  if (!plant) {
    issues.push({ message: 'Pflanzenmodul fehlt im Start-Seed' })
  } else if (plant.critical !== THARSIS_PLANT_MODULE_POLICY.survivalCritical) {
    issues.push({ message: 'Pflanzenmodul ist fälschlich als survival-critical markiert' })
  }
  if (THARSIS_PLANT_MODULE_POLICY.potableWaterLoopShared) {
    issues.push({ message: 'Pflanzenmodul darf Trinkwasser- und Wasser/Nährstoff-Prozessloop nicht hygienisch koppeln' })
  }

  const foodReserveT = THARSIS_HUB_BUILDINGS
    .filter(building => building.entityId === 'reserve_depot')
    .reduce((sum, building) => sum + (building.foodReserveT ?? 0), 0)
  if (foodReserveT < THARSIS_PLANT_MODULE_POLICY.minimumStrategicStoredFoodT) {
    issues.push({ message: `Strategische Lagerreserve ${foodReserveT} t unter ${THARSIS_PLANT_MODULE_POLICY.minimumStrategicStoredFoodT} t` })
  }

  if (THARSIS_PROCESS_GAS_POLICY.requiresIdenticalDualRing) {
    issues.push({ message: 'Prozessgas darf nicht pauschal als identischer A/B-Vollring erzwungen werden' })
  }
  if (THARSIS_PROCESS_GAS_POLICY.mayCreateSingleFailureColonyLifeSupportDependency) {
    issues.push({ message: 'Prozessgas darf keinen einzelnen Colony-Life-Support-Ausfallpunkt erzeugen' })
  }

  return issues
}
