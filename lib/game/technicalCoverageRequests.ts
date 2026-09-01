// lib/game/technicalCoverageRequests.ts
// NOXIA-owned outbound handoff registry for technical coverage gaps.
//
// This registry records only that NOXIA requested external canonical/provenance
// work. It does NOT mirror the target repository's current task status and does
// not make NOXIA authoritative for OTA content.

export type TechnicalCoverageHandoff = {
  targetSystem: 'OTA' | 'KG' | 'SSF'
  targetRepository: string
  taskPath: string
  requestedAt: string
}

const SHIP_OTA_HANDOFF: TechnicalCoverageHandoff = {
  targetSystem: 'OTA',
  targetRepository: 'thomaspeterkueper/overtime-archive.org',
  taskPath: 'external-tasks/open/EXT-NOX-OTA-20260831-ship-object-dossiers.md',
  requestedAt: '2026-08-31',
}

const BUILDING_OTA_HANDOFF: TechnicalCoverageHandoff = {
  targetSystem: 'OTA',
  targetRepository: 'thomaspeterkueper/overtime-archive.org',
  taskPath: 'external-tasks/open/EXT-NOX-OTA-20260901-building-object-coverage.md',
  requestedAt: '2026-09-01',
}

// Keys use the same kind:localId identity as technicalCoverage.ts.
// Several local objects may intentionally point to one external requirement.
export const TECHNICAL_COVERAGE_HANDOFFS: Readonly<Record<string, TechnicalCoverageHandoff>> = {
  'ship_frame:mk1': SHIP_OTA_HANDOFF,
  'ship_frame:fast': SHIP_OTA_HANDOFF,
  'ship_frame:heavy': SHIP_OTA_HANDOFF,
  'ship_frame:scout': SHIP_OTA_HANDOFF,
  'ship_frame:pioneer': SHIP_OTA_HANDOFF,

  'ship_module:cargo': SHIP_OTA_HANDOFF,
  'ship_module:tank': SHIP_OTA_HANDOFF,
  'ship_module:habitat_pod': SHIP_OTA_HANDOFF,
  'ship_module:scanner': SHIP_OTA_HANDOFF,
  'ship_module:drive_booster': SHIP_OTA_HANDOFF,
  'ship_module:deep_scanner': SHIP_OTA_HANDOFF,
  'ship_module:survey_drone': SHIP_OTA_HANDOFF,
  'ship_module:construction_rig': SHIP_OTA_HANDOFF,
  'ship_module:colony_pod': SHIP_OTA_HANDOFF,

  'building:mine': BUILDING_OTA_HANDOFF,
  'building:solar': BUILDING_OTA_HANDOFF,
  'building:factory': BUILDING_OTA_HANDOFF,
  'building:laboratory': BUILDING_OTA_HANDOFF,
  'building:ice_drill': BUILDING_OTA_HANDOFF,
  'building:habitat': BUILDING_OTA_HANDOFF,
  'building:residential_block': BUILDING_OTA_HANDOFF,
  'building:road': BUILDING_OTA_HANDOFF,
  'building:school': BUILDING_OTA_HANDOFF,
  'building:bank': BUILDING_OTA_HANDOFF,
  'building:scanner': BUILDING_OTA_HANDOFF,
  'building:warehouse': BUILDING_OTA_HANDOFF,
  'building:admin': BUILDING_OTA_HANDOFF,
  'building:smelter': BUILDING_OTA_HANDOFF,
  'building:bar': BUILDING_OTA_HANDOFF,
  'building:oxygen_recycler': BUILDING_OTA_HANDOFF,
  'building:habitat_cluster': BUILDING_OTA_HANDOFF,
  'building:eclss_hub': BUILDING_OTA_HANDOFF,
  'building:reactor_module': BUILDING_OTA_HANDOFF,
  'building:black_start': BUILDING_OTA_HANDOFF,
  'building:water_isru': BUILDING_OTA_HANDOFF,
  'building:radiator_field': BUILDING_OTA_HANDOFF,
  'building:medical_core': BUILDING_OTA_HANDOFF,
  'building:medical_annex': BUILDING_OTA_HANDOFF,
  'building:reserve_depot': BUILDING_OTA_HANDOFF,
  'building:plant_module': BUILDING_OTA_HANDOFF,
  'building:logistics_hub': BUILDING_OTA_HANDOFF,
  'building:workshop_clean': BUILDING_OTA_HANDOFF,
  'building:workshop_heavy': BUILDING_OTA_HANDOFF,
  'building:material_complex': BUILDING_OTA_HANDOFF,
  'building:command_node': BUILDING_OTA_HANDOFF,
  'building:surface_relay': BUILDING_OTA_HANDOFF,
  'building:longrange_comms': BUILDING_OTA_HANDOFF,
  'building:landing_pad': BUILDING_OTA_HANDOFF,
}
