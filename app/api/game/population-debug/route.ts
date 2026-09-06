import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

async function authenticated(req: NextRequest) {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(header.slice(7))
  return user ?? null
}

export async function GET(req: NextRequest) {
  const user = await authenticated(req)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const locationSlug = searchParams.get('location') ?? 'mars'
  const { data: location, error: locationError } = await supabase.from('locations').select('id, slug, name, population, population_max, governor_profile_id').eq('slug', locationSlug).maybeSingle()
  if (locationError) return NextResponse.json({ error: locationError.message }, { status: 500 })
  if (!location) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
  if (location.governor_profile_id !== user.id) {
    return NextResponse.json({ error: 'Nur der Gouverneur darf den internen Bevölkerungszustand einsehen' }, { status: 403 })
  }

  const { data: people, error: peopleError } = await supabase
    .from('people')
    .select('id, person_key, display_name, simulation_tier, activity_state, last_action, last_decision_factors, last_tick')
    .eq('current_location_id', location.id)
    .eq('simulation_tier', 'active')
    .order('display_name')
    .limit(50)
  if (peopleError) return NextResponse.json({ error: peopleError.message }, { status: 500 })

  const ids = (people ?? []).map(person => person.id)
  if (ids.length === 0) return NextResponse.json({ location, people: [], recentEvents: [] })

  const [needsResult, assignmentsResult, knowledgeResult, eventsResult] = await Promise.all([
    supabase.from('person_needs').select('person_id, need_code, satisfaction, updated_tick').in('person_id', ids),
    supabase.from('person_assignments').select('person_id, assignment_type, tile_entity_id, role_code, is_active').in('person_id', ids).eq('is_active', true),
    supabase.from('person_knowledge').select('person_id, subject_type, subject_ref, knowledge_type, confidence, learned_tick').in('person_id', ids).order('learned_tick', { ascending: false }),
    supabase.from('population_events').select('tick, event_type, actor_person_id, subject_type, subject_ref, payload').in('actor_person_id', ids).order('tick', { ascending: false }).limit(40),
  ])
  const failure = [needsResult.error, assignmentsResult.error, knowledgeResult.error, eventsResult.error].find(Boolean)
  if (failure) return NextResponse.json({ error: failure.message }, { status: 500 })

  const byPerson = <T extends { person_id: string }>(rows: T[] | null) => {
    const result: Record<string, T[]> = {}
    for (const row of rows ?? []) (result[row.person_id] ??= []).push(row)
    return result
  }
  const needs = byPerson(needsResult.data)
  const assignments = byPerson(assignmentsResult.data)
  const knowledge = byPerson(knowledgeResult.data)

  return NextResponse.json({
    location,
    people: (people ?? []).map(person => ({ ...person, needs: needs[person.id] ?? [], assignments: assignments[person.id] ?? [], knowledge: (knowledge[person.id] ?? []).slice(0, 8) })),
    recentEvents: eventsResult.data ?? [],
  })
}
