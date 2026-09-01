// Canonical technical provenance for NOXIA building classes.
// KG owns shared identities/relations; OTA owns technical dossiers;
// NOXIA owns gameplay values and runtime state.

export type TechnicalMappingRole = 'implements' | 'specializes' | 'references'

export interface BuildingTechnicalProvenance {
  sourceSystem: 'OTA'
  sourceDocumentId: `DOC:OTA:${string}`
  canonicalId: string
  sharedObjectId?: `BLD:NOX:${string}`
  mappingRole: TechnicalMappingRole
  evidenceImpactPolicy: 'signal-only'
  secondarySourceDocumentIds?: `DOC:OTA:${string}`[]
}

const ota = (
  signature: string,
  mappingRole: TechnicalMappingRole,
  sharedObjectId?: `BLD:NOX:${string}`,
  secondarySourceDocumentIds?: `DOC:OTA:${string}`[],
): BuildingTechnicalProvenance => ({
  sourceSystem: 'OTA',
  sourceDocumentId: `DOC:OTA:${signature}`,
  canonicalId: signature,
  sharedObjectId,
  mappingRole,
  evidenceImpactPolicy: 'signal-only',
  secondarySourceDocumentIds,
})

export const BUILDING_TECHNICAL_PROVENANCE: Readonly<Record<string, BuildingTechnicalProvenance>> = {
  // Generic building classes resolved by KG-NOX-20260901-BUILDING-OBJECT-IDENTITIES.
  mine: ota('OTA-TEC-0108-2026-DE', 'implements', 'BLD:NOX:mine-1'),
  solar: ota('OTA-TEC-0109-2026-DE', 'implements', 'BLD:NOX:solarfeld-1'),
  laboratory: ota('OTA-TEC-0110-2026-DE', 'references'),
  scanner: ota('OTA-TEC-0111-2026-DE', 'implements', 'BLD:NOX:scanner-1'),

  // Explicitly relation-based generalizations: these are not identity equivalences.
  ice_drill: ota(
    'OTA-TEC-0108-2026-DE',
    'specializes',
    undefined,
    ['DOC:OTA:OTA-TEC-0095-2026-DE'],
  ),
  habitat: ota('OTA-TEC-0097-2026-DE', 'references', 'BLD:NOX:mars-habitat-1'),
  residential_block: ota('OTA-TEC-0097-2026-DE', 'references'),
  factory: ota('OTA-TEC-0101-2026-DE', 'references'),
  smelter: ota('OTA-TEC-0107-2026-DE', 'specializes', 'BLD:NOX:schmelze-1'),

  // Existing safe generic/system references.
  water_recycler: {
    sourceSystem: 'OTA',
    sourceDocumentId: 'DOC:OTA:OTA-TEC-0034-2026-DE',
    canonicalId: 'OTA-TEC-0034-WEX-M',
    mappingRole: 'implements',
    evidenceImpactPolicy: 'signal-only',
  },
  road: ota('OTA-TEC-0104-2026-DE', 'references'),
  warehouse: ota('OTA-TEC-0102-2026-DE', 'references'),
  oxygen_recycler: ota('OTA-TEC-0096-2026-DE', 'references'),

  // Tharsis Hub start objects. A NOXIA seed object implements/references the OTA
  // system dossier; it is never identical to the OTA document identity.
  habitat_cluster: ota('OTA-TEC-0097-2026-DE', 'implements'),
  eclss_hub: ota('OTA-TEC-0096-2026-DE', 'implements'),
  reactor_module: ota('OTA-TEC-0094-2026-DE', 'implements'),
  black_start: ota('OTA-TEC-0094-2026-DE', 'references'),
  water_isru: ota('OTA-TEC-0095-2026-DE', 'implements'),
  radiator_field: ota('OTA-TEC-0098-2026-DE', 'implements'),
  medical_core: ota('OTA-TEC-0099-2026-DE', 'implements'),
  medical_annex: ota('OTA-TEC-0099-2026-DE', 'references'),
  reserve_depot: ota('OTA-TEC-0100-2026-DE', 'references'),
  plant_module: ota('OTA-TEC-0100-2026-DE', 'references'),
  logistics_hub: ota('OTA-TEC-0102-2026-DE', 'implements'),
  workshop_clean: ota('OTA-TEC-0101-2026-DE', 'implements'),
  workshop_heavy: ota('OTA-TEC-0101-2026-DE', 'implements'),
  material_complex: ota('OTA-TEC-0107-2026-DE', 'implements'),
  command_node: ota('OTA-TEC-0106-2026-DE', 'implements'),
  surface_relay: ota('OTA-TEC-0106-2026-DE', 'references'),
  longrange_comms: ota('OTA-TEC-0106-2026-DE', 'references'),
  landing_pad: ota(
    'OTA-TEC-0102-2026-DE',
    'references',
    undefined,
    ['DOC:OTA:OTA-TEC-0104-2026-DE'],
  ),
}

export const getBuildingTechnicalProvenance = (
  buildingId: string,
): BuildingTechnicalProvenance | undefined => BUILDING_TECHNICAL_PROVENANCE[buildingId]
