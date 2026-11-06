// lib/game/cognition/dreamRuntime.ts
// Erstellt: 06.11.2026 — Nachtlauf Träume (NOXIA-LIVING-0016, Schritt 2)
// Aktualisiert: 06.11.2026 — Traum färbt die Stimmung (applyDreamAffect), seltene Einsicht (npc_insights)
// Version:      1.1.0
//
// Läuft in jedem Tick nach der Bevölkerung: Wer in diesem Tick schläft und in dieser
// Nacht noch nicht geträumt hat, bekommt einen Traum (dreamForNight). Stoff: eigene
// Begegnungen und Arbeit der letzten 24 Ticks, dazu manchmal eine Meldung der Region.

import type { SupabaseClient } from '@supabase/supabase-js'
import { dreamAffectDelta, dreamForNight, insightFromDream, openProblemFromNeeds, type DreamDayMaterial, type NightDream } from './nightDreams'
import { applyDreamAffect } from '../population/affectRuntime'
import { newsRegionsForLocation } from '../worldNewsFeed'
import { WORLD_AWARENESS_SOURCES } from '../worldAwareness'

const DAY_TICKS = 24

/** Nacht als Datum: 22 Uhr bis 6 Uhr gehören zum Datum des Abends (Berliner Zeit, 12 Stunden zurück). */
export function nightKeyFor(now: Date): string {
  const shifted = new Date(now.getTime() - 12 * 3600000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(shifted)
}

export async function runDreamTick(supabase: SupabaseClient, tick: number, now = new Date()): Promise<{ sleepers: number; dreams: number; remembered: number; insights: number; error: string | null }> {
  const night = nightKeyFor(now)
  const { data: sleepers, error } = await supabase
    .from('people')
    .select('id, traits, public_role, current_location_id, locations:current_location_id(slug)')
    .eq('last_action', 'sleep')
    .eq('last_tick', tick)
  if (error) return { sleepers: 0, dreams: 0, remembered: 0, insights: 0, error: error.message }
  if (!sleepers?.length) return { sleepers: 0, dreams: 0, remembered: 0, insights: 0, error: null }

  const ids = sleepers.map((p: any) => p.id as string)
  const [{ data: dreamt }, { data: memories }, { data: work }, { data: news }, { data: needs }, { data: lastInsights }] = await Promise.all([
    supabase.from('npc_dreams').select('person_id').eq('night', night).in('person_id', ids),
    supabase.from('person_memories').select('person_id, other_person_id, memory_kind, salience, valence').in('person_id', ids).gte('tick', tick - DAY_TICKS),
    supabase.from('population_events').select('actor_person_id').eq('event_type', 'npc_work').in('actor_person_id', ids).gte('tick', tick - DAY_TICKS),
    supabase.from('world_news_items').select('id, title, source_id, region, dream_ok').gte('published_at', new Date(now.getTime() - 48 * 3600000).toISOString()).order('published_at', { ascending: false }).limit(60),
    supabase.from('person_needs').select('person_id, need_code, satisfaction').in('person_id', ids),
    supabase.from('npc_insights').select('person_id, created_at').in('person_id', ids).gte('created_at', new Date(now.getTime() - 8 * 86400000).toISOString()),
  ])
  const lastInsightAt = new Map<string, Date>()
  for (const row of lastInsights ?? []) {
    const at = new Date(String((row as any).created_at))
    const prev = lastInsightAt.get((row as any).person_id)
    if (!prev || at > prev) lastInsightAt.set((row as any).person_id, at)
  }
  const done = new Set((dreamt ?? []).map((r: any) => r.person_id))
  const otherIds = [...new Set((memories ?? []).map((m: any) => m.other_person_id).filter(Boolean))]
  const { data: others } = otherIds.length ? await supabase.from('people').select('id, display_name').in('id', otherIds) : { data: [] as any[] }
  const nameOf = new Map((others ?? []).map((o: any) => [o.id, String(o.display_name)]))
  const worked = new Set((work ?? []).map((w: any) => w.actor_person_id))

  const rows: any[] = []
  const made: Array<{ person: any; dream: NightDream }> = []
  for (const person of sleepers as any[]) {
    if (done.has(person.id)) continue
    const encounters: DreamDayMaterial['encounters'] = []
    const seen = new Set<string>()
    for (const m of (memories ?? []).filter((x: any) => x.person_id === person.id).sort((a: any, b: any) => Number(b.salience) - Number(a.salience))) {
      const name = nameOf.get(m.other_person_id)
      if (!name || seen.has(name)) continue
      seen.add(name)
      const kind = m.memory_kind === 'conflict' ? 'conflict' : m.memory_kind === 'assistance' ? 'assistance' : 'interaction'
      encounters.push({ name, kind, salience: Number(m.salience) || 0, valence: Number(m.valence) || 0 })
    }
    const slug = Array.isArray(person.locations) ? person.locations[0]?.slug : person.locations?.slug
    const regions = newsRegionsForLocation(slug)
    const regional = (news ?? []).filter((n: any) => regions.includes(n.region)).map((n: any) => ({ id: n.id, title: n.title, sourceName: WORLD_AWARENESS_SOURCES.find(src => src.id === n.source_id)?.name ?? n.source_id, dreamOk: Boolean(n.dream_ok) }))
    const role = typeof person.public_role === 'string' ? person.public_role.split('·')[0].trim() : null
    const dream = dreamForNight({ personId: person.id, nightKey: night, traits: person.traits, day: { encounters, workedAs: worked.has(person.id) ? role || 'Arbeit' : null }, news: regional })
    made.push({ person, dream })
    rows.push({ person_id: person.id, night, tick, intensity: dream.intensity, tone: dream.tone, recall: dream.recall, tellable: dream.tellable, motifs: dream.motifs, news_item_id: dream.newsItemId, sources: dream.sources })
  }
  if (rows.length === 0) return { sleepers: sleepers.length, dreams: 0, remembered: 0, insights: 0, error: null }
  const { data: inserted, error: insertError } = await supabase.from('npc_dreams').upsert(rows, { onConflict: 'person_id,night', ignoreDuplicates: true }).select('id, person_id')
  if (insertError) return { sleepers: sleepers.length, dreams: 0, remembered: 0, insights: 0, error: insertError.message }
  const dreamIdOf = new Map((inserted ?? []).map((r: any) => [r.person_id, r.id]))

  // Nur für wirklich neu angelegte Träume: Stimmung färben und das Einsichtstor prüfen.
  let insights = 0
  for (const { person, dream } of made) {
    const dreamId = dreamIdOf.get(person.id)
    if (!dreamId) continue
    await applyDreamAffect(supabase, { personId: person.id, tick, traits: person.traits, delta: dreamAffectDelta(dream) })
    const problem = openProblemFromNeeds((needs ?? []).filter((n: any) => n.person_id === person.id).map((n: any) => ({ needCode: String(n.need_code), satisfaction: Number(n.satisfaction) })))
    const insight = insightFromDream({ dream, problem, traits: person.traits, lastInsightAt: lastInsightAt.get(person.id) ?? null, now })
    if (!insight) continue
    const { error: insightError } = await supabase.from('npc_insights').insert({
      person_id: person.id, dream_id: dreamId, problem_ref: insight.problemRef, inspiration_refs: insight.inspirationRefs,
      hypothesis: insight.hypothesis, confidence: insight.confidence, provenance: insight.provenance, tick,
    })
    if (!insightError) insights += 1
  }
  return { sleepers: sleepers.length, dreams: dreamIdOf.size, remembered: made.filter(m => dreamIdOf.has(m.person.id) && m.dream.recall !== 'none').length, insights, error: null }
}
