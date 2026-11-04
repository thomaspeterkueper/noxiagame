import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const actor = await verifiedBearerUserId(req)
  if (!actor) return NextResponse.json({ error: 'Anmeldung erforderlich' }, { status: 401 })
  const db = createServiceClient()
  const { data: admin, error: authError } = await db.from('admin_profiles')
    .select('profile_id').eq('profile_id', actor).maybeSingle()
  if (authError || !admin) return NextResponse.json({ error: 'Keine Adminberechtigung' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    const { data, count, error } = await db.from('people')
      .select('id,display_name,bio_short,public_role,simulation_tier,activity_state,last_action,last_tick', { count: 'exact' })
      .order('display_name').limit(200)
    if (error) return NextResponse.json({ error: 'NPC-Liste nicht verfügbar' }, { status: 503 })
    return NextResponse.json({ people: data ?? [], total: count ?? null, page_limit: 200 }, { headers: { 'Cache-Control': 'private, no-store' } })
  }

  if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Ungültige NPC-ID' }, { status: 400 })
  }
  const [
    person, health, needs, affect, cognition,
    relationships, memories, conversations, events,
  ] = await Promise.all([
    db.from('people').select('id,display_name,bio_short,public_role,simulation_tier,activity_state,last_action,last_tick,birth_year').eq('id', id).maybeSingle(),
    db.from('person_health').select('wellbeing,condition_code,severity,requires_medical_care,updated_at').eq('person_id', id).maybeSingle(),
    db.from('person_needs').select('need_code,satisfaction,updated_at').eq('person_id', id).limit(30),
    db.from('person_affect').select('joy,fear,anger,sadness,mood,pain,updated_at').eq('person_id', id).maybeSingle(),
    db.from('person_cognitive_state').select('mode,compute_tier,trigger_score,updated_at').eq('person_id', id).maybeSingle(),
    db.from('person_relationships').select('other_person_id,relationship_type,familiarity,trust,affinity,encounter_count_total').eq('person_id', id).limit(50),
    db.from('person_memories').select('id,memory_kind,salience,valence,tick,created_at').eq('person_id', id).order('created_at', { ascending: false }).limit(50),
    db.from('npc_conversation_log').select('id,created_at,location_name,topic,outcome,world_action').eq('npc_person_id', id).order('created_at', { ascending: false }).limit(30),
    db.from('population_events').select('id,event_type,occurred_at').eq('actor_person_id', id).order('occurred_at', { ascending: false }).limit(40),
  ])
  if (person.error || !person.data) return NextResponse.json({ error: 'NPC nicht gefunden' }, { status: 404 })
  const failed = [health, needs, affect, cognition, relationships, memories, conversations, events].some(r => r.error)
  // No raw player dialogue, private memories, or unrestricted event payloads.
  return NextResponse.json({
    person: person.data,
    health: health.data ?? null,
    needs: needs.data ?? [],
    affect: affect.data ?? null,
    cognition: cognition.data ?? null,
    relationships: relationships.data ?? [],
    memories: memories.data ?? [],
    conversations: conversations.data ?? [],
    events: events.data ?? [],
    partial: failed,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
