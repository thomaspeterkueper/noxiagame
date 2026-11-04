import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const id = await verifiedBearerUserId(req)
  if (!id) return NextResponse.json({ error: 'Anmeldung erforderlich' }, { status: 401 })
  const db = createServiceClient()
  const { data: admin, error: adminError } = await db.from('admin_profiles').select('profile_id').eq('profile_id', id).maybeSingle()
  if (adminError || !admin) return NextResponse.json({ error: 'Keine Adminberechtigung' }, { status: 403 })
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const [people, locations, ships, ticks, recentEvents, eventCount] = await Promise.all([
    db.from('people').select('id', { count: 'exact', head: true }),
    db.from('locations').select('id,name,slug,population,population_max,is_supplied,simulate_tick,location_type').order('name').limit(200),
    db.from('ships').select('id', { count: 'exact', head: true }),
    db.from('tick_log').select('tick_number,tick_type,created_at').order('created_at',{ascending:false}).limit(1),
    db.from('population_events').select('id,event_type,occurred_at,location_id').order('occurred_at',{ascending:false}).limit(30),
    db.from('population_events').select('id', { count:'exact',head:true }).gte('occurred_at',since),
  ])
  if ([people,locations,ships,ticks,recentEvents,eventCount].some(r=>r.error)) {
    return NextResponse.json({ error:'Weltdaten teilweise nicht verfügbar' }, { status: 503 })
  }
  const places = locations.data ?? []
  return NextResponse.json({
    measured_at: new Date().toISOString(),
    metrics: {
      npcs: people.count ?? 0,
      locations: places.length,
      ships: ships.count ?? 0,
      population_total: places.reduce((sum,place) => sum + Number(place.population ?? 0),0),
      events_24h: eventCount.count ?? 0,
      last_tick: ticks.data?.[0] ?? null,
    },
    places,
    recent_events: recentEvents.data ?? [],
    note: 'Population_total ist die Summe der Standort-Populationswerte, nicht die Anzahl individueller NPC-Datensätze. Ereignisse sind Metadaten ohne private Payloads.',
  }, { headers: { 'Cache-Control':'private, no-store' } })
}
