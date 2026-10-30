// lib/worldlab/buildingChronicle.server.ts
// Lädt die Belege für die Gebäudechronik (nur lesend, nur mit Dienstclient hinter geprüfter Anmeldung).
// Erstellt: 30.10.2026 (Issue #541)

import { createServiceClient } from '@/lib/supabase/service'
import { buildChronicle, type Chronicle, type ChronicleEventRow, type ChronicleTombstoneRow } from './buildingChronicle'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EVENT_TYPES = ['entity.created', 'entity.updated', 'entity.deleted']
const MAX_LIMIT = 500

export function isEntityId(value: string | null | undefined): value is string {
  return Boolean(value && UUID.test(value))
}

/**
 * Chronik eines Gebäudes (Gebäude-ID oder source_ref) oder aller Gebäude der Erde.
 * Der Betrachter wird nur für das Feld `own` gebraucht; es gibt keine Nutzernutzlast, aus der
 * ein „committed“ oder eine Berechtigung gelesen würde.
 */
export async function loadBuildingChronicle(input: { viewerProfileId: string; entityId?: string | null; sourceRef?: string | null; limit?: number }): Promise<Chronicle> {
  const supabase = createServiceClient()
  const limit = Math.min(Math.max(Math.floor(input.limit ?? 200), 1), MAX_LIMIT)

  let entityId = input.entityId ?? null
  if (!entityId && input.sourceRef) {
    const { data } = await supabase.from('tile_entities').select('id').eq('source_ref', input.sourceRef).maybeSingle()
    entityId = data?.id ?? null
  }

  const { data: earth } = await supabase.from('locations').select('id').eq('slug', 'earth').maybeSingle()

  let eventQuery = supabase.from('simulation_events')
    .select('id,event_type,subject_id,actor_id,occurred_at,effects,metadata')
    .eq('subject_type', 'tile_entity').in('event_type', EVENT_TYPES)
    .order('occurred_at', { ascending: false }).limit(limit)
  if (entityId) eventQuery = eventQuery.eq('subject_id', entityId)
  else if (earth?.id) eventQuery = eventQuery.eq('location_id', earth.id)

  let stoneQuery = supabase.from('earth_cleared_buildings').select('source_ref,profile_id,display_name,cleared_at').order('cleared_at', { ascending: false }).limit(limit)
  if (input.sourceRef) stoneQuery = stoneQuery.eq('source_ref', input.sourceRef)
  else if (entityId) stoneQuery = stoneQuery.eq('source_ref', '__none__') // ohne Gebäude-ID ist ein Grabstein nicht zuzuordnen

  const [{ data: events }, { data: stones }] = await Promise.all([eventQuery, stoneQuery])
  const eventRows = (events ?? []) as ChronicleEventRow[]
  const subjectIds = [...new Set(eventRows.map(row => row.subject_id).filter((id): id is string => Boolean(id)))]

  const existing = new Set<string>()
  for (let i = 0; i < subjectIds.length; i += 100) {
    const { data } = await supabase.from('tile_entities').select('id').in('id', subjectIds.slice(i, i + 100))
    for (const row of data ?? []) existing.add(String(row.id))
  }
  return buildChronicle({ events: eventRows, tombstones: (stones ?? []) as ChronicleTombstoneRow[], existingEntityIds: existing, viewerProfileId: input.viewerProfileId })
}
