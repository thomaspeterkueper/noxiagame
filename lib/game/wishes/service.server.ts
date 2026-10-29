// lib/game/wishes/service.server.ts
// Wünsche annehmen, einordnen, bündeln und – wenn sinnvoll – gleich erfüllen.
// Regeln: lib/game/wishes/rules.ts. Erfüllen kann das Spiel heute selbst:
// - gemeinschaft: eine Zusammenkunft am Ort des Wunsches (Sondertermin mit Gastgeber)
// - versorgung: eine Lieferung an einen Ort, wenn dort wirklich Mangel ist
// Alles andere Sinnvolle und Getragene geht als „in Arbeit“ an die Entwicklung.

import { REAL_PLACE_HOSTS, hostWindowsAt, resolveHostPlace, type RealPlaceHost } from '@/lib/game/population/realPlaceActivity'
import { clockHour, clockTick } from '@/lib/game/gameClock'
import { assessWish } from './classify.server'
import { decideWish, HELP_LINE, SUPPORT_NEEDED, SUPPORT_WINDOW_TICKS, type WishAssessment, type WishChannel, type WishStatus } from './rules'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

export interface WishInput {
  source: 'player' | 'npc'
  profileId?: string | null
  personId?: string | null
  locationSlug?: string | null
  channel: WishChannel
  placeRef?: string | null
  placeName?: string | null
  tradition?: string | null
  text: string
}

export interface WishResult { id: string; status: WishStatus; /** Nur bei einer Notlage: Hinweis auf Hilfe. */ help?: string }

async function currentTick(supabase: Supabase) {
  const { data } = await supabase.from('tick_log').select('tick_number').order('tick_number', { ascending: false }).limit(1).maybeSingle()
  return Number(data?.tick_number ?? 0)
}

/** Feste Bündel für Versorgung und Zusammenkunft; sonst der Schlüssel der Einordnung. */
function clusterFor(a: WishAssessment, input: WishInput) {
  if (a.category === 'versorgung' && a.resource) return `versorgung-${a.resource}-${input.locationSlug ?? 'ort'}`
  if (a.category === 'gemeinschaft' && input.placeRef) return `gemeinschaft-${input.placeRef}`
  return a.clusterKey
}

/** Wie viele verschiedene Menschen (Spieler und Figuren) tragen dieses Bündel? */
async function supportOf(supabase: Supabase, clusterKey: string, tick: number) {
  const { data } = await supabase.from('wishes').select('profile_id,person_id')
    .eq('cluster_key', clusterKey).not('status', 'in', '(privat,abgelehnt)').gte('tick', tick - SUPPORT_WINDOW_TICKS)
  return new Set(((data ?? []) as Array<{ profile_id: string | null; person_id: string | null }>).map(row => row.profile_id ?? row.person_id).filter(Boolean)).size
}

/** Einen Wunsch annehmen: speichern, einordnen, entscheiden, gegebenenfalls erfüllen. */
export async function submitWish(supabase: Supabase, input: WishInput): Promise<WishResult> {
  const text = input.text.replace(/\s+/g, ' ').trim().slice(0, 400)
  const tick = await currentTick(supabase)
  const { data: location } = input.locationSlug ? await supabase.from('locations').select('id').eq('slug', input.locationSlug).maybeSingle() : { data: null }
  const { data: row, error } = await supabase.from('wishes').insert({
    tick, source: input.source, profile_id: input.profileId ?? null, person_id: input.personId ?? null,
    location_id: location?.id ?? null, channel: input.channel, place_ref: input.placeRef ?? null,
    place_name: input.placeName ?? null, tradition: input.tradition ?? null, text, status: 'neu',
  }).select('id').single()
  if (error || !row) throw new Error(error?.message ?? 'Wunsch konnte nicht gespeichert werden')
  const status = await evaluateWish(supabase, String(row.id), tick)
  return { id: String(row.id), status: status.status, ...(status.assessment?.distress ? { help: HELP_LINE } : {}) }
}

type WishRow = { id: string; tick: number; source: 'player' | 'npc'; profile_id: string | null; person_id: string | null; location_id: string | null; channel: WishChannel; place_ref: string | null; place_name: string | null; tradition: string | null; text: string; status: WishStatus; category: string | null; cluster_key: string | null; summary: string | null; assessment: Record<string, unknown> }

/** Einordnen und entscheiden (auch erneut, z. B. wenn ein Bündel Unterstützung gewonnen hat). */
export async function evaluateWish(supabase: Supabase, id: string, tick: number, options: { reuse?: boolean; /** Admin: Unterstützung gilt als erreicht. */ force?: boolean } = {}): Promise<{ status: WishStatus; assessment: WishAssessment | null }> {
  const { data: row } = await supabase.from('wishes').select('*').eq('id', id).maybeSingle()
  if (!row) return { status: 'neu', assessment: null }
  const wish = row as WishRow
  const { data: location } = wish.location_id ? await supabase.from('locations').select('slug').eq('id', wish.location_id).maybeSingle() : { data: null }
  const input: WishInput = { source: wish.source, profileId: wish.profile_id, personId: wish.person_id, locationSlug: location?.slug ?? null, channel: wish.channel, placeRef: wish.place_ref, placeName: wish.place_name, tradition: wish.tradition, text: wish.text }
  const assessment = options.reuse && wish.assessment && typeof wish.assessment.category === 'string'
    ? wish.assessment as unknown as WishAssessment
    : await assessWish(wish.text, { place: wish.place_name, location: input.locationSlug })
  const clusterKey = clusterFor(assessment, input)
  // Erst mit Schlüssel speichern, damit dieser Wunsch selbst mitzählt.
  await supabase.from('wishes').update({ category: assessment.category, summary: assessment.summary, cluster_key: clusterKey, sense: assessment.sense, assessment, updated_at: new Date().toISOString() }).eq('id', id)
  const support = options.force ? Math.max(SUPPORT_NEEDED, await supportOf(supabase, clusterKey, tick)) : await supportOf(supabase, clusterKey, tick)
  let decision = decideWish(assessment, support)
  let fulfilment: Record<string, unknown> | null = null
  if (decision.status === 'erfuellt') {
    const done = await fulfil(supabase, { ...wish, cluster_key: clusterKey }, assessment, input, tick)
    if (done.ok) fulfilment = done.fulfilment
    else decision = { status: done.status ?? 'sammelt', reason: done.reason }
  }
  const now = new Date().toISOString()
  await supabase.from('wishes').update({
    status: decision.status, reason: decision.reason, decided_by: 'spiel', decided_at: now,
    ...(fulfilment ? { fulfilment, fulfilled_at: now } : {}), updated_at: now,
  }).eq('id', id)
  // Ein großes Bündel ist jetzt getragen: die wartenden Wünsche darin gelten mit.
  if (fulfilment || decision.status === 'in_arbeit') {
    await supabase.from('wishes').update({
      status: decision.status, reason: `${decision.reason} (gemeinsam mit weiteren Wünschen)`, decided_by: 'spiel', decided_at: now,
      ...(fulfilment ? { fulfilment: { ...fulfilment, via: id }, fulfilled_at: now } : {}), updated_at: now,
    }).eq('cluster_key', clusterKey).eq('status', 'sammelt')
  }
  return { status: decision.status, assessment }
}

// ── Erfüllen ──────────────────────────────────────────────────────────

type Fulfilment = { ok: true; fulfilment: Record<string, unknown> } | { ok: false; reason: string; status?: WishStatus }

async function fulfil(supabase: Supabase, wish: WishRow, a: WishAssessment, input: WishInput, tick: number): Promise<Fulfilment> {
  if (a.category === 'gemeinschaft') return gathering(supabase, wish, a, tick)
  if (a.category === 'versorgung') return delivery(supabase, wish, a, input, tick)
  return { ok: false, reason: 'braucht Entwicklung', status: 'in_arbeit' }
}

/** Gastgeber, dessen Ort zum Ort des Wunsches passt (OSM-Kennung oder Spielgebäude). */
async function hostForPlace(supabase: Supabase, placeRef: string): Promise<{ spec: RealPlaceHost; personId: string; locationId: string } | null> {
  const { data: hosts } = await supabase.from('people').select('id,person_key,current_location_id').in('person_key', REAL_PLACE_HOSTS.map(host => host.personKey))
  for (const spec of REAL_PLACE_HOSTS) {
    const host = (hosts ?? []).find((row: { person_key: string }) => row.person_key === spec.personKey)
    if (!host) continue
    const place = await resolveHostPlace(supabase, { id: String(host.id), current_location_id: String(host.current_location_id) }, spec.place)
    if (!place) continue
    let refs: string[] = []
    if (place.regionFeatureId) {
      const { data } = await supabase.from('region_features').select('properties').eq('id', place.regionFeatureId).maybeSingle()
      refs = [`region_feature:${place.regionFeatureId}`, String((data?.properties as Record<string, unknown> | null)?.noxia_source_id ?? '')]
    } else {
      const { data } = await supabase.from('tile_entities').select('source_ref').eq('id', place.tileEntityId).maybeSingle()
      refs = [`tile_entity:${place.tileEntityId}`, String(data?.source_ref ?? '')]
    }
    if (refs.includes(placeRef)) return { spec, personId: String(host.id), locationId: String(host.current_location_id) }
  }
  return null
}

/**
 * Zusammenkunft: ein Sondertermin am Ort, zur nächsten guten Zeit (11 oder 17 Uhr
 * deutscher Zeit, mindestens zwei Stunden voraus, nicht über einem anderen Termin).
 * Steht schon eine Zusammenkunft in den nächsten zwei Tagen an, zählt der Wunsch dazu.
 */
async function gathering(supabase: Supabase, wish: WishRow, a: WishAssessment, tick: number): Promise<Fulfilment> {
  if (!wish.place_ref) return { ok: false, reason: 'kein Ort für eine Zusammenkunft' }
  const host = await hostForPlace(supabase, wish.place_ref)
  if (!host) return { ok: false, reason: 'an diesem Ort lädt niemand ein' }
  const { data: planned } = await supabase.from('population_events').select('id,payload').eq('event_type', 'place_activity_scheduled').gte('tick', tick - 48)
  const existing = ((planned ?? []) as Array<{ id: string; payload: Record<string, unknown> }>).find(row => row.payload?.personKey === host.spec.personKey && row.payload?.wish === true && Number(row.payload?.endsTick) > tick && row.payload?.cancelled !== true)
  if (existing) return { ok: true, fulfilment: { kind: 'gathering', joined: existing.id, startsTick: existing.payload.startsTick, place: wish.place_name } }
  let start: number | null = null
  for (let t = tick + 2; t <= tick + 48 && start === null; t++) {
    const hour = clockHour(t)
    if ((hour === 11 || hour === 17) && !hostWindowsAt(host.spec, t).length && !hostWindowsAt(host.spec, t + 1).length) start = t
  }
  if (start === null) return { ok: false, reason: 'in den nächsten zwei Tagen kein freier Termin' }
  const label = `Zusammenkunft: ${a.summary}`.slice(0, 80)
  const { data: event, error } = await supabase.from('population_events').insert({
    tick, event_type: 'place_activity_scheduled', actor_person_id: host.personId, location_id: host.locationId,
    subject_type: 'wish', subject_ref: wish.id,
    payload: { personKey: host.spec.personKey, kind: 'open_community', label, startsTick: start, endsTick: start + 2, wish: true, attendanceDoesNotImplyBelief: true },
  }).select('id').single()
  if (error) return { ok: false, reason: 'Termin konnte nicht angelegt werden' }
  return { ok: true, fulfilment: { kind: 'gathering', event: event?.id, startsTick: start, startsHour: clockHour(start), clockDay: Math.floor(clockTick(start) / 24) % 7, label, place: wish.place_name } }
}

/**
 * Lieferung: nur bei echtem Mangel (Vorrat reicht keine Woche). Menge: eine Woche
 * Verbrauch, mindestens 50, höchstens 500. Reicht der Vorrat, ist nichts zu tun.
 */
async function delivery(supabase: Supabase, wish: WishRow, a: WishAssessment, input: WishInput, tick: number): Promise<Fulfilment> {
  if (!a.resource || !wish.location_id) return { ok: false, reason: 'unklar, was wohin geliefert werden soll' }
  const { data: row } = await supabase.from('location_resources').select('id,stock,consumption').eq('location_id', wish.location_id).eq('resource', a.resource).maybeSingle()
  if (!row) return { ok: false, reason: 'diesen Vorrat gibt es hier nicht' }
  const perWeek = Math.max(1, Number(row.consumption ?? 0)) * 168
  if (Number(row.stock) >= perWeek) return { ok: false, reason: 'der Vorrat reicht schon – kein Mangel', status: 'angenommen' }
  const amount = Math.max(50, Math.min(500, Math.round(perWeek)))
  const { error } = await supabase.from('location_resources').update({ stock: Number(row.stock) + amount, updated_at: new Date().toISOString() }).eq('id', row.id)
  if (error) return { ok: false, reason: 'Lieferung konnte nicht gebucht werden' }
  await supabase.from('population_events').insert({
    tick, event_type: 'supply_arrived', location_id: wish.location_id, subject_type: 'wish', subject_ref: wish.id,
    payload: { resource: a.resource, amount, location: input.locationSlug, note: 'Eine Lieferung trifft ein.' },
  })
  return { ok: true, fulfilment: { kind: 'delivery', resource: a.resource, amount, location: input.locationSlug } }
}

// ── Im Tick ───────────────────────────────────────────────────────────

/**
 * Jede Stunde: liegengebliebene Wünsche einordnen; Figuren wünschen sich, was an
 * ihrem Ort wirklich fehlt (einmal täglich um 18 Uhr, je Ort und Vorrat höchstens ein Wunsch).
 */
export async function runWishTick(supabase: Supabase, tick: number) {
  const result = { evaluated: 0, npcWishes: 0 }
  try {
    const { data: open } = await supabase.from('wishes').select('id').eq('status', 'neu').lt('created_at', new Date(Date.now() - 5 * 60_000).toISOString()).limit(10)
    for (const row of (open ?? []) as Array<{ id: string }>) { await evaluateWish(supabase, row.id, tick); result.evaluated += 1 }
    if (clockHour(tick) === 18) result.npcWishes = await npcWishes(supabase, tick)
  } catch (error) {
    console.error('runWishTick failed', { tick, message: error instanceof Error ? error.message : String(error) })
  }
  return result
}

const RESOURCE_WORDS: Record<string, string> = { water: 'Wasser', food: 'Nahrung', energy: 'Energie', metal: 'Metall', components: 'Ersatzteile' }

async function npcWishes(supabase: Supabase, tick: number) {
  const { data: rows } = await supabase.from('location_resources').select('location_id,resource,stock,consumption,locations!inner(slug,name)')
  let made = 0
  for (const row of (rows ?? []) as Array<{ location_id: string; resource: string; stock: number; consumption: number; locations: { slug: string; name: string } }>) {
    const consumption = Number(row.consumption ?? 0)
    if (consumption <= 0 || Number(row.stock) >= consumption * 72 || !RESOURCE_WORDS[row.resource]) continue
    const cluster = `versorgung-${row.resource}-${row.locations.slug}`
    const { count } = await supabase.from('wishes').select('id', { count: 'exact', head: true }).eq('cluster_key', cluster).eq('source', 'npc').gte('tick', tick - 20)
    if (count) continue
    const { data: people } = await supabase.from('people').select('id').eq('current_location_id', row.location_id).eq('simulation_tier', 'active').neq('activity_state', 'travelling').limit(50)
    const list = (people ?? []) as Array<{ id: string }>
    if (!list.length) continue
    const person = list[(tick + row.resource.length) % list.length]
    await submitWish(supabase, {
      source: 'npc', personId: person.id, locationSlug: row.locations.slug, channel: 'figur',
      text: `Hoffentlich kommt bald wieder mehr ${RESOURCE_WORDS[row.resource]} nach ${row.locations.name}.`,
    })
    made += 1
  }
  return made
}
