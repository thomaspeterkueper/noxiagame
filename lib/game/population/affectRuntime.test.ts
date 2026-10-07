import { affectForDecision, applyEventAffect, applyHealthEventAffect, loadAffectSnapshot, needsWithPlaceAversion } from './affectRuntime'
import type { PopulationEvent } from './types'

let failures = 0
const check = (ok: boolean, label: string) => { if (!ok) { failures++; console.error('FAIL: ' + label) } }

// Minimal in-memory stand-in for the query shapes the adapter uses.
function fakeSupabase(options: { missingTables?: boolean } = {}) {
  const tables: Record<string, any[]> = { person_affect: [], person_place_aversions: [], people: [{ id: 'p1', traits: {} }] }
  let writes = 0
  const from = (table: string) => {
    const filters: [string, any][] = []
    let inFilter: [string, any[]] | null = null
    const missing = options.missingTables && table !== 'people'
    const rows = () => (tables[table] ?? []).filter((row) => filters.every(([k, v]) => row[k] === v) && (!inFilter || inFilter[1].includes(row[inFilter[0]])))
    const builder: any = {
      select: () => builder,
      eq: (key: string, value: any) => { filters.push([key, value]); return builder },
      in: (key: string, values: any[]) => { inFilter = [key, values]; return builder },
      maybeSingle: async () => missing ? { data: null, error: { message: 'relation does not exist' } } : { data: rows()[0] ?? null, error: null },
      then: (resolve: any) => resolve(missing ? { data: null, error: { message: 'relation does not exist' } } : { data: rows(), error: null }),
      upsert: async (row: any, opts: { onConflict: string }) => {
        if (missing) return { error: { message: 'relation does not exist' } }
        const keys = opts.onConflict.split(',')
        const index = tables[table].findIndex((existing) => keys.every((key) => existing[key] === row[key]))
        if (index >= 0) tables[table][index] = row; else tables[table].push(row)
        writes++
        return { error: null }
      },
    }
    return builder
  }
  return { from, tables, writes: () => writes }
}

const needs = [{ needCode: 'safety' as const, satisfaction: 0.9 }, { needCode: 'social' as const, satisfaction: 0.2 }]
const event = (id: string, eventType: string, tick: number): PopulationEvent => ({ id, tick, eventType, actorPersonId: 'p1', relatedPersonId: 'p2', locationId: 'loc:a', subjectType: null, subjectRef: null, payload: {} })

async function main() {
  const db = fakeSupabase()
  check(await applyEventAffect(db, event('e1', 'social_interaction', 10), { needs }) === 'applied', 'a known event is folded into affect')
  check(db.tables.person_affect[0].joy > 0 && db.tables.person_affect[0].source_event_id === 'e1', 'affect row records joy and its source event')
  const joyAfterFirst = db.tables.person_affect[0].joy
  check(await applyEventAffect(db, event('e1', 'social_interaction', 10), { needs }) === 'replayed' && db.tables.person_affect[0].joy === joyAfterFirst, 'replaying the same event changes nothing')
  check(await applyEventAffect(db, event('e2', 'npc_work', 11), { needs }) === 'no_affect' && db.writes() === 1, 'unknown events write nothing')
  await applyEventAffect(db, event('e3', 'person_conflict', 12), { needs, relationship: { familiarity: 0.8, trust: 0.9, affinity: 0.8 } })
  check(db.tables.person_affect.length === 1 && db.tables.person_affect[0].anger > 0 && db.tables.person_affect[0].joy < joyAfterFirst, 'later events accumulate on the decayed state')

  check(await applyHealthEventAffect(db, { personId: 'p1', locationId: 'loc:fab', tick: 20, event: { eventType: 'workplace_accident', severity: 0.8 }, sourceEventId: 'h1' }) === 'applied', 'a health event registers')
  check(db.tables.person_affect[0].pain > 0.5 && db.tables.person_place_aversions.length === 1, 'pain is stored and the place is remembered')
  const strong = db.tables.person_place_aversions[0].strength
  await applyHealthEventAffect(db, { personId: 'p1', locationId: 'loc:fab', tick: 21, event: { eventType: 'workplace_accident', severity: 0.4 }, sourceEventId: 'h2' })
  check(db.tables.person_place_aversions.length === 1 && db.tables.person_place_aversions[0].strength === strong, 'a weaker incident does not overwrite a stronger aversion')
  await applyHealthEventAffect(db, { personId: 'p1', locationId: 'loc:fab', tick: 22, event: { eventType: 'exhaustion', severity: 0.2 }, sourceEventId: 'h3' })
  check(db.tables.person_place_aversions.length === 1, 'trivial pain teaches no aversion')

  const snapshot = await loadAffectSnapshot(db, ['p1', 'p9'])
  check(snapshot.available && snapshot.affectByPerson.has('p1') && !snapshot.affectByPerson.has('p9'), 'snapshot loads only persons with affect')
  const now = affectForDecision(snapshot, 'p1', 23, null)!
  const muchLater = affectForDecision(snapshot, 'p1', 23 + 480, null)!
  check(muchLater.pain < now.pain * 0.01 && muchLater.updatedTick === 23 + 480, 'decision affect is decayed to the current tick')
  check(affectForDecision(snapshot, 'p9', 23, null) === undefined, 'a person without affect gets none')

  const atFab = needsWithPlaceAversion(needs, snapshot.aversionsByPerson.get('p1'), 'loc:fab', 23)
  const atHome = needsWithPlaceAversion(needs, snapshot.aversionsByPerson.get('p1'), 'loc:home', 23)
  check(atFab[0].satisfaction < 0.9 && atFab[1].satisfaction === 0.2 && atHome === needs, 'aversion lowers only safety and only at that place')

  // Before the migration is applied nothing may break.
  const empty = fakeSupabase({ missingTables: true })
  check(await applyEventAffect(empty, event('e1', 'social_interaction', 10), { needs }) === 'unavailable', 'missing table degrades event affect')
  check(await applyHealthEventAffect(empty, { personId: 'p1', locationId: 'loc:fab', tick: 20, event: { eventType: 'workplace_accident', severity: 0.8 }, sourceEventId: 'h1' }) === 'unavailable', 'missing table degrades pain')
  const none = await loadAffectSnapshot(empty, ['p1'])
  check(!none.available && none.affectByPerson.size === 0, 'missing table yields an empty snapshot')
  const throwing = { from: () => { throw new Error('network') } }
  check(!(await loadAffectSnapshot(throwing, ['p1'])).available && await applyEventAffect(throwing, event('e1', 'social_interaction', 10), { needs }) === 'unavailable', 'thrown errors are contained')

  if (failures) throw new Error(String(failures) + ' affect runtime test(s) failed')
  console.log('NPC affect persistence: tests passed; external_llm_calls=0')
}
// An unhandled rejection exits non-zero, which is what CI needs.
void main()
