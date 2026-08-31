// lib/game/explorationAssets.ts
// Erstellt: 31.08.2026 — lokale Objektklasse fuer Rover und Explorationsdrohnen
//
// NOXIA bleibt Source of Truth fuer Spielwerte und Instanzzustand.
// OTA-Provenienz ist read-only Metadatenbindung. Evidence-Updates duerfen
// Hinweise erzeugen, aber niemals automatisch Balancingwerte mutieren.

export type ExplorationAssetKind = 'surface_rover' | 'exploration_drone'

export type ExplorationAssetProvenance = {
  sourceSystem: 'OTA'
  sourceDocumentId: string
  canonicalId: string
  objectId: string
  mappingRole: 'buildable'
  evidenceImpactPolicy: 'signal-only'
}

export type ExplorationAssetType = {
  id: string
  name: string
  kind: ExplorationAssetKind
  description: string
  provenance: ExplorationAssetProvenance
}

export type ExplorationAssetStatus = 'inactive' | 'ready' | 'deployed' | 'damaged' | 'lost'

/**
 * Lebende NOXIA-Instanz. Typdaten und Instanzdaten bleiben strikt getrennt.
 * Insbesondere VEX-Lain-Eigenschaften duerfen nicht in VEX-47-Typdaten
 * zurueckgeschrieben oder auf andere Instanzen vererbt werden.
 */
export type ExplorationAssetInstance = {
  id: string
  typeId: string
  ownerId: string | null
  locationId: string | null
  status: ExplorationAssetStatus
  condition: number
  instanceCanonicalId?: string | null
  modifications: Record<string, unknown>
  emergentState: Record<string, unknown>
}

export const EXPLORATION_ASSET_TYPES: Record<string, ExplorationAssetType> = {
  rover_p: {
    id: 'rover_p',
    name: 'Erkundungsrover Typ P',
    kind: 'surface_rover',
    description: 'Bodengebundenes Erkundungsasset fuer planetare Oberflaechen.',
    provenance: {
      sourceSystem: 'OTA',
      sourceDocumentId: 'DOC:OTA:OTA-TEC-0036-2026-DE',
      canonicalId: 'OTA-TEC-0036-ROV-P',
      objectId: 'erkundungsrover-mond-typ-p',
      mappingRole: 'buildable',
      evidenceImpactPolicy: 'signal-only',
    },
  },
  vex_47: {
    id: 'vex_47',
    name: 'VEX-47 Explorationsdrohne',
    kind: 'exploration_drone',
    description: 'Autonome Explorationsdrohne; Basistyp getrennt von individuellen Einheiten.',
    provenance: {
      sourceSystem: 'OTA',
      sourceDocumentId: 'DOC:OTA:OTA-TEC-0037-2026-DE',
      canonicalId: 'OTA-TEC-0037-VEX-47',
      objectId: 'vex-47-explorationsdrohne-basistyp',
      mappingRole: 'buildable',
      evidenceImpactPolicy: 'signal-only',
    },
  },
}

/** Dokumentierte kanonische Einzelinstanz; keine Typdefaults. */
export const VEX_LAIN_INSTANCE_ANCHOR = {
  typeId: 'vex_47',
  instanceCanonicalId: 'OTA-TEC-0037-INST-01',
  externalObjectId: 'vex-lain-einheit-01',
} as const

export function getExplorationAssetType(id: string) {
  return EXPLORATION_ASSET_TYPES[id] ?? null
}
