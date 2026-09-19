// NOXIA-LIVING — compatibility summary for encounters already persisted by population/engine.
// Persistence and relationship projection are authoritative in runPopulationTick;
// this adapter deliberately performs no second encounter derivation or write.

type SupabaseLike = any

export async function persistPopulationEncounters(supabase: SupabaseLike, tick: number) {
  const { data: events, error } = await supabase
    .from('population_events')
    .select('actor_person_id, related_person_id, payload')
    .eq('tick', tick)
    .eq('event_type', 'social_interaction')

  if (error) {
    return { encounters: 0, events: 0, skipped: true, reason: 'encounter_events_unavailable' }
  }

  const encounterIds = new Set<string>()
  for (const event of events ?? []) {
    const payloadId = typeof event.payload?.encounterId === 'string' ? event.payload.encounterId : null
    const fallback = [event.actor_person_id, event.related_person_id].filter(Boolean).sort().join(':')
    encounterIds.add(payloadId ?? `encounter:${tick}:${fallback}`)
  }

  return {
    encounters: encounterIds.size,
    events: (events ?? []).length,
    skipped: false,
    source: 'population_engine',
  }
}
