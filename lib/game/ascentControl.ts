// lib/game/ascentControl.ts
// Canonical state and readiness semantics for moving a spacecraft from a
// planetary/moon surface into an orbital arrival-control context.
//
// IMPORTANT:
// - This module does not contain propulsion physics or gameplay tuning values.
// - Engineering remains authoritative for whether a concrete vehicle can fly
//   a concrete ascent mission.
// - Completing ascent does not mean docking. The hand-off is the existing
//   arrival-rendezvous phase from arrivalControl.ts.

import type { ArrivalControlPhase } from './arrivalControl'

export type AscentControlPhase =
  | 'surface'
  | 'ascent-authorized'
  | 'ascending'
  | 'orbital-insertion'
  | 'orbital-arrival'
  | 'aborted'

export interface AscentEngineeringAuthority {
  vehicleFrameId: string
  body: string
  profileId: string
  sourceRepository: string
  sourceReference: string
}

export interface SurfaceToOrbitAscentReadiness {
  spacecraftResolved: boolean
  actorAuthorized: boolean
  onDepartureSurface: boolean
  destinationOrbitResolved: boolean
  noActiveDockingConnection: boolean
  noConflictingMission: boolean
  crewReady: boolean
  cargoReady: boolean
  engineering: AscentEngineeringAuthority | null
}

export type AscentReadinessBlocker =
  | 'spacecraft-unresolved'
  | 'actor-unauthorized'
  | 'wrong-departure-state'
  | 'destination-orbit-unresolved'
  | 'spacecraft-docked'
  | 'conflicting-mission'
  | 'crew-not-ready'
  | 'cargo-not-ready'
  | 'engineering-profile-unavailable'

export interface AscentReadinessResult {
  ready: boolean
  blockers: readonly AscentReadinessBlocker[]
}

export function assessSurfaceToOrbitAscentReadiness(
  readiness: SurfaceToOrbitAscentReadiness,
): AscentReadinessResult {
  const blockers: AscentReadinessBlocker[] = []

  if (!readiness.spacecraftResolved) blockers.push('spacecraft-unresolved')
  if (!readiness.actorAuthorized) blockers.push('actor-unauthorized')
  if (!readiness.onDepartureSurface) blockers.push('wrong-departure-state')
  if (!readiness.destinationOrbitResolved) blockers.push('destination-orbit-unresolved')
  if (!readiness.noActiveDockingConnection) blockers.push('spacecraft-docked')
  if (!readiness.noConflictingMission) blockers.push('conflicting-mission')
  if (!readiness.crewReady) blockers.push('crew-not-ready')
  if (!readiness.cargoReady) blockers.push('cargo-not-ready')
  if (!readiness.engineering) blockers.push('engineering-profile-unavailable')

  return { ready: blockers.length === 0, blockers }
}

export function canAuthorizeAscent(
  phase: AscentControlPhase,
  readiness: SurfaceToOrbitAscentReadiness,
): boolean {
  return phase === 'surface' && assessSurfaceToOrbitAscentReadiness(readiness).ready
}

export function nextAscentPhase(phase: AscentControlPhase): AscentControlPhase | null {
  switch (phase) {
    case 'surface':
      return 'ascent-authorized'
    case 'ascent-authorized':
      return 'ascending'
    case 'ascending':
      return 'orbital-insertion'
    case 'orbital-insertion':
      return 'orbital-arrival'
    case 'orbital-arrival':
    case 'aborted':
      return null
  }
}

export function arrivalPhaseAfterSuccessfulAscent(
  phase: AscentControlPhase,
): ArrivalControlPhase | null {
  return phase === 'orbital-arrival' ? 'arrival-rendezvous' : null
}
