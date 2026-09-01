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
}
