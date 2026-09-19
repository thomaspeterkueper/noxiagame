import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import {
  assessSurfaceToOrbitAscentReadiness,
  type AscentEngineeringAuthority,
  type SurfaceToOrbitAscentReadiness,
} from '@/lib/game/ascentControl'
import { resolveAscentOrbitNode } from '@/lib/game/ascentTargets'
import {
  EARTH_LEO_ASCENT_AUTHORITY_R1,
  resolveEarthAscentEngineeringAuthority,
  type EarthAscentEngineeringAssessment,
} from '@/lib/game/core/earthAscentEngineeringAuthority'

export const LUNAR_ASCENT_ENGINEERING_REQUEST =
  'EXT-NOXIA-ENG-20260918-LUNAR-SURFACE-TO-ORBIT-ASCENT'
export const EARTH_ASCENT_ENGINEERING_REQUEST =
  'EXT-NOXIA-ENG-20260919-EARTH-LEO-ASCENT-AUTHORITY'

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

export interface AscentCrewEvidence {
  boarded: boolean
  role: string | null
}

export interface AscentCargoEvidence {
  empty: boolean
  totalLegacyAmount: number
  unresolvedResources: string[]
  rationale: string
}

export interface ResolvedAscentReadiness {
  ship: ShipRow | null
  departureSurfaceSlug: string
  targetOrbitNodeSlug: string
  readiness: SurfaceToOrbitAscentReadiness
  assessment: ReturnType<typeof assessSurfaceToOrbitAscentReadiness>
  evidence: AscentReadinessEvidence
  crew: AscentCrewEvidence
  cargo: AscentCargoEvidence
  engineeringRequest: string
  engineeringAuthorityRef: string | null
  engineeringAssessment: EarthAscentEngineeringAssessment | null
}

export interface AscentReadinessResolutionOptions {
  engineering?: AscentEngineeringAuthority | null
  crewReady?: boolean | null
  cargoReady?: boolean | null
}

function sameSlug(a: string | null | undefined, b: string) {
  return (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()
}

export function engineeringRequestForDeparture(departureSurfaceSlug: string): string {
  return departureSurfaceSlug.trim().toLowerCase() === 'earth'
    ? EARTH_ASCENT_ENGINEERING_REQUEST
    : LUNAR_ASCENT_ENGINEERING_REQUEST
}

/**
 * Resolve authoritative server-side ascent facts.
 *
 * Crew comes from the explicit spacecraft crew manifest. Empty cargo is a
 * resolved 0 kg payload; non-empty legacy cargo remains fail-closed until its
 * physical mass basis is mapped. Earth Engineering authority is now consumed
 * from ENG-EARTH-LEO-ASCENT-r1 rather than being treated as an open request.
 *
 * The current legacy ship table still has no persisted ASCE physical departure
 * state (measured start mass, reference propellant state, mapped launch-assist
 * site/release state and resolved target plane). Consequently the Engineering
 * resolver remains fail-closed until an exact ASCE flight article is represented
 * by NOXIA; legacy freighters are never relabelled as ENG-SCV-0003.
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
  const target = resolveAscentOrbitNode(normalizedTarget)

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

  const destinationOrbitResolved = Boolean(target)

  let noActiveDockingConnection = false
  let noConflictingMission = false
  let crewRow: { role: string; active: boolean } | null = null
  let cargoRows: { resource: string; amount: number }[] = []

  if (ship) {
    const [
      { data: docking, error: dockingError },
      { data: mission, error: missionError },
      { data: crew, error: crewError },
      { data: cargo, error: cargoError },
    ] = await Promise.all([
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
      supabase
        .from('ship_crew_manifest')
        .select('role,active')
        .eq('ship_id', ship.id)
        .eq('profile_id', actorProfileId)
        .eq('active', true)
        .maybeSingle(),
      supabase
        .from('ship_cargo')
        .select('resource,amount')
        .eq('ship_id', ship.id)
        .gt('amount', 0),
    ])
    if (dockingError) throw new Error(`ascent readiness docking lookup failed: ${dockingError.message}`)
    if (missionError) throw new Error(`ascent readiness mission lookup failed: ${missionError.message}`)
    if (crewError) throw new Error(`ascent readiness crew lookup failed: ${crewError.message}`)
    if (cargoError) throw new Error(`ascent readiness cargo lookup failed: ${cargoError.message}`)
    noActiveDockingConnection = !docking
    noConflictingMission = !mission && ship.status !== 'transit'
    crewRow = crew as { role: string; active: boolean } | null
    cargoRows = (cargo ?? []).map(row => ({ resource: String(row.resource), amount: Number(row.amount) }))
  }

  const canonicalCrewReady = Boolean(
    crewRow?.active
    && (crewRow.role === 'commander' || crewRow.role === 'pilot'),
  )
  const cargoEmpty = cargoRows.length === 0
  const totalLegacyAmount = cargoRows.reduce((sum, row) => sum + Math.max(0, row.amount), 0)
  const unresolvedResources = [...new Set(cargoRows.map(row => row.resource))]
  const canonicalCargoReady = cargoEmpty

  const crewReady = options.crewReady == null ? canonicalCrewReady : options.crewReady === true
  const cargoReady = options.cargoReady == null ? canonicalCargoReady : options.cargoReady === true

  const engineeringAssessment = normalizedDeparture === 'earth'
    ? resolveEarthAscentEngineeringAuthority({
      shipTypeId: ship?.ship_type_id ?? null,
      departureSurfaceSlug: normalizedDeparture,
      target,
      // No client field may satisfy this. A later NOXIA flight-article state
      // projection will supply trusted measured/configuration values here.
      physicalState: null,
    })
    : null

  const engineering = options.engineering !== undefined
    ? options.engineering
    : engineeringAssessment?.authority ?? null

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

  const engineeringEvidence: AscentReadinessEvidenceState = engineering
    ? 'ready'
    : engineeringAssessment?.result === 'frame-unmapped'
      || engineeringAssessment?.result === 'unsupported-launch-site'
      || engineeringAssessment?.result === 'unsupported-orbit'
      || engineeringAssessment?.result === 'over-mass'
      || engineeringAssessment?.result === 'insufficient-release-speed'
      ? 'blocked'
      : 'unresolved'

  const evidence: AscentReadinessEvidence = {
    spacecraft: spacecraftResolved ? 'ready' : 'blocked',
    actor: actorAuthorized ? 'ready' : 'blocked',
    departureSurface: onDepartureSurface ? 'ready' : 'blocked',
    destinationOrbit: destinationOrbitResolved ? 'ready' : 'blocked',
    docking: ship ? (noActiveDockingConnection ? 'ready' : 'blocked') : 'unresolved',
    missionConflict: ship ? (noConflictingMission ? 'ready' : 'blocked') : 'unresolved',
    crew: options.crewReady == null
      ? canonicalCrewReady ? 'ready' : 'blocked'
      : crewReady ? 'ready' : 'blocked',
    cargo: options.cargoReady == null
      ? cargoEmpty ? 'ready' : 'unresolved'
      : cargoReady ? 'ready' : 'blocked',
    engineering: engineeringEvidence,
  }

  return {
    ship,
    departureSurfaceSlug: normalizedDeparture,
    targetOrbitNodeSlug: normalizedTarget,
    readiness,
    assessment: assessSurfaceToOrbitAscentReadiness(readiness),
    evidence,
    crew: {
      boarded: canonicalCrewReady,
      role: crewRow?.role ?? null,
    },
    cargo: {
      empty: cargoEmpty,
      totalLegacyAmount,
      unresolvedResources,
      rationale: cargoEmpty
        ? 'Kein positiver Cargo-Bestand an Bord; bekannte Frachtmasse ist 0 kg.'
        : 'Nichtleere Legacy-Fracht bleibt gesperrt, bis ihre Gameplay-Mengen explizit auf physikalische Massenbasen abgebildet sind.',
    },
    engineeringRequest: engineeringRequestForDeparture(normalizedDeparture),
    engineeringAuthorityRef: normalizedDeparture === 'earth'
      ? EARTH_LEO_ASCENT_AUTHORITY_R1.authorityId
      : null,
    engineeringAssessment,
  }
}
