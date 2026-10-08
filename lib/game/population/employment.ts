// lib/game/population/employment.ts
// NOXIA-LIVING-0010 — how a person comes by a job.
//
// Pure rules for the job market. A vacancy is an option only if the employer
// hires you; an offer is taken only if it is worth it to you. Both sides can
// say no. Mirrors the live model: person_assignments (work) with an employer
// actor, wages from role_wage_rates.

export interface Vacancy {
  id: string
  locationId: string
  tileEntityId: string | null
  employerId: string
  employerKind: 'state' | 'company' | 'person'
  roleCode: string
  dailyWage: number
  /** Skill the role needs, if any. */
  requiredSkill?: { code: string; minLevel: number } | null
}

export type JobRefusal = 'no_vacancy' | 'underqualified' | 'dismissed_before' | 'employer_dislikes'

export interface JobApplication {
  vacancy: Vacancy
  openPositions: number
  applicant: {
    /** Skill level 0..1 per code. */
    skills: Record<string, number>
    /** Whether this employer dismissed the applicant before. */
    dismissedByEmployer?: boolean
  }
  /** Faded affinity of an employing person towards the applicant; ignored for institutions. */
  employerAffinity?: number
}

export interface JobDecision {
  hired: boolean
  reason: 'hired' | JobRefusal
}

const EMPLOYER_MIN_AFFINITY = 0.35

/**
 * Whether the employer hires this person. Public employers hire anyone who is
 * qualified. Companies do not rehire someone they dismissed. A person who
 * employs others may refuse someone they dislike.
 */
export function employerDecision(application: JobApplication): JobDecision {
  const { vacancy, applicant } = application
  if (application.openPositions <= 0) return { hired: false, reason: 'no_vacancy' }
  const need = vacancy.requiredSkill
  if (need && (applicant.skills[need.code] ?? 0) < need.minLevel) return { hired: false, reason: 'underqualified' }
  if (vacancy.employerKind !== 'state' && applicant.dismissedByEmployer) return { hired: false, reason: 'dismissed_before' }
  if (vacancy.employerKind === 'person' && application.employerAffinity != null && application.employerAffinity < EMPLOYER_MIN_AFFINITY) {
    return { hired: false, reason: 'employer_dislikes' }
  }
  return { hired: true, reason: 'hired' }
}

export interface JobOfferInput {
  offeredDailyWage: number
  /** 0 when unemployed. */
  currentDailyWage: number
  /** The person wants a change of workplace anyway (see relocation.decideRelocation). */
  wantsChange: boolean
  /** Taking the job means moving to another settlement. */
  requiresMove: boolean
}

export interface JobOfferDecision {
  accepted: boolean
  reason: 'accepted' | 'wage_too_low' | 'not_worth_moving'
}

/**
 * Whether the person takes the offer. Someone without work takes what there is.
 * Someone who wants a change accepts a small loss; nobody else moves for less
 * than a clear raise.
 */
export function considerJobOffer(input: JobOfferInput): JobOfferDecision {
  if (input.currentDailyWage <= 0) return { accepted: true, reason: 'accepted' }
  const ratio = input.offeredDailyWage / input.currentDailyWage
  if (input.wantsChange) return ratio >= 0.9 ? { accepted: true, reason: 'accepted' } : { accepted: false, reason: 'wage_too_low' }
  if (ratio < 1.1) return { accepted: false, reason: 'wage_too_low' }
  if (input.requiresMove && ratio < 1.25) return { accepted: false, reason: 'not_worth_moving' }
  return { accepted: true, reason: 'accepted' }
}
