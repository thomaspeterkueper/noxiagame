import { ORBITS } from './orbits'

/**
 * Logical orbital destinations used by surface-to-orbit flight.
 *
 * These nodes deliberately describe *where gameplay state ends up*, not the
 * propulsion/trajectory needed to reach them. Engineering remains authoritative
 * for ascent feasibility. Explicit nodes keep surface and orbital presence apart.
 */
export type AscentOrbitNode = {
  slug: string
  bodySlug: string
  label: string
  orbitClass: string
  altitudeKm: number | null
  sourceReference: string
}

export const ASCENT_ORBIT_NODES: Readonly<Record<string, AscentOrbitNode>> = {
  'earth-leo-400': {
    slug: 'earth-leo-400',
    bodySlug: 'earth',
    label: 'Earth · 400 km LEO',
    orbitClass: 'leo-circular',
    altitudeKm: 400,
    sourceReference: 'KUEPER-ENGINEERING spacecraft/asce mission-baseline-book-0.7 mission target',
  },
  'moon-llo-100': {
    slug: 'moon-llo-100',
    bodySlug: 'moon',
    label: 'Moon · 100 km LLO',
    orbitClass: 'llo-circular',
    altitudeKm: 100,
    sourceReference: 'KUEPER-ENGINEERING systems/lunar-ascent-authority-r1.json',
  },
}

export type ResolvedAscentOrbitNode = AscentOrbitNode & {
  resolution: 'explicit-ascent-node' | 'legacy-orbit-node'
}

export function resolveAscentOrbitNode(slug: string): ResolvedAscentOrbitNode | null {
  const normalized = slug.trim().toLowerCase()
  const explicit = ASCENT_ORBIT_NODES[normalized]
  if (explicit) return { ...explicit, resolution: 'explicit-ascent-node' }

  // Backward-compatible bridge for existing Moon/Orbit work that currently
  // references celestial orbit slugs directly. New surface-to-orbit work should
  // prefer explicit nodes so surface and orbital presence cannot collapse into
  // the same location slug.
  if (ORBITS[normalized]) {
    return {
      slug: normalized,
      bodySlug: normalized,
      label: normalized,
      orbitClass: 'legacy-orbit-node',
      altitudeKm: null,
      sourceReference: 'lib/game/orbits.ts',
      resolution: 'legacy-orbit-node',
    }
  }

  return null
}
