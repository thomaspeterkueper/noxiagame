import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import {
  assessSurfaceToOrbitAscentReadiness,
  type AscentEngineeringAuthority,
  type SurfaceToOrbitAscentReadiness,
} from '@/lib/game/ascentControl'
import { ORBITS } from '@/lib/game/orbits'

export const LUNAR_ASCENT_ENGINEERING_REQUEST =
  'EXT-NOXIA-ENG-20260918-LUNAR-SURFACE-TO-ORBIT-ASCENT'

type ShipRow = {
  id: string
  profile_id: string
  ship_type_id: string | null
  location: string | null
  status: string | null
  cargo_max: number | null
  is_active: boolean | null
}

export type AscentReadinessEvidenceState = 'ready' | 'blocked' | 'unresolved'

export interface AscentReadinessEvidence {
  spacecraft: AscentReadinessEvidenceState
  actor: AscentReadinessEvidenceState
  departureSurface: AscentReadinessEvidenceState
  destinationOrbit: AscentReadinessEvidenceState
  docking: AscentReadinessEvidenceState
  missionConflict: AscentReadinessEvidenceState
  crew: AscentReadinessEvidenceState
  cargo: AscentReadinessEvidenceState
  engineering: AscentReadinessEvidenceState
}

export interface ResolvedAscentReadiness {
  ship: ShipRow | null
  departureSurfaceSlug: string
  targetOrbitNodeSlug: string
  readiness: SurfaceToOrbitAscentReadiness
  assessment: ReturnType<typeof assessSurfaceToOrbitAscentReadiness>
  evidence: AscentReadinessEvidence
  engineeringRequest: string
}

export interface AscentReadinessResolutionOptions {
  engineering?: AscentEngineeringAuthority | null
  crewReady?: boolean | null
  cargoReady?: boolean | null
}

function sameSlug(a: string | null | undefined, b: string) {
  return (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Resolve all currently authoritative, server-side ascent facts.
 *
 * Crew/cargo remain explicitly unresolved unless an owning subsystem supplies a
 * boolean verdict. Engineering remains null until kueper-engineering provides a
 * concrete, versioned authority. Unknown is deliberately projected as false into
 * the existing boolean readiness contract so authorization fails closed.
 */
export async function resolveAscentReadiness(
  actorProfileId: string,
  shipId: string,
  departureSurfaceSlug: string,
  targetOrbitNodeSlug: string,
  options: AscentReadinessResolutionOptions = {},
): Promise<ResolvedAscentReadiness> {
  const supabase = createServiceClient()
  const normalizedDeparture = departureSurfaceSlug.trim().toLowerCase()
  const normalizedTarget = targetOrbitNodeSlug.trim().toLowerCase()

  const { data: shipData, error: shipError } = await supabase
    .from('ships')
    .select('id,profile_id,ship_type_id,location,status,cargo_max,is_active')
    .eq('id', shipId)
    .maybeSingle()
  if (shipError) throw new Error(`ascent readiness ship lookup failed: ${shipError.message}`)

  const ship = shipData as unknown as ShipRow | null
  const spacecraftResolved = Boolean(ship)
  const actorAuthorized = Boolean(ship && ship.profile_id === actorProfileId)
  const onDepartureSurface = Boolean(
    ship
    && sameSlug(ship.location, normalizedDeparture)
    && ship.status !== 'transit',
  )

  const destinationOrbitResolved = Boolean(ORBITS[normalizedTarget])

  let noActiveDockingConnection = false
  let noConflictingMission = false
  if (ship) {
    const [{ data: docking, error: dockingError }, { data: mission, error: missionError }] = await Promise.all([
      supabase
        .from('docking_connections')
        .select('id')
        .eq('ship_id', ship.id)
        .eq('status', 'docked')
        .limit(1)
        .maybeSingle(),
      supabase
        .from('ascent_missions')
        .select('id')
        .eq('ship_id', ship.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle(),
    ])
    if (dockingError) throw new Error(`ascent readiness docking lookup failed: ${dockingError.message}`)
    if (missionError) throw new Error(`ascent readiness mission lookup failed: ${missionError.message}`)
    noActiveDockingConnection = !docking
    noConflictingMission = !mission && ship.status !== 'transit'
  }

  const crewReady = options.crewReady === true
  const cargoReady = options.cargoReady === true
  const engineering = options.engineering ?? null

  const readiness: SurfaceToOrbitAscentReadiness = {
    spacecraftResolved,
    actorAuthorized,
    onDepartureSurface,
    destinationOrbitResolved,
    noActiveDockingConnection,
    noConflictingMission,
    crewReady,
    cargoReady,
    engineering,
  }

  const evidence: AscentReadinessEvidence = {
    spacecraft: spacecraftResolved ? 'ready' : 'blocked',
    actor: actorAuthorized ? 'ready' : 'blocked',
    departureSurface: onDepartureSurface ? 'ready' : 'blocked',
    destinationOrbit: destinationOrbitResolved ? 'ready' : 'blocked',
    docking: ship ? (noActiveDockingConnection ? 'ready' : 'blocked') : 'unresolved',
    missionConflict: ship ? (noConflictingMission ? 'ready' : 'blocked') : 'unresolved',
    crew: options.crewReady == null ? 'unresolved' : crewReady ? 'ready' : 'blocked',
    cargo: options.cargoReady == null ? 'unresolved' : cargoReady ? 'ready' : 'blocked',
    engineering: engineering ? 'ready' : 'unresolved',
  }

  return {
    ship,
    departureSurfaceSlug: normalizedDeparture,
    targetOrbitNodeSlug: normalizedTarget,
    readiness,
    assessment: assessSurfaceToOrbitAscentReadiness(readiness),
    evidence,
    engineeringRequest: LUNAR_ASCENT_ENGINEERING_REQUEST,
  }
}
