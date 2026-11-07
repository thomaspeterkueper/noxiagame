/** NOXIA #575: read-only biography event validation and projection.
 * Core owns identities and persistence; no births or deaths are committed here.
 */
export type BiographyEventKind = 'birth' | 'bond_formed' | 'bond_ended' | 'care_started' | 'care_ended' | 'death'
export type BiographyEvent = {
  id: string
  personId: string
  tick: number
  kind: BiographyEventKind
  relatedPersonId?: string
}
export type BiographyProjection = {
  personId: string
  bornAtTick: number | null
  diedAtTick: number | null
  bonds: string[]
  caregivers: string[]
  timeline: BiographyEvent[]
}
export type BiographyResult = { ok: true; projection: BiographyProjection } | { ok: false; reason: string }
/** Deterministic, fail-closed projection; does not create people or validate consent itself. */
export function projectBiography(personId: string, events: readonly BiographyEvent[]): BiographyResult {
  if (!personId) return {ok:false,reason:'missing_person'}
  const timeline = events.filter(e=>e.personId===personId)
    .slice().sort((a,b)=>a.tick-b.tick || a.id.localeCompare(b.id))
  const ids=new Set<string>(), bonds=new Set<string>(), caregivers=new Set<string>()
  let bornAtTick:number|null=null, diedAtTick:number|null=null
  for (const e of timeline) {
    if (!e.id || ids.has(e.id)) return {ok:false,reason:'duplicate_or_missing_event_id'}
    ids.add(e.id)
    if (!Number.isSafeInteger(e.tick) || e.tick<0) return {ok:false,reason:'invalid_tick'}
    if (e.kind==='birth') {
      if (bornAtTick!==null || diedAtTick!==null) return {ok:false,reason:'duplicate_birth'}
      bornAtTick=e.tick
      continue
    }
    if (bornAtTick===null) return {ok:false,reason:'event_before_birth'}
    if (diedAtTick!==null) return {ok:false,reason:'event_after_death'}
    if (e.kind==='death') { diedAtTick=e.tick; continue }
    if (!e.relatedPersonId || e.relatedPersonId===personId) return {ok:false,reason:'invalid_relation'}
    if (e.kind==='bond_formed') bonds.add(e.relatedPersonId)
    if (e.kind==='bond_ended') bonds.delete(e.relatedPersonId)
    if (e.kind==='care_started') caregivers.add(e.relatedPersonId)
    if (e.kind==='care_ended') caregivers.delete(e.relatedPersonId)
  }
  return {ok:true,projection:{personId,bornAtTick,diedAtTick,bonds:[...bonds].sort(),caregivers:[...caregivers].sort(),timeline}}
}
