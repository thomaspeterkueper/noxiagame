import type { GeoPoint } from './earthSpatial'

export type FutureInfrastructureKind =
  | 'spaceport'
  | 'research'
  | 'academy'
  | 'logistics'
  | 'energy'
  | 'industry'
  | 'transit'

export type FutureInfrastructureCandidate = {
  id: string
  name: string
  kind: FutureInfrastructureKind
  validFrom: string
  anchor: GeoPoint
  /** Planning envelope only. Final footprints must be fitted to imported terrain and parcels. */
  planningRadiusM: number
  status: 'concept' | 'planned' | 'built'
  notes: string[]
}

/**
 * 2098 concept layer for the first Earth region.
 * Coordinates deliberately stay close to the streaming origin until terrain,
 * protected-land and transport suitability have been evaluated. They are not
 * canonical construction footprints yet.
 */
export const SAUERLAND_2098_CONCEPTS: FutureInfrastructureCandidate[] = [
  {
    id: 'earth-sauerland-spaceport-cluster',
    name: 'Sauerland Raumfahrt- und Technologiecluster',
    kind: 'spaceport',
    validFrom: '2085-01-01T00:00:00Z',
    anchor: { lat: 51.325, lon: 8.005 },
    planningRadiusM: 900,
    status: 'concept',
    notes: [
      'Position is a planning anchor, not a final runway or building footprint.',
      'Final placement must respect topography, settlements, transport corridors and protected land.',
      'Public, research and commercial complexes should remain independently expandable.',
    ],
  },
]
