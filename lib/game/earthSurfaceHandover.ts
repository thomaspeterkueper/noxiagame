// lib/game/earthSurfaceHandover.ts
// Earth-owned interpretation of the common Core logistics nodes as a planetary
// surface transfer chain.
//
// Core owns inventories, kinds, jobs and persistence. This module only classifies
// the inventory rows Core already returns and derives the surface handover chain
// that the Earth UX has to show. It never creates, mutates or persists anything,
// and it never re-labels a Core node as a different physical node kind.

import { SURFACE_TRANSFER_CRAFT } from './transportDomains'

/** Physical role of a Core inventory inside the Earth surface chain. */
export type EarthSurfaceNodeRole =
  | 'facility'
  | 'depot'
  | 'spaceport-storage'
  | 'surface-port'
  | 'vehicle'
  | 'location'
  | 'other'

/**
 * Structural subset of a Core `logistics_inventories` row. Field names stay
 * snake_case on purpose: this is the shared Core payload, not an Earth shape.
 */
export interface EarthSurfaceInventoryNodeInput {
  id: string
  label: string
  inventory_kind: string
  storage_kind?: string | null
  subject_type?: string | null
  subject_id?: string | null
  active?: boolean | null
  metadata?: Record<string, unknown> | null
}

export interface EarthSurfaceHandoverNode {
  id: string
  label: string
  role: EarthSurfaceNodeRole
  /** Core `metadata.role`, e.g. `extraction`, `spaceport_storage`, `shuttle_port`. */
  purpose: string | null
  buildingType: string | null
}

export interface EarthSurfaceHandoverChain {
  facilities: EarthSurfaceHandoverNode[]
  depots: EarthSurfaceHandoverNode[]
  spaceportStorage: EarthSurfaceHandoverNode[]
  surfacePorts: EarthSurfaceHandoverNode[]
}

export type EarthSpaceportHandoverState =
  | 'ready'
  | 'storage-missing'
  | 'surface-port-missing'

export interface EarthSpaceportHandoverAssessment {
  state: EarthSpaceportHandoverState
  storage: EarthSurfaceHandoverNode | null
  surfacePorts: EarthSurfaceHandoverNode[]
  /** Earth's chain deliberately stops at the surface port: the shuttle leg is not Earth's. */
  boundary: 'surface-port'
  shuttle: { craftId: string; name: string; note: string } | null
  note: string
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Map a Core inventory row onto the Earth surface chain. Unknown kinds stay
 * `other`; nothing is guessed from labels or names.
 */
export function classifyEarthSurfaceNode(node: EarthSurfaceInventoryNodeInput): EarthSurfaceNodeRole {
  switch (node.inventory_kind) {
    case 'facility': return 'facility'
    case 'surface_port': return 'surface-port'
    case 'vehicle': return 'vehicle'
    case 'location': return 'location'
    case 'depot': return metadataString(node.metadata, 'role') === 'spaceport_storage' ? 'spaceport-storage' : 'depot'
    default: return 'other'
  }
}

export function describeEarthSurfaceInventory(node: EarthSurfaceInventoryNodeInput): EarthSurfaceHandoverNode {
  return {
    id: node.id,
    label: node.label,
    role: classifyEarthSurfaceNode(node),
    purpose: metadataString(node.metadata, 'role'),
    buildingType: metadataString(node.metadata, 'buildingType'),
  }
}

function isUsable(node: EarthSurfaceInventoryNodeInput) {
  return node.active !== false && typeof node.id === 'string' && node.id.length > 0
}

/**
 * Group the Core inventories Earth already sees into the surface chain:
 * production/processing facilities, depots, the spaceport warehouse and the
 * shuttle pads. Aggregated `location` inventories carry no physical chain role.
 */
export function buildEarthSurfaceHandoverChain(
  nodes: readonly EarthSurfaceInventoryNodeInput[],
): EarthSurfaceHandoverChain {
  const chain: EarthSurfaceHandoverChain = { facilities: [], depots: [], spaceportStorage: [], surfacePorts: [] }
  for (const node of nodes) {
    if (!isUsable(node)) continue
    const described = describeEarthSurfaceInventory(node)
    switch (described.role) {
      case 'facility': chain.facilities.push(described); break
      case 'depot': chain.depots.push(described); break
      case 'spaceport-storage': chain.spaceportStorage.push(described); break
      case 'surface-port': chain.surfacePorts.push(described); break
      default: break
    }
  }
  return chain
}

/**
 * Assess whether the Earth side of the spaceport chain is complete. The chain is
 * `facility → surface vehicle → spaceport warehouse → shuttle handover`; Earth
 * ends at the surface port and never claims the orbital or intersolar leg.
 */
export function assessEarthSpaceportHandover(
  nodes: readonly EarthSurfaceInventoryNodeInput[],
): EarthSpaceportHandoverAssessment {
  const chain = buildEarthSurfaceHandoverChain(nodes)
  const storage = chain.spaceportStorage[0] ?? null
  const craft = SURFACE_TRANSFER_CRAFT['asce-0.3p'] ?? null
  const shuttle = craft ? { craftId: craft.id, name: craft.name, note: craft.note } : null

  if (!storage) {
    return {
      state: 'storage-missing',
      storage: null,
      surfacePorts: chain.surfacePorts,
      boundary: 'surface-port',
      shuttle,
      note: 'Ohne Raumhafenlager fehlt der Umschlagknoten zwischen Surface-Transport und Shuttle-Handover.',
    }
  }
  if (!chain.surfacePorts.length) {
    return {
      state: 'surface-port-missing',
      storage,
      surfacePorts: [],
      boundary: 'surface-port',
      shuttle,
      note: 'Das Raumhafenlager ist vorhanden, aber es gibt keinen Shuttle-Pad als Oberflächen-Handover.',
    }
  }
  return {
    state: 'ready',
    storage,
    surfacePorts: chain.surfacePorts,
    boundary: 'surface-port',
    shuttle,
    note: 'Surface-Kette vollständig: Waren erreichen das Raumhafenlager und werden dort an den Shuttle übergeben.',
  }
}
