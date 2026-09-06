// lib/game/seeds/tharsisHubEngineeringPolicy.ts
// Erstellt: 02.09.2026
// OTA Engineering Release + Klärung 2026-09-06.

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
 * Energie-Zahlen sind kanonische OTA/NOXIA-Architekturannahmen des Weltmodells,
 * keine empirischen [R]-Messwerte. Reale Technikreferenzen können die
 * Plausibilitätsbasis liefern, aber nicht diese konkreten Leistungswerte.
 */
export const THARSIS_ENERGY_ARCHITECTURE = {
  epistemicStatus: 'world-model-assumption' as const,
  installedNominalPowerMw: { min: 7, max: 8 },
  criticalContinuousPowerMw: { min: 1.5, max: 2.5 },
  normalMeanPowerMw: { min: 3, max: 5 },
  peakPowerMw: { min: 5, max: 8 },
  storageMWh: { min: 6, max: 10 },
  empiricalClaim: false,
} as const

/**
 * Pflanzenmodul: NICHT Teil des verpflichtenden Startbestands. Es ist ein
 * Phase-I-Ausbau zur Stärkung der Frischproduktion. Der Startzustand kennt nur
 * den vorbereiteten Standort und vorgesehene Medienanschlüsse; das Gebäude
 * selbst darf im Start-Seed nicht existieren.
 */
export const THARSIS_PLANT_MODULE_POLICY = {
  buildingId: 'plant_module',
  startupPresence: 'prepared-site-only' as const,
  buildPhase: 'phase-I' as const,
  preparedSite: { row: 12, col: 16, zone: 'A' as const },
  plannedMedia: ['power', 'data', 'water'] as const,
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
  if (plant) {
    issues.push({ message: 'Pflanzenmodul ist fälschlich bereits als gebautes Startobjekt vorhanden' })
  }
  if (THARSIS_PLANT_MODULE_POLICY.startupPresence !== 'prepared-site-only') {
    issues.push({ message: 'Pflanzenmodul muss im Startzustand auf vorbereiteten Standort beschränkt bleiben' })
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

  if (THARSIS_ENERGY_ARCHITECTURE.empiricalClaim) {
    issues.push({ message: 'Tharsis-Energiearchitektur darf nicht als empirischer [R]-Messwert markiert sein' })
  }

  if (THARSIS_PROCESS_GAS_POLICY.requiresIdenticalDualRing) {
    issues.push({ message: 'Prozessgas darf nicht pauschal als identischer A/B-Vollring erzwungen werden' })
  }
  if (THARSIS_PROCESS_GAS_POLICY.mayCreateSingleFailureColonyLifeSupportDependency) {
    issues.push({ message: 'Prozessgas darf keinen einzelnen Colony-Life-Support-Ausfallpunkt erzeugen' })
  }

  return issues
}
