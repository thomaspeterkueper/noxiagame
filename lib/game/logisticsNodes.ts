// lib/game/logisticsNodes.ts
// NOXIA-owned semantic boundary between gameplay location slugs and physical missions.

import type { SurfacePortRole } from './transportDomains'

export type CanonicalLogisticsNodeId = 'earth' | 'moon' | 'mars' | 'phobos' | 'deimos' | 'prometheus'

export type LogisticsDomainMeaning =
  | 'aggregated-logistics-domain'
  | 'surface-domain'
  | 'orbital-station'

export type TransferEndpointKind =
  | 'orbital-interface'
  | 'node-itself'

export type SurfaceAccessMode = 'transfer-shuttle' | 'none'

export interface LogisticsNodeSemantics {
  id: CanonicalLogisticsNodeId
  transferEndpoint: TransferEndpointKind
  domainMeaning: LogisticsDomainMeaning
  surfaceLegSeparate: boolean
  surfaceAccessMode: SurfaceAccessMode
  surfacePortRole: SurfacePortRole | null
  celestialBodySlug: 'earth' | 'moon' | 'mars' | 'phobos' | 'deimos'
  note: string
}

export const LOGISTICS_NODES: Record<CanonicalLogisticsNodeId, LogisticsNodeSemantics> = {
  earth: {
    id: 'earth',
    domainMeaning: 'aggregated-logistics-domain',
    transferEndpoint: 'orbital-interface',
    surfaceLegSeparate: true,
    surfaceAccessMode: 'transfer-shuttle',
    surfacePortRole: 'shuttle-port',
    celestialBodySlug: 'earth',
    note: 'Earth spans surface infrastructure and its orbital interface. Intersolar transfer terminates at the orbital interface; an ASCE-class transfer shuttle or equivalent serves the surface Raumhafen.',
  },
  moon: {
    id: 'moon',
    domainMeaning: 'surface-domain',
    transferEndpoint: 'orbital-interface',
    surfaceLegSeparate: true,
    surfaceAccessMode: 'transfer-shuttle',
    surfacePortRole: 'shuttle-port',
    celestialBodySlug: 'moon',
    note: 'The gameplay node represents the Shackleton surface colony. Intersolar/inter-node craft use a lunar orbital interface; transfer shuttles connect it to the surface Raumhafen.',
  },
  mars: {
    id: 'mars',
    domainMeaning: 'surface-domain',
    transferEndpoint: 'orbital-interface',
    surfaceLegSeparate: true,
    surfaceAccessMode: 'transfer-shuttle',
    surfacePortRole: 'shuttle-port',
    celestialBodySlug: 'mars',
    note: 'The gameplay node represents the Tharsis surface colony. Intersolar craft remain at the Mars orbital interface; atmospheric entry/ascent and landing are handled by transfer shuttles.',
  },
  phobos: {
    id: 'phobos',
    domainMeaning: 'orbital-station',
    transferEndpoint: 'node-itself',
    surfaceLegSeparate: false,
    surfaceAccessMode: 'none',
    surfacePortRole: null,
    celestialBodySlug: 'phobos',
    note: 'Phobos is the station/free-port logistics endpoint associated with the Phobos moon; arrival completes the intersolar/inter-node leg and no planetary surface shuttle leg is implied.',
  },
  deimos: {
    id: 'deimos',
    domainMeaning: 'orbital-station',
    transferEndpoint: 'node-itself',
    surfaceLegSeparate: false,
    surfaceAccessMode: 'none',
    surfacePortRole: null,
    celestialBodySlug: 'deimos',
    note: 'Deimos ist die kleine Forschungsstation/Anlegestelle selbst; Ankunft schliesst die Reise ab, kein separater Oberflaechen-Shuttle-Leg noetig.',
  },
  prometheus: {
    id: 'prometheus',
    domainMeaning: 'orbital-station',
    transferEndpoint: 'node-itself',
    surfaceLegSeparate: false,
    surfaceAccessMode: 'none',
    surfacePortRole: null,
    celestialBodySlug: 'earth',
    note: 'Prometheus is the Earth-associated L5 habitat/transfer station itself; arrival at the node completes the transfer and no planetary surface leg follows.',
  },
}

export function getLogisticsNodeSemantics(id: string): LogisticsNodeSemantics | null {
  return id in LOGISTICS_NODES
    ? LOGISTICS_NODES[id as CanonicalLogisticsNodeId]
    : null
}

export function requiresSeparateSurfaceLeg(id: string): boolean {
  return getLogisticsNodeSemantics(id)?.surfaceLegSeparate ?? false
}

export function usesTransferShuttleToSurface(id: string): boolean {
  return getLogisticsNodeSemantics(id)?.surfaceAccessMode === 'transfer-shuttle'
}
