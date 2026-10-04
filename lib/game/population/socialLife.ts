import { createHash } from 'crypto'

type SB = any

const RECENT_DECAY = 0.97
const FRIEND_FAMILIARITY = 0.45
const FRIEND_TRUST = 0.56
const FRIEND_AFFINITY = 0.58
const FRIEND_RECENCY = 0.35
const PARTNER_FAMILIARITY = 0.68
const PARTNER_TRUST = 0.64
const PARTNER_AFFINITY = 0.70
const PARTNER_RECENCY = 0.58
const PARTNER_MIN_ENCOUNTERS = 6

// Authoritative social-life time scale. One production tick is one hour, but
// life-course simulation is intentionally compressed for playable timescales.
export const SOCIAL_YEAR_TICKS = 720
const ADULT_AGE_TICKS = 18 * SOCIAL_YEAR_TICKS
const FAMILY_CONSIDER_TICKS = 168
const FAMILY_READY_TICKS = 336
const FAMILY_BIRTH_WAIT_TICKS = 540
const FAMILY_BIRTH_COOLDOWN_TICKS = 720
const MAX_CHILDREN_PER_PARTNERSHIP = 3

const CHILD_FIRST_NAMES = ['Ari', 'Mika', 'Noor', 'Lian', 'Sam', 'Elia', 'Nika', 'Robin', 'Jules', 'Tavi', 'Mara', 'Kian']

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function pair(a: string, b: string): [string, string] {
  return a.localeCompare(b) <= 0 ? [a, b] : [b, a]
}

function pairKey(a: string, b: string) {
  const [first, second] = pair(a, b)
  return `${first}\u0000${second}`
}

function deterministicUuid(seed: string) {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32).split('')
  hex[12] = '5'
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  const value = hex.join('')
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

function hashIndex(seed: string, modulo: number) {
  const value = createHash('sha256').update(seed).digest().readUInt32BE(0)
  return modulo > 0 ? value % modulo : 0
}

function surname(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

function childName(partnershipId: string, tick: number, parentA: string, parentB: string) {
  const first = CHILD_FIRST_NAMES[hashIndex(`${partnershipId}:${tick}:first`, CHILD_FIRST_NAMES.length)]
  const surnames = [surname(parentA), surname(parentB)].filter(Boolean)
  const familyName = surnames.length ? surnames[hashIndex(`${partnershipId}:${tick}:surname`, surnames.length)] : ''
  return [first, familyName].filter(Boolean).join(' ')
}

function relationshipScore(row: any) {
  return (
    Number(row.familiarity ?? 0) * 0.30 +
    Number(row.trust ?? 0) * 0.25 +
    Number(row.affinity ?? 0) * 0.30 +
    Number(row.recent_encounter_score ?? 0) * 0.15
  )
}

function qualifiesFriend(row: any) {
  return Number(row.familiarity) >= FRIEND_FAMILIARITY &&
    Number(row.trust) >= FRIEND_TRUST &&
    Number(row.affinity) >= FRIEND_AFFINITY &&
    Number(row.recent_encounter_score) >= FRIEND_RECENCY
}

function qualifiesPartner(row: any) {
  return Number(row.familiarity) >= PARTNER_FAMILIARITY &&
    Number(row.trust) >= PARTNER_TRUST &&
    Number(row.affinity) >= PARTNER_AFFINITY &&
    Number(row.recent_encounter_score) >= PARTNER_RECENCY &&
    Number(row.encounter_count_total ?? 0) >= PARTNER_MIN_ENCOUNTERS
}

async function createChild(supabase: SB, partnership: any, tick: number, peopleById: Map<string, any>) {
  const parentA = peopleById.get(partnership.person_a_id)
  const parentB = peopleById.get(partnership.person_b_id)
  if (!parentA || !parentB || parentA.current_location_id !== parentB.current_location_id) return null

  const childId = deterministicUuid(`noxia-family-child:${partnership.id}:${tick}`)
  const displayName = childName(partnership.id, tick, parentA.display_name, parentB.display_name)
  const personKey = `family_child:${partnership.id}:${tick}`

  const { data: existing } = await supabase.from('people').select('id').eq('id', childId).maybeSingle()
  if (!existing) {
    const { error: personError } = await supabase.from('people').insert({
      id: childId,
      display_name: displayName,
      current_location_id: parentA.current_location_id,
      simulation_tier: 'background',
      activity_state: 'idle',
      last_action: 'newborn',
      last_decision_factors: { familyBirth: true, partnershipId: partnership.id },
      last_tick: tick,
      person_key: personKey,
      traits: { family_origin: 'born_in_noxia' },
      observable_description: 'Kind',
    })
    if (personError) throw personError

    const { error: lifeError } = await supabase.from('person_life_state').insert({
      person_id: childId,
      life_stage: 'child',
      age_ticks: 0,
      family_desire: 0.5,
      last_family_event_tick: tick,
    })
    if (lifeError) throw lifeError

    const { error: parentError } = await supabase.from('person_parent_child').insert([
      { parent_id: partnership.person_a_id, child_id: childId, partnership_id: partnership.id, created_tick: tick },
      { parent_id: partnership.person_b_id, child_id: childId, partnership_id: partnership.id, created_tick: tick },
    ])
    if (parentError) throw parentError

    const { data: parentHomes } = await supabase
      .from('person_assignments')
      .select('person_id, location_id, tile_entity_id')
      .in('person_id', [partnership.person_a_id, partnership.person_b_id])
      .eq('assignment_type', 'home')
      .eq('is_active', true)
      .limit(2)
    const home = parentHomes?.[0] ?? null
    await supabase.from('person_assignments').insert({
      person_id: childId,
      assignment_type: 'home',
      location_id: parentA.current_location_id,
      tile_entity_id: home?.tile_entity_id ?? null,
      role_code: null,
      starts_tick: tick,
      is_active: true,
    })

    await supabase.from('person_needs').insert([
      { person_id: childId, need_code: 'sustenance', satisfaction: 0.9, updated_tick: tick },
      { person_id: childId, need_code: 'rest', satisfaction: 0.9, updated_tick: tick },
      { person_id: childId, need_code: 'safety', satisfaction: 0.95, updated_tick: tick },
      { person_id: childId, need_code: 'social', satisfaction: 0.9, updated_tick: tick },
      { person_id: childId, need_code: 'purpose', satisfaction: 0.7, updated_tick: tick },
    ])

    await supabase.from('population_events').upsert({
      id: childId,
      tick,
      event_type: 'birth',
      actor_person_id: null,
      related_person_id: childId,
      location_id: parentA.current_location_id,
      subject_type: 'person',
      subject_ref: childId,
      payload: {
        partnershipId: partnership.id,
        parents: [partnership.person_a_id, partnership.person_b_id],
      },
    }, { onConflict: 'id', ignoreDuplicates: true })
  }

  return { id: childId, displayName, locationId: parentA.current_location_id }
}

async function updateFamilyDemand(supabase: SB, tick: number) {
  const [{ data: people }, { data: lifeStates }, { data: locations }] = await Promise.all([
    supabase.from('people').select('id, current_location_id'),
    supabase.from('person_life_state').select('person_id, life_stage, age_ticks'),
    supabase.from('locations').select('id'),
  ])

  const personLocation = new Map<string, string>(
    (people ?? []).map((row: any) => [String(row.id), String(row.current_location_id)] as [string, string]),
  )
  const demand = new Map<string, { a: number; b: number; c: number }>()
  for (const state of lifeStates ?? []) {
    if (state.life_stage !== 'child') continue
    const locationId = personLocation.get(state.person_id)
    if (!locationId) continue
    const years = Math.floor(Number(state.age_ticks ?? 0) / SOCIAL_YEAR_TICKS)
    const bucket = demand.get(locationId) ?? { a: 0, b: 0, c: 0 }
    if (years <= 5) bucket.a += 1
    else if (years <= 11) bucket.b += 1
    else if (years <= 17) bucket.c += 1
    demand.set(locationId, bucket)
  }

  const rows = (locations ?? []).map((location: any) => {
    const counts = demand.get(location.id) ?? { a: 0, b: 0, c: 0 }
    return {
      location_id: location.id,
      children_0_5: counts.a,
      children_6_11: counts.b,
      children_12_17: counts.c,
      kindergarten_slots_needed: counts.a,
      playground_units_needed: Math.ceil((counts.a + counts.b) / 20),
      school_slots_needed: counts.b + counts.c,
      updated_tick: tick,
      updated_at: new Date().toISOString(),
    }
  })

  if (rows.length) {
    const { error } = await supabase.from('location_family_demand').upsert(rows, { onConflict: 'location_id' })
    if (error) throw error
  }
  return rows
}

export async function runSocialLifeTick(supabase: SB, tick: number) {
  const result = { aged: 0, friendships: 0, partnerships: 0, familyReady: 0, births: 0, demandLocations: 0 }

  const [{ data: people }, { data: lifeRows }, { data: relationRows }, { data: partnershipRows }, { data: locations }] = await Promise.all([
    supabase.from('people').select('id, display_name, current_location_id'),
    supabase.from('person_life_state').select('*'),
    supabase.from('person_relationships').select('*'),
    supabase.from('person_partnerships').select('*').eq('status', 'active'),
    supabase.from('locations').select('id, is_supplied, population, population_max'),
  ])

  const peopleById = new Map<string, any>((people ?? []).map((row: any) => [String(row.id), row] as [string, any]))
  const lifeById = new Map<string, any>((lifeRows ?? []).map((row: any) => [String(row.person_id), row] as [string, any]))
  const locationById = new Map<string, any>((locations ?? []).map((row: any) => [String(row.id), row] as [string, any]))

  const missingLifeRows = (people ?? []).filter((person: any) => !lifeById.has(person.id)).map((person: any) => ({
    person_id: person.id,
    life_stage: 'adult',
    age_ticks: 0,
    family_desire: 0.5,
  }))
  if (missingLifeRows.length) {
    await supabase.from('person_life_state').insert(missingLifeRows)
    for (const row of missingLifeRows) lifeById.set(row.person_id, row)
  }

  const agedRows: any[] = []
  for (const state of lifeById.values()) {
    if (state.life_stage !== 'child') continue
    const ageTicks = Number(state.age_ticks ?? 0) + 1
    agedRows.push({
      person_id: state.person_id,
      life_stage: ageTicks >= ADULT_AGE_TICKS ? 'adult' : 'child',
      age_ticks: ageTicks,
      family_desire: Number(state.family_desire ?? 0.5),
      last_family_event_tick: state.last_family_event_tick ?? null,
      updated_at: new Date().toISOString(),
    })
  }
  if (agedRows.length) {
    const { error } = await supabase.from('person_life_state').upsert(agedRows, { onConflict: 'person_id' })
    if (error) throw error
    result.aged = agedRows.length
    for (const row of agedRows) lifeById.set(row.person_id, row)
  }

  const relationByDirection = new Map<string, any>()
  for (const relation of relationRows ?? []) {
    relation.recent_encounter_score = clamp01(Number(relation.recent_encounter_score ?? 0) * RECENT_DECAY)
    relationByDirection.set(`${relation.person_id}\u0000${relation.other_person_id}`, relation)
  }

  const friendshipUpdates: any[] = []
  for (const relation of relationByDirection.values()) {
    const nextType = relation.relationship_type === 'partner'
      ? 'partner'
      : qualifiesFriend(relation)
        ? 'friend'
        : relation.relationship_type || 'acquaintance'
    if (nextType !== relation.relationship_type) result.friendships += nextType === 'friend' ? 1 : 0
    friendshipUpdates.push({
      id: relation.id,
      person_id: relation.person_id,
      other_person_id: relation.other_person_id,
      relationship_type: nextType,
      familiarity: Number(relation.familiarity),
      trust: Number(relation.trust),
      affinity: Number(relation.affinity),
      last_interaction_tick: relation.last_interaction_tick,
      encounter_count_total: Number(relation.encounter_count_total ?? 0),
      recent_encounter_score: Number(relation.recent_encounter_score),
      relationship_updated_tick: tick,
      updated_at: new Date().toISOString(),
    })
    relation.relationship_type = nextType
  }
  if (friendshipUpdates.length) await supabase.from('person_relationships').upsert(friendshipUpdates, { onConflict: 'person_id,other_person_id' })

  const activePartnerByPerson = new Map<string, any>()
  for (const partnership of partnershipRows ?? []) {
    activePartnerByPerson.set(partnership.person_a_id, partnership)
    activePartnerByPerson.set(partnership.person_b_id, partnership)
  }

  const candidates: Array<{ a: string; b: string; score: number }> = []
  const seenPairs = new Set<string>()
  for (const relation of relationByDirection.values()) {
    const key = pairKey(relation.person_id, relation.other_person_id)
    if (seenPairs.has(key)) continue
    seenPairs.add(key)
    const reciprocal = relationByDirection.get(`${relation.other_person_id}\u0000${relation.person_id}`)
    if (!reciprocal || !qualifiesPartner(relation) || !qualifiesPartner(reciprocal)) continue
    const aLife = lifeById.get(relation.person_id)
    const bLife = lifeById.get(relation.other_person_id)
    if (aLife?.life_stage !== 'adult' || bLife?.life_stage !== 'adult') continue
    const [a, b] = pair(relation.person_id, relation.other_person_id)
    candidates.push({ a, b, score: relationshipScore(relation) + relationshipScore(reciprocal) })
  }
  candidates.sort((x, y) => y.score - x.score || x.a.localeCompare(y.a) || x.b.localeCompare(y.b))

  const newlyCreated: any[] = []
  for (const candidate of candidates) {
    if (activePartnerByPerson.has(candidate.a) || activePartnerByPerson.has(candidate.b)) continue
    const { data: partnership, error } = await supabase.from('person_partnerships').upsert({
      person_a_id: candidate.a,
      person_b_id: candidate.b,
      status: 'active',
      established_tick: tick,
      family_intent: 'undecided',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'person_a_id,person_b_id' }).select('*').single()
    if (error) throw error
    activePartnerByPerson.set(candidate.a, partnership)
    activePartnerByPerson.set(candidate.b, partnership)
    newlyCreated.push(partnership)
    result.partnerships += 1
    await supabase.from('person_relationships').update({ relationship_type: 'partner', relationship_updated_tick: tick }).in('person_id', [candidate.a, candidate.b]).in('other_person_id', [candidate.a, candidate.b])
  }

  const partnerships = [...(partnershipRows ?? []), ...newlyCreated]
  for (const partnership of partnerships) {
    const a = peopleById.get(partnership.person_a_id)
    const b = peopleById.get(partnership.person_b_id)
    const aLife = lifeById.get(partnership.person_a_id)
    const bLife = lifeById.get(partnership.person_b_id)
    if (!a || !b || a.current_location_id !== b.current_location_id) continue
    if (aLife?.life_stage !== 'adult' || bLife?.life_stage !== 'adult') continue

    const location = locationById.get(a.current_location_id)
    if (!location?.is_supplied || Number(location.population ?? 0) >= Number(location.population_max ?? 0)) continue

    const ab = relationByDirection.get(`${partnership.person_a_id}\u0000${partnership.person_b_id}`)
    const ba = relationByDirection.get(`${partnership.person_b_id}\u0000${partnership.person_a_id}`)
    const stable = ab && ba &&
      Number(ab.trust) >= PARTNER_TRUST && Number(ba.trust) >= PARTNER_TRUST &&
      Number(ab.affinity) >= PARTNER_AFFINITY && Number(ba.affinity) >= PARTNER_AFFINITY &&
      Number(ab.recent_encounter_score) >= FRIEND_RECENCY && Number(ba.recent_encounter_score) >= FRIEND_RECENCY
    if (!stable) continue

    const desire = Math.min(Number(aLife.family_desire ?? 0.5), Number(bLife.family_desire ?? 0.5))
    const age = tick - Number(partnership.established_tick ?? tick)
    let intent = partnership.family_intent
    let intentTick = partnership.family_intent_updated_tick == null ? null : Number(partnership.family_intent_updated_tick)

    if (desire >= 0.62 && age >= FAMILY_CONSIDER_TICKS && intent === 'undecided') {
      intent = 'considering'
      intentTick = tick
      await supabase.from('person_partnerships').update({ family_intent: intent, family_intent_updated_tick: tick, updated_at: new Date().toISOString() }).eq('id', partnership.id)
    }
    if (desire >= 0.68 && age >= FAMILY_READY_TICKS && intent === 'considering' && tick - Number(intentTick ?? tick) >= FAMILY_CONSIDER_TICKS) {
      intent = 'ready'
      intentTick = tick
      result.familyReady += 1
      await supabase.from('person_partnerships').update({ family_intent: intent, family_intent_updated_tick: tick, updated_at: new Date().toISOString() }).eq('id', partnership.id)
    }
    if (intent !== 'ready' || tick - Number(intentTick ?? tick) < FAMILY_BIRTH_WAIT_TICKS) continue
    if (partnership.last_birth_tick != null && tick - Number(partnership.last_birth_tick) < FAMILY_BIRTH_COOLDOWN_TICKS) continue

    const { count } = await supabase.from('person_parent_child').select('child_id', { count: 'exact', head: true }).eq('partnership_id', partnership.id)
    if (Number(count ?? 0) >= MAX_CHILDREN_PER_PARTNERSHIP) {
      await supabase.from('person_partnerships').update({ family_intent: 'paused', updated_at: new Date().toISOString() }).eq('id', partnership.id)
      continue
    }

    const child = await createChild(supabase, partnership, tick, peopleById)
    if (!child) continue
    result.births += 1
    peopleById.set(child.id, { id: child.id, display_name: child.displayName, current_location_id: child.locationId })
    await supabase.from('person_partnerships').update({
      last_birth_tick: tick,
      family_intent: 'considering',
      family_intent_updated_tick: tick,
      updated_at: new Date().toISOString(),
    }).eq('id', partnership.id)
    await supabase.from('person_life_state').update({ last_family_event_tick: tick, updated_at: new Date().toISOString() }).in('person_id', [partnership.person_a_id, partnership.person_b_id])
  }

  const demandRows = await updateFamilyDemand(supabase, tick)
  result.demandLocations = demandRows.length
  return result
}
