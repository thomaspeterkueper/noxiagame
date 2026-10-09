// lib/game/population/housingShadowRuntime.ts
// NOXIA-LIVING-0010, stage 4: shadow mode against the live inventory.
//
// Once per game day every person's housing decision is computed and written to
// housing_shadow_decisions. No ledger is touched and move_person_to_market_rental
// is never called from here. Off unless NOXIA_HOUSING_SHADOW=true.
//
// One exception, behind its own switch NOXIA_HOUSING_PUBLIC_PLACEMENT=true: a
// person without a home is placed in free public housing at their own location
// (move_person_to_public_housing). Any failure leaves the tick untouched.

import type { Dwelling, Tenure } from './housing'
import { shadowHousingDecision, type ShadowDwelling, type ShadowPerson } from './housingShadow'
import { fadeRelationships, relationshipTiers } from './relationshipDynamics'
import type { NeedCode, PersonRelationship } from './types'

const DAY_TICKS = 24
const UNSUPPLIED = 0.4

export function housingShadowEnabled(): boolean {
  return process.env.NOXIA_HOUSING_SHADOW === 'true'
}

/** Carries out exactly one kind of decision: a person without a home moving into free public housing. */
export function publicPlacementEnabled(): boolean {
  return process.env.NOXIA_HOUSING_PUBLIC_PLACEMENT === 'true'
}

export async function runHousingShadowTick(supabase: any, tick: number): Promise<{ ok: boolean; skipped?: string; decisions?: number; placed?: number; placementErrors?: string[]; error?: string }> {
  if (!housingShadowEnabled()) return { ok: true, skipped: 'disabled' }
  if (tick % DAY_TICKS !== 0) return { ok: true, skipped: 'not_due' }
  try {
    const [peopleQ, needsQ, assignmentsQ, relationsQ, locationsQ, occupancyQ, tilesQ, tenanciesQ, wagesQ, personActorsQ, profileActorsQ, ledgerQ] = await Promise.all([
      supabase.from('people').select('id,current_location_id'),
      supabase.from('person_needs').select('person_id,need_code,satisfaction'),
      supabase.from('person_assignments').select('person_id,assignment_type,tile_entity_id,role_code,starts_tick').eq('is_active', true),
      supabase.from('person_relationships').select('id,person_id,other_person_id,relationship_type,familiarity,trust,affinity,last_interaction_tick'),
      supabase.from('locations').select('id,is_supplied'),
      supabase.from('residential_occupancy').select('tile_entity_id,location_id,owner_class,residential_capacity'),
      supabase.from('tile_entities').select('id,profile_id,lease_price').gt('residential_capacity', 0),
      supabase.from('person_tenancies').select('person_id,tile_entity_id,tenure,status'),
      supabase.from('role_wage_rates').select('role_code,daily_credits'),
      supabase.from('person_economic_actors').select('person_id,actor_id'),
      supabase.from('profile_economic_actors').select('profile_id,actor_id'),
      supabase.from('npc_ledger').select('actor_id,credit_delta'),
    ])
    for (const q of [peopleQ, needsQ, assignmentsQ, relationsQ, locationsQ, occupancyQ, tilesQ, tenanciesQ, wagesQ, personActorsQ, profileActorsQ, ledgerQ]) {
      if (q.error) return { ok: false, error: q.error.message ?? String(q.error) }
    }
    const supply = new Map<string, number>((locationsQ.data ?? []).map((row: any) => [row.id, row.is_supplied === false ? UNSUPPLIED : 1]))
    const tileById = new Map<string, any>((tilesQ.data ?? []).map((row: any) => [row.id, row]))
    const profileActor = new Map<string, string>((profileActorsQ.data ?? []).map((row: any) => [row.profile_id, row.actor_id]))
    const wage = new Map<string, number>((wagesQ.data ?? []).map((row: any) => [row.role_code, Number(row.daily_credits)]))
    const balance = new Map<string, number>()
    for (const row of ledgerQ.data ?? []) balance.set(row.actor_id, (balance.get(row.actor_id) ?? 0) + Number(row.credit_delta))
    const personActor = new Map<string, string>((personActorsQ.data ?? []).map((row: any) => [row.person_id, row.actor_id]))

    const home = new Map<string, { tile: string | null; since: number | null }>()
    const dailyWage = new Map<string, number>()
    for (const row of assignmentsQ.data ?? []) {
      if (row.assignment_type === 'home') home.set(row.person_id, { tile: row.tile_entity_id ?? null, since: row.starts_tick == null ? null : Number(row.starts_tick) })
      if (row.assignment_type === 'work') dailyWage.set(row.person_id, wage.get(row.role_code ?? 'resident') ?? 60)
    }
    const residents = new Map<string, string[]>()
    for (const [personId, entry] of home) if (entry.tile) residents.set(entry.tile, [...(residents.get(entry.tile) ?? []), personId])

    const inventory: ShadowDwelling[] = (occupancyQ.data ?? []).map((row: any) => {
      const tile = tileById.get(row.tile_entity_id) ?? {}
      const state = row.owner_class === 'STATE'
      // A private dwelling without a lease price is not on the market.
      const rent = state ? 0 : tile.lease_price == null ? null : Number(tile.lease_price)
      const dwelling: Dwelling = {
        id: row.tile_entity_id, locationId: row.location_id, tileEntityId: row.tile_entity_id, kind: 'rental',
        capacity: Number(row.residential_capacity ?? 0), ownerKind: state ? 'state' : 'landlord',
        ownerId: state ? `state:${row.location_id}` : profileActor.get(tile.profile_id) ?? `profile:${tile.profile_id ?? 'unknown'}`,
        rent, baseRent: rent, askingPrice: null, nightlyRate: null,
      }
      return { dwelling, residents: residents.get(row.tile_entity_id) ?? [], supply: supply.get(row.location_id) ?? 1 }
    })

    const needs = new Map<string, Partial<Record<NeedCode, number>>>()
    for (const row of needsQ.data ?? []) needs.set(row.person_id, { ...(needs.get(row.person_id) ?? {}), [row.need_code]: Number(row.satisfaction) })
    const relations = new Map<string, PersonRelationship[]>()
    for (const row of relationsQ.data ?? []) {
      relations.set(row.person_id, [...(relations.get(row.person_id) ?? []), {
        id: row.id, personId: row.person_id, otherPersonId: row.other_person_id, relationshipType: row.relationship_type ?? 'acquaintance',
        familiarity: Number(row.familiarity), trust: Number(row.trust), affinity: Number(row.affinity),
        lastInteractionTick: row.last_interaction_tick == null ? null : Number(row.last_interaction_tick),
      }])
    }
    const tenure = new Map<string, Tenure>()
    for (const row of tenanciesQ.data ?? []) if (row.tenure) tenure.set(row.person_id, row.tenure as Tenure)

    const rows = (peopleQ.data ?? []).map((row: any) => {
      const faded = fadeRelationships(relations.get(row.id) ?? [], tick)
      const tiers = relationshipTiers(faded)
      const place = home.get(row.id)
      const actorId = personActor.get(row.id)
      const person: ShadowPerson = {
        id: row.id, locationId: row.current_location_id, dwellingId: place?.tile ?? null,
        tenure: place?.tile ? tenure.get(row.id) ?? 'provided' : 'none',
        wealth: actorId ? balance.get(actorId) ?? 0 : 0, dailyWage: dailyWage.get(row.id) ?? 0,
        needs: needs.get(row.id) ?? {},
        affinity: Object.fromEntries(faded.map((relation) => [relation.otherPersonId, relation.affinity])),
        closeTies: faded.filter((relation) => { const tier = tiers.get(relation.otherPersonId); return tier === 'close' || tier === 'partner' }).map((relation) => relation.otherPersonId),
        lastMoveTick: place?.since ?? null, ticksSinceEviction: null,
      }
      const decision = shadowHousingDecision(person, inventory, tick)
      return {
        tick, person_id: row.id, outcome: decision.outcome, reason: decision.reason,
        target_tile_entity_id: decision.targetDwellingId, gatekeeper_id: decision.gatekeeperId,
        tenure: person.tenure, must_move: decision.mustMove, wants_to_move: decision.wantsToMove,
        affordable_places: decision.affordablePlaces, accessible_places: decision.accessiblePlaces,
        executable: decision.executable, daily_wage: person.dailyWage, wealth: person.wealth,
      }
    })
    if (!rows.length) return { ok: true, decisions: 0 }
    const { error } = await supabase.from('housing_shadow_decisions').upsert(rows, { onConflict: 'person_id,tick', ignoreDuplicates: true })
    if (error) return { ok: false, error: error.message ?? String(error) }
    if (!publicPlacementEnabled()) return { ok: true, decisions: rows.length }
    // Sorted so that two people competing for the last place are resolved the same way every time.
    const stateTiles = new Set(inventory.filter((entry) => entry.dwelling.ownerKind === 'state').map((entry) => entry.dwelling.id))
    const due = rows
      .filter((row: any) => row.outcome === 'granted' && row.must_move && row.tenure === 'none' && row.target_tile_entity_id && stateTiles.has(row.target_tile_entity_id))
      .sort((a: any, b: any) => String(a.person_id).localeCompare(String(b.person_id)))
    let placed = 0
    const placementErrors: string[] = []
    for (const row of due) {
      // The database function checks capacity, location and "no home yet" again, atomically.
      const result = await supabase.rpc('move_person_to_public_housing', { p_person_id: row.person_id, p_tile_entity_id: row.target_tile_entity_id, p_tick: tick })
      if (result.error) placementErrors.push(`${row.person_id}: ${result.error.message ?? String(result.error)}`)
      else placed += 1
    }
    return { ok: true, decisions: rows.length, placed, placementErrors }
  } catch (error: any) {
    return { ok: false, error: error?.message ?? String(error) }
  }
}
