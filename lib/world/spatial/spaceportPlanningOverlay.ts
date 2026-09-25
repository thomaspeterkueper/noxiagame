import { SELMECKE_REFERENCE_SITE } from './earthReferenceSites'

export type PlanningCandidate = {
  lat: number
  lon: number
  shortlistLabel: 'A' | 'B' | 'C'
}

export type SpaceportPlanningOverlay = {
  id: 'selmecke-spaceport-corridor-b'
  label: 'Korridor B · Vorprüfung'
  status: 'screening-only'
  canonical: false
  constructionAuthority: false
  start: { lat: number; lon: number }
  end: { lat: number; lon: number }
}

/** Read-only planning overlay. It carries no build, cost or canon authority. */
export function createSpaceportPlanningOverlay(
  candidates: readonly PlanningCandidate[],
): SpaceportPlanningOverlay | null {
  const candidate = candidates.find(item => item.shortlistLabel === 'B')
  if (!candidate) return null
  return {
    id: 'selmecke-spaceport-corridor-b',
    label: 'Korridor B · Vorprüfung',
    status: 'screening-only',
    canonical: false,
    constructionAuthority: false,
    start: { ...SELMECKE_REFERENCE_SITE.point },
    end: { lat: candidate.lat, lon: candidate.lon },
  }
}
