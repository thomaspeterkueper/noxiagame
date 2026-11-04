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

import { compareChronicleInstants } from './buildingChronicleReadGuard.ts'

export type ChronicleKind = 'built' | 'changed' | 'remodeled' | 'repurposed' | 'owner_changed' | 'demolished'
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
  /** True only when a trusted Core-side verifier explicitly attests this receipt. */
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

// These categories describe observed persisted field changes, not construction permits.
// An update remains an update; only an authorized Core receipt can change the world.
const REMODEL_FIELDS = new Set(['building_levels', 'roof_levels', 'height', 'building:levels', 'building:roof:levels', 'geometry', 'footprint', 'floor_area'])
const USE_FIELDS = new Set(['building_use', 'usage', 'use_type', 'land_use', 'entity_subtype'])

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
  /** Core-verified receipt IDs, supplied by a trusted server-side verifier only. */
  verifiedReceiptIds?: ReadonlySet<string>
  /** Core-verified tombstone source refs, never supplied by an untrusted caller. */
  verifiedTombstoneRefs?: ReadonlySet<string>
}): Chronicle {
  const entries: ChronicleEntry[] = []
  const demolishedSubjects = new Set<string>()
  const builtSubjects = new Set<string>()

  for (const event of input.events) {
    if (!EVENT_TYPES.has(event.event_type) || !event.subject_id) continue
    const metadata = asRecord(event.metadata)
    let kind: ChronicleKind
    // Actor IDs, metadata and persistence alone do not prove authorization.
    let authorized = input.verifiedReceiptIds?.has(event.id) === true
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
      authorized = authorized && deletionKind !== 'unspecified' && Boolean(event.actor_id)
    } else {
      const change = changedFields(event.effects)
      kind = change.owner ? 'owner_changed' : change.fields.some(field => REMODEL_FIELDS.has(field)) ? 'remodeled' : change.fields.some(field => USE_FIELDS.has(field)) ? 'repurposed' : 'changed'
      detail.fields = change.fields
      // Both categories can apply to the same receipt; keep the secondary
      // dimension visible without manufacturing a second Core event.
      detail.remodeled = change.fields.some(field => REMODEL_FIELDS.has(field))
      detail.repurposed = change.fields.some(field => USE_FIELDS.has(field))
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
      authorized: input.verifiedTombstoneRefs?.has(stone.source_ref) === true,
      detail: stone.display_name ? { name: stone.display_name } : {},
    })
  }

  entries.sort((a, b) => compareChronicleInstants(a.at, b.at) || a.id.localeCompare(b.id))

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
    if (compareChronicleInstants(entry.at, at) > 0) break
    const match = (key.subjectId && entry.subjectId === key.subjectId) || (key.sourceRef && entry.sourceRef === key.sourceRef)
    if (!match) continue
    state = entry.kind === 'demolished' ? 'demolished' : 'standing'
  }
  return state
}

/**
 * Only independently verified Core receipts may drive a world-state overlay.
 * The regular buildingStateAt() remains a historical evidence viewer, including
 * unverified tombstones; never use it to authorize a map or parcel mutation.
 * An unverified receipt after the last verified one makes the result unknown:
 * silently ignoring it would claim a state we cannot establish.
 */
export function verifiedBuildingStateAt(
  chronicle: Chronicle,
  key: { subjectId?: string | null; sourceRef?: string | null },
  at: string,
): BuildingStateAt {
  let state: BuildingStateAt = 'unknown'
  let previousInstant: string | null = null
  let previousKind: ChronicleKind | null = null
  for (const entry of chronicle.entries) {
    if (compareChronicleInstants(entry.at, at) > 0) break
    if (!((key.subjectId && entry.subjectId === key.subjectId) ||
          (key.sourceRef && entry.sourceRef === key.sourceRef))) continue
    // No persisted sequence number exists for equal-time receipts. In particular,
    // creation and demolition at the same instant must not depend on lexical IDs.
    if (previousInstant !== null && compareChronicleInstants(previousInstant, entry.at) === 0 &&
        ((previousKind === 'built' && entry.kind === 'demolished') ||
         (previousKind === 'demolished' && entry.kind === 'built'))) {
      return 'unknown'
    }
    previousInstant = entry.at
    previousKind = entry.kind
    if (!entry.authorized) {
      state = 'unknown'
      continue
    }
    if (entry.kind === 'demolished') {
      state = 'demolished'
    } else if (entry.kind === 'built') {
      state = 'standing'
    } else if (state !== 'standing') {
      // A remodel, change of use or ownership transfer is not proof that a
      // demolished building was rebuilt. Require a verified creation receipt.
      state = 'unknown'
    }
  }
  return state
}
