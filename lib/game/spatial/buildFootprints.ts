import { BUILDINGS } from '@/lib/game/buildings'
import type { RectFootprint } from './types'

/**
 * Canonical world-space footprints for placement/collision.
 *
 * A building definition may eventually carry measured/engineered dimensions.
 * Until then, the fallback is deliberately conservative and server-owned; clients
 * never get to choose their own collision size.
 */
const FOOTPRINTS: Record<string, RectFootprint> = {
  wohnblock: { kind: 'rect', widthM: 36, depthM: 28 },
  factory: { kind: 'rect', widthM: 52, depthM: 38 },
  fabrik: { kind: 'rect', widthM: 52, depthM: 38 },
  research_lab: { kind: 'rect', widthM: 34, depthM: 26 },
  forschungslabor: { kind: 'rect', widthM: 34, depthM: 26 },
  mine: { kind: 'rect', widthM: 60, depthM: 46 },
  solarfeld: { kind: 'rect', widthM: 90, depthM: 60 },
  wasseraufbereitung: { kind: 'rect', widthM: 44, depthM: 34 },
  schmelze: { kind: 'rect', widthM: 58, depthM: 42 },
  mars_habitat: { kind: 'rect', widthM: 46, depthM: 40 },
  habitat: { kind: 'rect', widthM: 46, depthM: 40 },
}

const DEFAULT_FOOTPRINT: RectFootprint = { kind: 'rect', widthM: 40, depthM: 32 }

function normalizedCandidates(buildableId: string): string[] {
  const id = buildableId.toLowerCase()
  return [
    id,
    id.replace(/^bld:nox:/, ''),
    id.replace(/-1$/, ''),
    id.replace(/_/g, '-'),
    id.replace(/-/g, '_'),
  ]
}

export function getBuildFootprint(buildableId: string): RectFootprint {
  for (const candidate of normalizedCandidates(buildableId)) {
    if (FOOTPRINTS[candidate]) return FOOTPRINTS[candidate]
    for (const [key, footprint] of Object.entries(FOOTPRINTS)) {
      if (candidate.includes(key)) return footprint
    }
  }

  // Keep the fallback tied to a known build definition when possible. This makes
  // unknown IDs fail in the build API while known legacy IDs still receive a
  // deterministic physical footprint.
  if (BUILDINGS[buildableId]) return DEFAULT_FOOTPRINT
  return DEFAULT_FOOTPRINT
}

export function getLegacyFootprint(): RectFootprint {
  // Legacy 100 m tile centres are bridged to metres. 80 m keeps neighbouring
  // legacy buildings non-overlapping while reserving realistic clearance.
  return { kind: 'rect', widthM: 80, depthM: 80 }
}
