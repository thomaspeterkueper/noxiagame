// lib/research/colony/liveExport.ts
// Read-only projection of the live NOXIA population into the research-run formats.
// No mutation is performed. Physical assignment tiles stay untouched; market job ids
// are separate so multiple roles at the same workplace remain distinct.

import type { ColonySnapshot } from './colonyRun'
import type { MarketSetup, MarketJob, MarketEmployer } from './colonyMarket'
import type { Dwelling } from '../../game/population/housing'

type SupabaseLike = any

export interface LiveColonyExport {
  snapshot: ColonySnapshot
  market: MarketSetup
  diagnostics: {
    tick: number
    people: number
    dwellings: number
    transientPlaces: number
    jobs: number
    employers: number
    openJobPositions: number
    marketRentalsWithTerms: number
    privateHousingWithoutTerms: number
    publicEmployersWithObservedIncome: number
  }
}

const asNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const required = <T>(data: T | null, error: any, label: string): T => {
  if (error) throw new Error(`${label}: ${error.message ?? String(error)}`)
  return data as T
}

function employerKind(kind: string | null | undefined): 'state' | 'company' | 'person' {
  if (kind === 'institution') return 'state'
  if (kind === 'npc_person') return 'person'
  return 'company'
}

function jobKey(row: any): string {
  return ['job', row.location_id, row.tile_entity_id ?? 'unlocated', row.employer_actor_id ?? 'none', row.role_code ?? 'resident'].join(':')
}

export async function exportLiveColonyMarket(supabase: SupabaseLike): Promise<LiveColonyExport> {
  const [
    peopleQ, needsQ, assignmentsQ, relationshipsQ, skillsQ, locationsQ,
    occupancyQ, tenanciesQ, wagesQ, personActorsQ, profileActorsQ, actorsQ,
    ledgerQ, tickQ,
  ] = await Promise.all([
    supabase.from('people').select('id,person_key,current_location_id,traits').order('id'),
    supabase.from('person_needs').select('person_id,need_code,satisfaction').order('person_id'),
    supabase.from('person_assignments').select('id,person_id,assignment_type,location_id,tile_entity_id,employer_actor_id,role_code,is_active').eq('is_active', true).order('person_id'),
    supabase.from('person_relationships').select('person_id,other_person_id,familiarity,trust,affinity,last_interaction_tick,relationship_type').order('person_id'),
    supabase.from('person_skills').select('person_id,skill_code,level').order('person_id'),
    supabase.from('locations').select('id,slug,is_supplied').order('id'),
    supabase.from('residential_occupancy').select('tile_entity_id,location_id,entity_id,owner_class,residential_capacity,transient_capacity,residents,free_places'),
    supabase.from('person_tenancies').select('person_id,tile_entity_id,landlord_actor_id,rent_per_billing,status,origin,tenure'),
    supabase.from('role_wage_rates').select('role_code,daily_credits'),
    supabase.from('person_economic_actors').select('person_id,actor_id'),
    supabase.from('profile_economic_actors').select('profile_id,actor_id'),
    supabase.from('actors').select('id,kind,founded_by'),
    supabase.from('npc_ledger').select('actor_id,tick,kind,credit_delta,ref'),
    supabase.from('tick_log').select('tick_number').order('tick_number', { ascending: false }).limit(1).maybeSingle(),
  ])

  const people = required<any[]>(peopleQ.data ?? [], peopleQ.error, 'people')
  const needs = required<any[]>(needsQ.data ?? [], needsQ.error, 'person_needs')
  const assignments = required<any[]>(assignmentsQ.data ?? [], assignmentsQ.error, 'person_assignments')
  const relationships = required<any[]>(relationshipsQ.data ?? [], relationshipsQ.error, 'person_relationships')
  const skills = required<any[]>(skillsQ.data ?? [], skillsQ.error, 'person_skills')
  const locations = required<any[]>(locationsQ.data ?? [], locationsQ.error, 'locations')
  const occupancy = required<any[]>(occupancyQ.data ?? [], occupancyQ.error, 'residential_occupancy')
  const tenancies = required<any[]>(tenanciesQ.data ?? [], tenanciesQ.error, 'person_tenancies')
  const wages = required<any[]>(wagesQ.data ?? [], wagesQ.error, 'role_wage_rates')
  const personActors = required<any[]>(personActorsQ.data ?? [], personActorsQ.error, 'person_economic_actors')
  const profileActors = required<any[]>(profileActorsQ.data ?? [], profileActorsQ.error, 'profile_economic_actors')
  const actors = required<any[]>(actorsQ.data ?? [], actorsQ.error, 'actors')
  const ledger = required<any[]>(ledgerQ.data ?? [], ledgerQ.error, 'npc_ledger')
  const tickRow = required<any>(tickQ.data, tickQ.error, 'tick_log')
  const tick = asNumber(tickRow?.tick_number)

  const needByPerson = new Map<string, Record<string, number>>()
  for (const row of needs) {
    const current = needByPerson.get(row.person_id) ?? {}
    current[row.need_code] = asNumber(row.satisfaction, 1)
    needByPerson.set(row.person_id, current)
  }

  const assignmentByPerson = new Map<string, any[]>()
  for (const row of assignments) {
    const rows = assignmentByPerson.get(row.person_id) ?? []
    rows.push(row)
    assignmentByPerson.set(row.person_id, rows)
  }

  const skillByPerson = new Map<string, Record<string, number>>()
  for (const row of skills) {
    const current = skillByPerson.get(row.person_id) ?? {}
    current[row.skill_code] = asNumber(row.level)
    skillByPerson.set(row.person_id, current)
  }

  const wageByRole = new Map(wages.map((row) => [row.role_code, asNumber(row.daily_credits, 60)]))
  const actorById = new Map(actors.map((row) => [row.id, row]))
  const profileActor = new Map(profileActors.map((row) => [row.profile_id, row.actor_id]))
  const personActor = new Map(personActors.map((row) => [row.person_id, row.actor_id]))

  const balanceByActor = new Map<string, number>()
  for (const row of ledger) balanceByActor.set(row.actor_id, (balanceByActor.get(row.actor_id) ?? 0) + asNumber(row.credit_delta))

  // Observed recurring inflow only. Bootstrap/endowment and player capital injections
  // are deliberately excluded; absent history therefore exports dailyIncome = 0.
  const observedIncomeByActor = new Map<string, number>()
  const horizon = Math.max(0, tick - 30 * 24)
  for (const row of ledger) {
    const ref = String(row.ref ?? '')
    const delta = asNumber(row.credit_delta)
    if (asNumber(row.tick) < horizon || delta <= 0 || row.kind !== 'income') continue
    if (ref.startsWith('bootstrap:') || ref.startsWith('profile_funding:')) continue
    observedIncomeByActor.set(row.actor_id, (observedIncomeByActor.get(row.actor_id) ?? 0) + delta)
  }

  const tenantByTile = new Map<string, any[]>()
  for (const row of tenancies) {
    if (!row.tile_entity_id) continue
    const rows = tenantByTile.get(row.tile_entity_id) ?? []
    rows.push(row)
    tenantByTile.set(row.tile_entity_id, rows)
  }

  // Need owner columns not exposed by residential_occupancy.
  const tileIds = occupancy.map((row) => row.tile_entity_id).filter(Boolean)
  let tileRows: any[] = []
  if (tileIds.length) {
    const q = await supabase.from('tile_entities').select('id,actor_id,profile_id,asking_price,lease_price').in('id', tileIds)
    tileRows = required<any[]>(q.data ?? [], q.error, 'tile_entities')
  }
  const tileById = new Map(tileRows.map((row) => [row.id, row]))

  const dwellings: Dwelling[] = []
  let transientPlaces = 0
  let marketRentalsWithTerms = 0
  let privateHousingWithoutTerms = 0

  for (const row of occupancy) {
    const tile = tileById.get(row.tile_entity_id) ?? {}
    const tenantRows = tenantByTile.get(row.tile_entity_id) ?? []
    const stateOwned = row.owner_class === 'STATE'
    const landlordActor = tenantRows.find((entry) => entry.landlord_actor_id)?.landlord_actor_id
      ?? tile.actor_id
      ?? (tile.profile_id ? profileActor.get(tile.profile_id) : null)
      ?? (stateOwned ? `state:${row.location_id}` : `landlord:${row.tile_entity_id}`)
    const marketRent = tenantRows
      .filter((entry) => entry.origin === 'market' && entry.status === 'active')
      .map((entry) => entry.rent_per_billing)
      .find((value) => value != null)
    const askingPrice = tile.asking_price == null ? null : asNumber(tile.asking_price)
    const leasePrice = tile.lease_price == null ? null : asNumber(tile.lease_price)
    // Existing backfill rent terms never define a market offer. A live market
    // tenancy may carry its agreed rent; otherwise lease_price is the offer.
    const rent = stateOwned ? 0 : marketRent == null ? leasePrice : asNumber(marketRent)
    if (!stateOwned && rent != null) marketRentalsWithTerms += 1
    if (!stateOwned && rent == null && askingPrice == null) privateHousingWithoutTerms += 1

    dwellings.push({
      id: row.tile_entity_id,
      locationId: row.location_id,
      tileEntityId: row.tile_entity_id,
      kind: askingPrice != null ? 'house' : 'rental',
      capacity: asNumber(row.residential_capacity),
      ownerKind: stateOwned ? 'state' : 'landlord',
      ownerId: landlordActor,
      rent,
      baseRent: rent,
      askingPrice,
      nightlyRate: null,
    })

    const transient = asNumber(row.transient_capacity)
    if (transient > 0) {
      transientPlaces += transient
      dwellings.push({
        id: `transient:${row.tile_entity_id}`,
        locationId: row.location_id,
        tileEntityId: null,
        kind: 'hotel',
        capacity: transient,
        ownerKind: stateOwned ? 'state' : 'landlord',
        ownerId: landlordActor,
        rent: null,
        baseRent: null,
        askingPrice: null,
        // State minimum shelter is free for now; commercial hotels will carry rates later.
        nightlyRate: stateOwned ? 0 : null,
      })
    }
  }

  const workAssignments = assignments.filter((row) => row.assignment_type === 'work')
  const jobGroups = new Map<string, any[]>()
  for (const row of workAssignments) {
    const key = jobKey(row)
    const rows = jobGroups.get(key) ?? []
    rows.push(row)
    jobGroups.set(key, rows)
  }

  const jobs: MarketJob[] = []
  const personJobId = new Map<string, string>()
  for (const [id, rows] of [...jobGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sample = rows[0]
    const roleCode = sample.role_code ?? 'resident'
    const actor = actorById.get(sample.employer_actor_id)
    jobs.push({
      id,
      tileEntityId: sample.tile_entity_id ?? null,
      locationId: sample.location_id,
      employerId: sample.employer_actor_id ?? `employer:${sample.location_id}`,
      employerKind: employerKind(actor?.kind),
      roleCode,
      dailyWage: wageByRole.get(roleCode) ?? 60,
      // Live has no vacancy capacity yet. Export only the occupied slots that exist.
      positions: rows.length,
      requiredSkill: null,
    })
    for (const row of rows) personJobId.set(row.person_id, id)
  }

  const homeByPerson = new Map<string, string | null>()
  for (const row of assignments.filter((entry) => entry.assignment_type === 'home')) {
    homeByPerson.set(row.person_id, row.tile_entity_id ?? null)
  }

  const peopleMarket: NonNullable<MarketSetup['people']> = {}
  for (const person of people) {
    const actorId = personActor.get(person.id)
    peopleMarket[person.id] = {
      wealth: actorId ? balanceByActor.get(actorId) ?? 0 : 0,
      skills: skillByPerson.get(person.id) ?? {},
      dwellingId: homeByPerson.get(person.id) ?? null,
      jobId: personJobId.get(person.id) ?? null,
    }
  }

  const employerIds = [...new Set(jobs.map((job) => job.employerId))]
  const employers: Record<string, MarketEmployer> = {}
  for (const actorId of employerIds) {
    employers[actorId] = {
      balance: balanceByActor.get(actorId) ?? 0,
      dailyIncome: Math.round(((observedIncomeByActor.get(actorId) ?? 0) / 30) * 100) / 100,
    }
  }

  const snapshot: ColonySnapshot = {
    tick,
    people: people.map((person) => ({
      id: person.id,
      named: Boolean(person.person_key),
      locationId: person.current_location_id,
      traits: person.traits ?? null,
      needs: needByPerson.get(person.id) ?? null,
      assignments: (assignmentByPerson.get(person.id) ?? []).map((row) => ({
        type: row.assignment_type,
        locationId: row.location_id,
        tileEntityId: row.tile_entity_id ?? null,
      })),
    })),
    relationships: relationships.map((row) => ({
      personId: row.person_id,
      otherPersonId: row.other_person_id,
      familiarity: asNumber(row.familiarity),
      trust: asNumber(row.trust, 0.5),
      affinity: asNumber(row.affinity, 0.5),
      lastInteractionTick: row.last_interaction_tick == null ? null : asNumber(row.last_interaction_tick),
      relationshipType: row.relationship_type ?? null,
    })),
    supply: Object.fromEntries(locations.map((location) => [location.id, location.is_supplied === false ? 0.4 : 1])),
  }

  const market: MarketSetup = {
    dwellings,
    jobs,
    people: peopleMarket,
    employers,
  }

  return {
    snapshot,
    market,
    diagnostics: {
      tick,
      people: people.length,
      dwellings: dwellings.length,
      transientPlaces,
      jobs: jobs.length,
      employers: employerIds.length,
      openJobPositions: 0,
      marketRentalsWithTerms,
      privateHousingWithoutTerms,
      publicEmployersWithObservedIncome: employerIds.filter((id) => employerKind(actorById.get(id)?.kind) === 'state' && (observedIncomeByActor.get(id) ?? 0) > 0).length,
    },
  }
}
