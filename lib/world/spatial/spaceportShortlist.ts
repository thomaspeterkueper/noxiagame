import type { SpaceportCandidate } from './spaceportSuitability'

export type SpaceportShortlistCandidate = SpaceportCandidate & {
  shortlistRank: 1 | 2 | 3
  shortlistLabel: 'A' | 'B' | 'C'
  shortlistReason: string
}

function distanceM(a: SpaceportCandidate, b: SpaceportCandidate): number {
  const latM = (b.lat - a.lat) * 111_320
  const lonM = (b.lon - a.lon) * 111_320 * Math.cos(((a.lat + b.lat) * Math.PI) / 360)
  return Math.hypot(latM, lonM)
}

function qualifies(candidate: SpaceportCandidate): boolean {
  return candidate.score >= 45
    && candidate.slopePercent <= 8
    && (candidate.exclusionDistanceM === null || candidate.exclusionDistanceM >= 250)
}

/**
 * Produces a deliberately small planning shortlist from the ranked terrain cells.
 * Candidates must be spatially distinct so A/B/C represent alternative sites,
 * not neighbouring samples from the same patch of terrain.
 */
export function createSpaceportShortlist(
  ranked: SpaceportCandidate[],
  minimumSeparationM = 1200,
): SpaceportShortlistCandidate[] {
  const selected: SpaceportCandidate[] = []
  const pool = ranked.filter(qualifies)

  for (const candidate of pool) {
    if (selected.every(existing => distanceM(existing, candidate) >= minimumSeparationM)) {
      selected.push(candidate)
      if (selected.length === 3) break
    }
  }

  // A constrained 6 km bootstrap window can occasionally yield fewer than three
  // qualifying zones. Fill only with spatially distinct ranked cells; never duplicate a site.
  if (selected.length < 3) {
    for (const candidate of ranked) {
      if (selected.includes(candidate)) continue
      if (selected.every(existing => distanceM(existing, candidate) >= minimumSeparationM)) {
        selected.push(candidate)
        if (selected.length === 3) break
      }
    }
  }

  const labels = ['A', 'B', 'C'] as const
  return selected.map((candidate, index) => ({
    ...candidate,
    shortlistRank: (index + 1) as 1 | 2 | 3,
    shortlistLabel: labels[index],
    shortlistReason: index === 0
      ? 'stärkster räumlich eigenständiger Kandidat der aktuellen Analyse'
      : 'räumlich eigenständige Alternative für den Standortvergleich',
  }))
}
