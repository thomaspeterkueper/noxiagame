// lib/game/population/types.ts
// Erstellt:     25.08.2026
// Version:      0.1.0
// ADR:          NOXIA-LIVING-0001
//
// Persistentes Domänenmodell für natürliche Personen in NOXIA.
// Firmen/NPC-Unternehmen bleiben im bestehenden actors/npc_ledger-Modell.
// Orte, Tiles und Gebäude bleiben Source of Truth der bestehenden Weltmodelle.

export const SIMULATION_TIERS = ['active', 'background', 'aggregate'] as const
export type SimulationTier = (typeof SIMULATION_TIERS)[number]

export const PERSON_ACTIVITY_STATES = [
  'idle',
  'travelling',
  'working',
  'resting',
  'socialising',
  'inspecting',
] as const
export type PersonActivityState = (typeof PERSON_ACTIVITY_STATES)[number]

export const ASSIGNMENT_TYPES = ['home', 'work', 'temporary'] as const
export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number]

export const NEED_CODES = ['sustenance', 'rest', 'safety', 'social', 'purpose'] as const
export type NeedCode = (typeof NEED_CODES)[number]

export const BASE_ROLE_CODES = [
  'technician',
  'scientist',
  'geologist',
  'operator',
  'trader',
  'administrator',
  'service',
  'resident',
] as const
export type BaseRoleCode = (typeof BASE_ROLE_CODES)[number]

export const BASE_SKILL_CODES = [
  'maintenance',
  'geology',
  'materials',
  'logistics',
  'research',
  'administration',
] as const
export type BaseSkillCode = (typeof BASE_SKILL_CODES)[number]

export type PersonId = string
export type LocationId = string
export type TileEntityId = string
export type ActorId = string

export interface Person {
  id: PersonId
  displayName: string
  birthYear: number | null
  currentLocationId: LocationId
  simulationTier: SimulationTier
  activityState: PersonActivityState
  lastAction: string | null
  lastDecisionFactors: Record<string, unknown>
  lastTick: number | null
}

export interface PersonAssignment {
  id: string
  personId: PersonId
  assignmentType: AssignmentType
  locationId: LocationId
  tileEntityId: TileEntityId | null
  employerActorId: ActorId | null
  roleCode: string | null
  startsTick: number | null
  endsTick: number | null
  isActive: boolean
}

export interface PersonNeed {
  personId: PersonId
  needCode: NeedCode
  /** 0 = unbefriedigt, 1 = vollständig befriedigt */
  satisfaction: number
  updatedTick: number | null
}

export interface PersonSkill {
  personId: PersonId
  skillCode: string
  level: number
  experience: number
  updatedTick: number | null
}

export interface PersonRelationship {
  id: string
  personId: PersonId
  otherPersonId: PersonId
  relationshipType: string
  familiarity: number
  trust: number
  affinity: number
  lastInteractionTick: number | null
}

export interface PopulationEvent {
  id: string
  tick: number
  eventType: string
  actorPersonId: PersonId | null
  relatedPersonId: PersonId | null
  locationId: LocationId | null
  subjectType: string | null
  subjectRef: string | null
  payload: Record<string, unknown>
}

export interface PersonKnowledge {
  id: string
  personId: PersonId
  subjectType: string
  subjectRef: string
  knowledgeType: string
  confidence: number
  learnedTick: number
  sourceEventId: string | null
  details: Record<string, unknown>
}

export type PopulationAction =
  | 'work'
  | 'rest'
  | 'satisfy_basic_need'
  | 'travel_home'
  | 'travel_work'
  | 'social_interaction'
  | 'inspect_problem'
  | 'report_problem'

export interface PopulationDecision {
  personId: PersonId
  action: PopulationAction
  score: number
  factors: Record<string, number | string | boolean>
}

export function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}
