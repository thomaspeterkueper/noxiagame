// lib/game/logisticsNodes.ts
// NOXIA-owned semantic boundary between gameplay location slugs and physical missions.
//
// A location slug is not automatically the exact endpoint of an intersolar burn.
// Planetary/lunar surface operations are intentionally separable from the deep-space
// transfer so intersolar ships never implicitly become landers.

import type { SurfacePortRole } from './transportDomains'

export type CanonicalLogisticsNodeId = 'earth' | 'moon' | 'mars' | 'phobos' | 'prometheus'

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
  domainMeaning: LogisticsDomainMeaning
  /** Endpoint of the intersolar/inter-node leg, never an implicit planetary landing. */
  transferEndpoint: TransferEndpointKind
  surfaceLegSeparate: boolean
  /** How cargo/crew continue between an orbital interface and a planetary surface. */
  surfaceAccessMode: SurfaceAccessMode
  /** Planetary surface terminals are shuttle ports, not intersolar ship terminals. */
  surfacePortRole: SurfacePortRole | null
  /** Celestial-body slug used by the current world model. */
  celestialBodySlug: 'earth' | 'moon' | 'mars' | 'phobos'
  /** Stable engineering-facing explanation. Not a balancing value. */
  note: string
}

/**
 * Canonical NOXIA logistics-node semantics.
 *
 * Physical rule:
 * - intersolar ships terminate at an orbital interface or an orbital transfer node;
 * - planetary Raumhäfen are shuttle ports;
 * - surface ↔ orbital-interface movement is performed by transfer shuttles such as
 *   the ASCE 0.3P, never by the intersolar vessel itself.
 *
 * Compatibility rule: existing runtime fields such as ships.location may continue
 * to store the legacy slug. This table defines what that slug means physically;
 * it does not by itself split an already-running journey into additional gameplay
 * steps or change travel times.
 */
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
