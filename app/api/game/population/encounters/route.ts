import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({ error: 'locationId erforderlich.' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: events, error } = await supabase
    .from('population_events')
    .select('id, tick, actor_person_id, related_person_id, location_id, payload, occurred_at')
    .eq('location_id', locationId)
    .eq('event_type', 'social_interaction')
    .order('tick', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ encounters: [], unavailable: true })
  const personIds = [...new Set((events ?? []).flatMap((event: any) => [event.actor_person_id, event.related_person_id]).filter(Boolean))]
  const { data: people } = personIds.length
    ? await supabase.from('people').select('id, display_name, person_key, public_role').in('id', personIds)
    : { data: [] }
  const byId = new Map((people ?? []).map((person: any) => [person.id, person]))

  const seen = new Set<string>()
  const encounters = []
  for (const event of events ?? []) {
    const encounterId = typeof event.payload?.encounterId === 'string' ? event.payload.encounterId : event.id
    if (seen.has(encounterId)) continue
    seen.add(encounterId)
    encounters.push({
      id: encounterId,
      tick: event.tick,
      occurredAt: event.occurred_at,
      tileEntityId: event.payload?.tileEntityId ?? null,
      people: [byId.get(event.actor_person_id), byId.get(event.related_person_id)].filter(Boolean).map((p: any) => ({
        id: p.id, displayName: p.display_name, personKey: p.person_key, publicRole: p.public_role,
      })),
    })
  }
  return NextResponse.json({ encounters })
}
