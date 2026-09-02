// lib/game/technicalCoverageRequests.ts
// NOXIA-owned outbound handoff registry for technical coverage gaps.
export type TechnicalCoverageHandoff={targetSystem:'OTA'|'KG'|'SSF';targetRepository:string;taskPath:string;requestedAt:string}
const OTA_REPO='thomaspeterkueper/overtime-archive.org'
const SHIP_OTA_HANDOFF:TechnicalCoverageHandoff={targetSystem:'OTA',targetRepository:OTA_REPO,taskPath:'external-tasks/open/EXT-NOX-OTA-20260831-ship-object-dossiers.md',requestedAt:'2026-08-31'}
const BUILDING_OTA_HANDOFF:TechnicalCoverageHandoff={targetSystem:'OTA',targetRepository:OTA_REPO,taskPath:'external-tasks/open/EXT-NOX-OTA-20260901-building-object-coverage.md',requestedAt:'2026-09-01'}
const STATION_OTA_HANDOFF:TechnicalCoverageHandoff={targetSystem:'OTA',targetRepository:OTA_REPO,taskPath:'external-tasks/open/EXT-NOX-OTA-20260901-station-module-coverage.md',requestedAt:'2026-09-01'}
export const TECHNICAL_COVERAGE_HANDOFFS:Readonly<Record<string,TechnicalCoverageHandoff>>={
 'ship_frame:mk1':SHIP_OTA_HANDOFF,'ship_frame:fast':SHIP_OTA_HANDOFF,'ship_frame:heavy':SHIP_OTA_HANDOFF,'ship_frame:scout':SHIP_OTA_HANDOFF,'ship_frame:pioneer':SHIP_OTA_HANDOFF,
 'ship_module:cargo':SHIP_OTA_HANDOFF,'ship_module:tank':SHIP_OTA_HANDOFF,'ship_module:habitat_pod':SHIP_OTA_HANDOFF,'ship_module:scanner':SHIP_OTA_HANDOFF,'ship_module:drive_booster':SHIP_OTA_HANDOFF,'ship_module:deep_scanner':SHIP_OTA_HANDOFF,'ship_module:survey_drone':SHIP_OTA_HANDOFF,'ship_module:construction_rig':SHIP_OTA_HANDOFF,'ship_module:colony_pod':SHIP_OTA_HANDOFF,
 ...Object.fromEntries(['mine','solar','factory','laboratory','ice_drill','habitat','residential_block','road','school','bank','scanner','warehouse','admin','smelter','bar','oxygen_recycler','habitat_cluster','eclss_hub','reactor_module','black_start','water_isru','radiator_field','medical_core','medical_annex','reserve_depot','plant_module','logistics_hub','workshop_clean','workshop_heavy','material_complex','command_node','surface_relay','longrange_comms','landing_pad'].map(id=>[`building:${id}`,BUILDING_OTA_HANDOFF])),
 ...Object.fromEntries(['command_center','solar_array','docking_bay','habitat_module','research_lab','water_recycler','storage_bay','observatory','reactor'].map(id=>[`station_module:${id}`,STATION_OTA_HANDOFF])),
}
