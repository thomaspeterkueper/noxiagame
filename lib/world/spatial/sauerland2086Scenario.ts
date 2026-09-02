import type { SpaceportAreaAnalysis } from './spaceportAreaAnalysis'

/**
 * Explicitly speculative future-planning scenario for NOXIA.
 * These parameters are narrative assumptions, not forecasts or present-day ground truth.
 * Real terrain remains unchanged; only planning weights and infrastructure assumptions shift.
 */
export type Sauerland2086Scenario = {
  id: 'sauerland-2086-transition'
  year: 2086
  assumptions: {
    ruralLandAvailability: 'higher'
    settlementConflictWeight: number
    forestConflictWeight: number
    climateResilienceWeight: number
    undergroundFreightLink: boolean
    europeanSpaceportProgram: boolean
  }
  narrative: string[]
}

export const SAUERLAND_2086_SCENARIO: Sauerland2086Scenario = {
  id: 'sauerland-2086-transition',
  year: 2086,
  assumptions: {
    ruralLandAvailability: 'higher',
    settlementConflictWeight: 0.55,
    forestConflictWeight: 0.45,
    climateResilienceWeight: 1.25,
    undergroundFreightLink: true,
    europeanSpaceportProgram: true,
  },
  narrative: [
    'demographicischer Wandel kann größere zusammenhängende Entwicklungsflächen verfügbar machen',
    'Waldumbau und Klimafolgen können heutige Waldnutzungen räumlich verändern',
    'eine neue unterirdische Hochleistungs-Güterverbindung wird als Szenario-Infrastruktur angenommen',
    'der Raumhafen wird als europäischer Forschungs-, Logistik- und Raumfahrtstandort gedacht',
  ],
}

export type FutureAreaAssessment = SpaceportAreaAnalysis & {
  futureScore: number
  futureVerdict: 'strong' | 'conditional' | 'weak'
  futureReasons: string[]
}

/** Applies only scenario deltas to an already ground-truth-based area assessment. */
export function applySauerland2086Scenario(area: SpaceportAreaAnalysis): FutureAreaAssessment {
  const reasons: string[] = []
  let score = area.areaScore

  // Larger land assembly becomes somewhat more plausible, but terrain still dominates.
  if (area.usableAreaHa >= 50) {
    score += 6
    reasons.push('größere Flächenzusammenlegung im Szenario plausibler')
  }

  // A hypothetical underground freight link reduces today's rail-access disadvantage.
  if (SAUERLAND_2086_SCENARIO.assumptions.undergroundFreightLink) {
    score += Math.round((100 - area.accessScore) * 0.18)
    reasons.push('unterirdische Hochleistungslogistik als Szenarioannahme')
  }

  // Resilience requirements become stricter rather than disappearing.
  if (area.expansionScore >= 60) {
    score += 4
    reasons.push('Reserveflächen erlauben klimaresiliente Sicherheits- und Entwässerungszonen')
  }

  // Long connected terrain remains strategically valuable in any epoch.
  if (area.maxConnectedSpanM >= 1500) {
    score += 5
    reasons.push('langer zusammenhängender Entwicklungskorridor')
  }

  const futureScore = Math.max(0, Math.min(100, Math.round(score)))
  return {
    ...area,
    futureScore,
    futureVerdict: futureScore >= 70 ? 'strong' : futureScore >= 50 ? 'conditional' : 'weak',
    futureReasons: reasons,
  }
}
