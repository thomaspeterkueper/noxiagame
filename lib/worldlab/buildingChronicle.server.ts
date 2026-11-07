// lib/worldlab/buildingChronicle.server.ts
// Lädt die Belege für die Gebäudechronik (nur lesend, nur mit Dienstclient hinter geprüfter Anmeldung).
// Erstellt: 30.10.2026 (Issue #541)

import { createServiceClient } from '@/lib/supabase/service'
import { buildChronicle, type Chronicle, type ChronicleEventRow, type ChronicleTombstoneRow } from './buildingChronicle'
import { requireChronicleOptional, requireChronicleRows, requireEarthLocationId, requireUnambiguousChronicleSelector, shouldReadChronicleEvents, resolveChronicleReadLimit, requireCompleteChroniclePage, requireChronicleEventRows, requireChronicleTombstoneRows, readCompleteChroniclePages, readChronicleKeysetPages, chronicleKeysetFilter } from './buildingChronicleReadGuard'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EVENT_TYPES = ['entity.created', 'entity.updated', 'entity.deleted']

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
  const limit = resolveChronicleReadLimit(input.limit)

  // Never combine a user-selected entity with an unrelated OSM tombstone.
  requireUnambiguousChronicleSelector(input.entityId, input.sourceRef)

  // Resolve Earth before source_ref: source refs must never resolve to an
  // entity on another world, even if its UUID is globally unique.
  const earthLookup = await supabase.from('locations').select('id').eq('slug', 'earth').maybeSingle()
  const earthId = requireEarthLocationId(requireChronicleOptional(earthLookup, 'locations.earth'))

  let entityId = input.entityId ?? null
  if (!entityId && input.sourceRef) {
    const lookup = await supabase.from('tile_entities').select('id')
      .eq('source_ref', input.sourceRef).eq('location_id', earthId)
      .eq('entity_type', 'building').maybeSingle()
    entityId = requireChronicleOptional(lookup, 'tile_entities.source_ref')?.id ?? null
  }

  // The input limit is a per-page size. Read through the terminal empty page;
  // never present the first page as a complete historical record.
  const [eventRows, stones] = await Promise.all([
    shouldReadChronicleEvents(input.sourceRef, entityId)
      ? readChronicleKeysetPages<ChronicleEventRow>(
        async (cursor, pageLimit) => {
          let query = supabase.from('simulation_events')
            .select('id,event_type,subject_id,actor_id,occurred_at,effects,metadata')
            .eq('subject_type', 'tile_entity').in('event_type', EVENT_TYPES)
            .eq('location_id', earthId)
          if (entityId) query = query.eq('subject_id', entityId)
          if (cursor) query = query.or(chronicleKeysetFilter('occurred_at', 'id', cursor))
          return await query.order('occurred_at', { ascending: false })
            .order('id', { ascending: false }).limit(pageLimit)
        },
        requireChronicleEventRows, 'simulation_events', limit, row => ({ timestamp: row.occurred_at, id: row.id }),
      )
      : Promise.resolve([] as ChronicleEventRow[]),
    readChronicleKeysetPages<ChronicleTombstoneRow>(
      async (cursor, pageLimit) => {
        let query = supabase.from('earth_cleared_buildings')
          .select('source_ref,profile_id,display_name,cleared_at')
        if (input.sourceRef) query = query.eq('source_ref', input.sourceRef)
        else if (entityId) query = query.eq('source_ref', '__none__')
        if (cursor) query = query.or(chronicleKeysetFilter('cleared_at', 'source_ref', cursor))
        return await query.order('cleared_at', { ascending: false })
          .order('source_ref', { ascending: false }).limit(pageLimit)
      },
      requireChronicleTombstoneRows, 'earth_cleared_buildings', limit, row => ({ timestamp: row.cleared_at, id: row.source_ref }),
    ),
  ])
  const subjectIds = [...new Set(eventRows.map(row => row.subject_id).filter((id): id is string => Boolean(id)))]

  const existing = new Set<string>()
  for (let i = 0; i < subjectIds.length; i += 100) {
    const lookup = await supabase.from('tile_entities').select('id').eq('location_id', earthId).in('id', subjectIds.slice(i, i + 100))
    for (const row of requireChronicleRows(lookup, 'tile_entities.existing')) existing.add(String(row.id))
  }
  return buildChronicle({ events: eventRows, tombstones: stones, existingEntityIds: existing, viewerProfileId: input.viewerProfileId })
}
