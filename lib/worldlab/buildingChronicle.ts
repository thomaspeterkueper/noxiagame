// lib/worldlab/buildingChronicle.ts
// Erstellt: 30.10.2026
// Lebensgeschichte von Gebäuden auf der Erde (Issue #541, Living Cities): Bau, Änderung,
// Eigentümerwechsel, Abriss – nur aus persistierten Belegen, nie aus Angaben des Clients.
// Rein, ohne DB-Zugriff; das Laden steht in buildingChronicle.server.ts.
//
// Quellen:
// - simulation_events (subject_type 'tile_entity'): entity.created / entity.updated / entity.deleted
// - earth_cleared_buildings: Grabstein eines abgerissenen oder umgebauten realen Gebäudes
//   (wird atomar mit dem Löschen geschrieben, nach Eigentumsprüfung)
// Lücken werden benannt, nicht geraten: Ein Grabstein trägt keine Gebäude-ID und
// lässt sich deshalb nicht sicher einem Ereignis zuordnen (Request an Core in
// docs/workstreams/world-map.md).

export type ChronicleKind = 'built' | 'changed' | 'owner_changed' | 'demolished'
export type ChronicleAuthority = 'event' | 'tombstone'

export type ChronicleEventRow = {
  id: string
  event_type: string
  subject_id: string | null
  actor_id: string | null
  occurred_at: string
  effects: unknown
  metadata: unknown
}
export type ChronicleTombstoneRow = {
  source_ref: string
  profile_id: string | null
  display_name?: string | null
  cleared_at: string
}

export type ChronicleEntry = {
  id: string
  kind: ChronicleKind
  at: string
  authority: ChronicleAuthority
  /** Id des Ereignisses bzw. source_ref des Grabsteins. */
  sourceId: string
  /** Gebäude-ID (tile_entities.id); beim Grabstein unbekannt. */
  subjectId: string | null
  sourceRef: string | null
  /** Gehört der Beleg dem Betrachter? null, wenn unbekannt. */
  own: boolean | null
  /** Beleg mit geprüfter Berechtigung (Grabstein, Abriss mit Akteur); sonst nur protokolliert. */
  authorized: boolean
  detail: Record<string, unknown>
}

export type ChronicleGapCode = 'deleted_without_receipt' | 'tombstone_unlinked'
export type ChronicleGap = { code: ChronicleGapCode; subjectId: string | null; sourceRef: string | null; note: string }

export type Chronicle = {
  entries: ChronicleEntry[]
  gaps: ChronicleGap[]
  summary: { events: number; tombstones: number; gaps: number }
}

const EVENT_TYPES = new Set(['entity.created', 'entity.updated', 'entity.deleted'])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Welche Felder haben sich laut Ereignis geändert (aus effects[].from / to). */
function changedFields(effects: unknown): { owner: boolean; fields: string[] } {
  let owner = false
  const fields = new Set<string>()
  for (const raw of asArray(effects)) {
    const effect = asRecord(raw)
    const from = asRecord(effect.from), to = asRecord(effect.to)
    for (const key of Object.keys(to)) {
      if (JSON.stringify(from[key] ?? null) === JSON.stringify(to[key] ?? null)) continue
      fields.add(key)
      if (key === 'profile_id' || key === 'owner_id' || key === 'owner_class') owner = true
    }
  }
  return { owner, fields: [...fields].sort() }
}

export function buildChronicle(input: {
  events: readonly ChronicleEventRow[]
  tombstones: readonly ChronicleTombstoneRow[]
  /** Gebäude-IDs, die in tile_entities noch existieren. */
  existingEntityIds: ReadonlySet<string>
  viewerProfileId: string | null
}): Chronicle {
  const entries: ChronicleEntry[] = []
  const demolishedSubjects = new Set<string>()
  const builtSubjects = new Set<string>()

  for (const event of input.events) {
    if (!EVENT_TYPES.has(event.event_type) || !event.subject_id) continue
    const metadata = asRecord(event.metadata)
    let kind: ChronicleKind
    let authorized = true
    const detail: Record<string, unknown> = {}
    if (event.event_type === 'entity.created') {
      kind = 'built'
      builtSubjects.add(event.subject_id)
      const to = asRecord(asRecord(asArray(event.effects)[0]).to)
      if (to.entity_id) detail.entityId = to.entity_id
    } else if (event.event_type === 'entity.deleted') {
      kind = 'demolished'
      demolishedSubjects.add(event.subject_id)
      const deletionKind = typeof metadata.deletion_kind === 'string' ? metadata.deletion_kind : 'unspecified'
      detail.deletionKind = deletionKind
      // Eine allgemeine Löschung beweist weder Eigentum noch Abrissrecht (PR #555).
      authorized = deletionKind !== 'unspecified' && Boolean(event.actor_id)
    } else {
      const change = changedFields(event.effects)
      kind = change.owner ? 'owner_changed' : 'changed'
      detail.fields = change.fields
    }
    entries.push({
      id: 'event:' + event.id, kind, at: event.occurred_at, authority: 'event', sourceId: event.id,
      subjectId: event.subject_id, sourceRef: null,
      own: event.actor_id && input.viewerProfileId ? event.actor_id === input.viewerProfileId : null,
      authorized, detail,
    })
  }

  for (const stone of input.tombstones) {
    entries.push({
      id: 'tombstone:' + stone.source_ref, kind: 'demolished', at: stone.cleared_at, authority: 'tombstone', sourceId: stone.source_ref,
      subjectId: null, sourceRef: stone.source_ref,
      own: stone.profile_id && input.viewerProfileId ? stone.profile_id === input.viewerProfileId : null,
      authorized: true,
      detail: stone.display_name ? { name: stone.display_name } : {},
    })
  }

  entries.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))

  const gaps: ChronicleGap[] = []
  for (const subjectId of builtSubjects) {
    if (!input.existingEntityIds.has(subjectId) && !demolishedSubjects.has(subjectId)) {
      gaps.push({ code: 'deleted_without_receipt', subjectId, sourceRef: null, note: 'Gebäude existiert nicht mehr, aber kein Lösch- oder Abrissbeleg im Eventstore.' })
    }
  }
  for (const stone of input.tombstones) {
    gaps.push({ code: 'tombstone_unlinked', subjectId: null, sourceRef: stone.source_ref, note: 'Grabstein ohne Gebäude-ID: nicht sicher einem Ereignis zuzuordnen.' })
  }
  return { entries, gaps, summary: { events: input.events.length, tombstones: input.tombstones.length, gaps: gaps.length } }
}

export type BuildingStateAt = 'standing' | 'demolished' | 'unknown'

/** Zustand eines Gebäudes zu einem Zeitpunkt (Wiedergabe). Schlüssel: Gebäude-ID oder source_ref. */
export function buildingStateAt(chronicle: Chronicle, key: { subjectId?: string | null; sourceRef?: string | null }, at: string): BuildingStateAt {
  let state: BuildingStateAt = 'unknown'
  for (const entry of chronicle.entries) {
    if (entry.at > at) break
    const match = (key.subjectId && entry.subjectId === key.subjectId) || (key.sourceRef && entry.sourceRef === key.sourceRef)
    if (!match) continue
    state = entry.kind === 'demolished' ? 'demolished' : 'standing'
  }
  return state
}
