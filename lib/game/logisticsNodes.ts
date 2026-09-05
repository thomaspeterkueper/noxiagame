// lib/game/logisticsNodes.ts
// NOXIA-owned semantic boundary between gameplay location slugs and physical missions.
//
// A location slug is not automatically the exact endpoint of an interplanetary burn.
// Planetary/lunar surface operations are intentionally separable from the deep-space
// transfer so orbital freighters do not implicitly become landers.

export type CanonicalLogisticsNodeId = 'earth' | 'moon' | 'mars' | 'phobos' | 'prometheus'

export type LogisticsDomainMeaning =
  | 'aggregated-logistics-domain'
  | 'surface-domain'
  | 'orbital-station'

export type TransferEndpointKind =
  | 'orbital-interface'
  | 'node-itself'

export interface LogisticsNodeSemantics {
  id: CanonicalLogisticsNodeId
  domainMeaning: LogisticsDomainMeaning
  transferEndpoint: TransferEndpointKind
  surfaceLegSeparate: boolean
  /** Celestial-body slug used by the world model where one exists. */
  celestialBodySlug: 'earth' | 'moon' | 'mars' | 'phobos' | null
  /** Stable engineering-facing explanation. Not a balancing value. */
  note: string
}

/**
 * Canonical NOXIA logistics-node semantics.
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
    celestialBodySlug: 'earth',
    note: 'Earth is a logistics domain spanning surface infrastructure and its orbital interface. Inter-node transfer terminates at the orbital interface; ascent/descent is a separate operation.',
  },
  moon: {
    id: 'moon',
    domainMeaning: 'surface-domain',
    transferEndpoint: 'orbital-interface',
    surfaceLegSeparate: true,
    celestialBodySlug: 'moon',
    note: 'The gameplay node represents the Shackleton surface colony. Inter-node transfer uses a lunar orbital interface; the surface leg is separate.',
  },
  mars: {
    id: 'mars',
    domainMeaning: 'surface-domain',
    transferEndpoint: 'orbital-interface',
    surfaceLegSeparate: true,
    celestialBodySlug: 'mars',
    note: 'The gameplay node represents the Tharsis surface colony. Inter-node transfer uses a Mars orbital interface; atmospheric entry/ascent and landing are separate.',
  },
  phobos: {
    id: 'phobos',
    domainMeaning: 'orbital-station',
    transferEndpoint: 'node-itself',
    surfaceLegSeparate: false,
    celestialBodySlug: 'phobos',
    note: 'Phobos is the station/free-port logistics endpoint associated with the moon, not a separate surface-delivery leg.',
  },
  prometheus: {
    id: 'prometheus',
    domainMeaning: 'orbital-station',
    transferEndpoint: 'node-itself',
    surfaceLegSeparate: false,
    celestialBodySlug: null,
    note: 'Prometheus is the L5 habitat/transfer station itself; arrival at the node completes the transfer and no planetary surface leg follows.',
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
