import { describe, expect, it } from 'vitest'
import { buildChronicle, buildingStateAt, verifiedBuildingStateAt, type ChronicleEventRow } from './buildingChronicle'

const ev = (id: string, type: string, subject: string, at: string, extra: Partial<ChronicleEventRow> = {}): ChronicleEventRow => ({
  id, event_type: type, subject_id: subject, actor_id: null, occurred_at: at, effects: [], metadata: {}, ...extra,
})

describe('Gebäudechronik (Eventstore-Reader)', () => {

  it('verwendet für Karten-Overlays ausschließlich Core-verifizierte Belege', () => {
    const base = {
      events: [
        ev('build', 'entity.created', 'b1', '2026-10-01T10:00:00Z'),
        ev('remodel', 'entity.updated', 'b1', '2026-10-02T10:00:00Z', {
          effects: [{ from: { building_levels: 1 }, to: { building_levels: 2 } }],
        }),
        ev('remove', 'entity.deleted', 'b1', '2026-10-03T10:00:00Z', {
          actor_id: 'p1', metadata: { deletion_kind: 'demolition' },
        }),
      ],
      tombstones: [], existingEntityIds: new Set<string>(), viewerProfileId: 'p1',
    }
    const unverified = buildChronicle(base)
    expect(buildingStateAt(unverified, { subjectId: 'b1' }, '2026-10-04T00:00:00Z')).toBe('demolished')
    expect(verifiedBuildingStateAt(unverified, { subjectId: 'b1' }, '2026-10-04T00:00:00Z')).toBe('unknown')
    const partial = buildChronicle({ ...base, verifiedReceiptIds: new Set(['build', 'remodel']) })
    expect(verifiedBuildingStateAt(partial, { subjectId: 'b1' }, '2026-10-01T11:00:00Z')).toBe('standing')
    expect(verifiedBuildingStateAt(partial, { subjectId: 'b1' }, '2026-10-02T11:00:00Z')).toBe('standing')
    expect(verifiedBuildingStateAt(partial, { subjectId: 'b1' }, '2026-10-04T00:00:00Z')).toBe('unknown')
    const verified = buildChronicle({ ...base, verifiedReceiptIds: new Set(['build', 'remodel', 'remove']) })
    expect(verifiedBuildingStateAt(verified, { subjectId: 'b1' }, '2026-10-04T00:00:00Z')).toBe('demolished')
  })

  it('unverifizierte Grabsteine dürfen den Kartenstatus nicht festlegen', () => {
    const base = { events: [], existingEntityIds: new Set<string>(), viewerProfileId: null,
      tombstones: [{ source_ref: 'osm:way/2', profile_id: null, cleared_at: '2026-10-05T08:00:00Z' }] }
    expect(verifiedBuildingStateAt(buildChronicle(base), { sourceRef: 'osm:way/2' }, '2026-10-06T00:00:00Z')).toBe('unknown')
    expect(verifiedBuildingStateAt(buildChronicle({ ...base, verifiedTombstoneRefs: new Set(['osm:way/2']) }),
      { sourceRef: 'osm:way/2' }, '2026-10-06T00:00:00Z')).toBe('demolished')
  })

  it('ordnet Bau, Änderung, Eigentümerwechsel und Abriss nach Zeit', () => {
    const chronicle = buildChronicle({
      events: [
        ev('e3', 'entity.deleted', 'b1', '2026-10-03T10:00:00Z', { actor_id: 'p1', metadata: { deletion_kind: 'demolition' } }),
        ev('e1', 'entity.created', 'b1', '2026-10-01T10:00:00Z', { effects: [{ type: 'entity_state', to: { entity_id: 'house' } }] }),
        ev('e2', 'entity.updated', 'b1', '2026-10-02T10:00:00Z', { effects: [{ from: { profile_id: 'p0' }, to: { profile_id: 'p1' } }] }),
      ],
      tombstones: [], existingEntityIds: new Set(), viewerProfileId: 'p1',
      verifiedReceiptIds: new Set(['e3']),
    })
    expect(chronicle.entries.map(e => e.kind)).toEqual(['built', 'owner_changed', 'demolished'])
    expect(chronicle.entries[2].authorized).toBe(true)
    expect(chronicle.entries[2].own).toBe(true)
    expect(chronicle.gaps).toEqual([])
  })

  it('Akteur und metadata allein belegen keine Core-Autorisierung', () => {
    const event = ev('e1', 'entity.updated', 'b1', '2026-10-02T10:00:00Z', {
      actor_id: 'p1', metadata: { committed: true, authorized: true },
    })
    const unverified = buildChronicle({ events: [event], tombstones: [], existingEntityIds: new Set(['b1']), viewerProfileId: 'p1' })
    expect(unverified.entries[0].authorized).toBe(false)
    const verified = buildChronicle({ events: [event], tombstones: [], existingEntityIds: new Set(['b1']), viewerProfileId: 'p1', verifiedReceiptIds: new Set(['e1']) })
    expect(verified.entries[0].authorized).toBe(true)
  })

  it('allgemeine Löschung ist kein autorisierter Abriss', () => {
    const chronicle = buildChronicle({
      events: [ev('e1', 'entity.created', 'b1', '2026-10-01T10:00:00Z'), ev('e2', 'entity.deleted', 'b1', '2026-10-02T10:00:00Z', { metadata: { deletion_kind: 'unspecified' } })],
      tombstones: [], existingEntityIds: new Set(), viewerProfileId: null,
    })
    expect(chronicle.entries[1].authorized).toBe(false)
    expect(chronicle.entries[1].own).toBeNull()
  })

  it('meldet gelöschte Gebäude ohne Beleg als Lücke, statt einen Abriss zu raten', () => {
    const chronicle = buildChronicle({ events: [ev('e1', 'entity.created', 'b1', '2026-10-01T10:00:00Z')], tombstones: [], existingEntityIds: new Set(), viewerProfileId: null })
    expect(chronicle.gaps).toHaveLength(1)
    expect(chronicle.gaps[0].code).toBe('deleted_without_receipt')
    expect(buildingStateAt(chronicle, { subjectId: 'b1' }, '2026-12-01T00:00:00Z')).toBe('standing')
  })

  it('noch vorhandene Gebäude sind keine Lücke', () => {
    const chronicle = buildChronicle({ events: [ev('e1', 'entity.created', 'b1', '2026-10-01T10:00:00Z')], tombstones: [], existingEntityIds: new Set(['b1']), viewerProfileId: null })
    expect(chronicle.gaps).toEqual([])
  })

  it('Grabstein bleibt ohne Core-Nachweis unautorisiert und ohne Gebäude-ID nicht zugeordnet', () => {
    const chronicle = buildChronicle({
      events: [], existingEntityIds: new Set(), viewerProfileId: 'p2',
      tombstones: [{ source_ref: 'osm:way/1', profile_id: 'p2', display_name: 'Altes Haus', cleared_at: '2026-10-05T08:00:00Z' }],
    })
    expect(chronicle.entries[0]).toMatchObject({ kind: 'demolished', authority: 'tombstone', authorized: false, own: true, sourceRef: 'osm:way/1' })
    expect(chronicle.gaps[0].code).toBe('tombstone_unlinked')
    const verified = buildChronicle({
      events: [], existingEntityIds: new Set(), viewerProfileId: 'p2',
      tombstones: [{ source_ref: 'osm:way/1', profile_id: 'p2', cleared_at: '2026-10-05T08:00:00Z' }],
      verifiedTombstoneRefs: new Set(['osm:way/1']),
    })
    expect(verified.entries[0].authorized).toBe(true)
    expect(buildChronicle({
      events: [], existingEntityIds: new Set(), viewerProfileId: 'p2',
      tombstones: [{ source_ref: 'osm:way/1', profile_id: 'p2', cleared_at: '2026-10-05T08:00:00Z' }],
      verifiedReceiptIds: new Set(['osm:way/1']),
    }).entries[0].authorized).toBe(false)
  })

  it('Wiedergabe: vor dem Abriss steht das Haus, danach nicht (Schlüssel source_ref)', () => {
    const chronicle = buildChronicle({
      events: [], existingEntityIds: new Set(), viewerProfileId: null,
      tombstones: [{ source_ref: 'osm:way/1', profile_id: null, cleared_at: '2026-10-05T08:00:00Z' }],
    })
    expect(buildingStateAt(chronicle, { sourceRef: 'osm:way/1' }, '2026-10-04T00:00:00Z')).toBe('unknown')
    expect(buildingStateAt(chronicle, { sourceRef: 'osm:way/1' }, '2026-10-06T00:00:00Z')).toBe('demolished')
  })

  it('ignoriert fremde Ereignisarten und Ereignisse ohne Gebäude-ID', () => {
    const chronicle = buildChronicle({
      events: [ev('e1', 'facility.production_credited', 'b1', '2026-10-01T10:00:00Z'), { ...ev('e2', 'entity.created', 'x', '2026-10-01T10:00:00Z'), subject_id: null }],
      tombstones: [], existingEntityIds: new Set(), viewerProfileId: null,
    })
    expect(chronicle.entries).toEqual([])
  })

  it('übernimmt keinen „committed“-Hinweis aus Ereignisdaten als Beleg', () => {
    const chronicle = buildChronicle({
      events: [ev('e1', 'entity.deleted', 'b1', '2026-10-02T10:00:00Z', { actor_id: 'p1', metadata: { committed: true, deletion_kind: 'unspecified' } })],
      tombstones: [], existingEntityIds: new Set(), viewerProfileId: 'p1',
    })
    expect(chronicle.entries[0].authorized).toBe(false)
  })

  it('sortiert Ereignisse nach absoluten Zeitpunkten statt Zeitzonen-Text', () => {
    const chronicle = buildChronicle({
      events: [
        ev('created', 'entity.created', 'b1', '2026-11-03T01:00:00+02:00'),
        ev('removed', 'entity.deleted', 'b1', '2026-11-03T00:00:00Z', {
          actor_id: 'owner', metadata: { deletion_kind: 'demolition' },
        }),
      ],
      tombstones: [], existingEntityIds: new Set(), viewerProfileId: null,
      verifiedReceiptIds: new Set(['created', 'removed']),
    })
    expect(chronicle.entries.map(entry => entry.sourceId)).toEqual(['created', 'removed'])
    expect(verifiedBuildingStateAt(chronicle, { subjectId: 'b1' }, '2026-11-03T01:30:00+02:00')).toBe('standing')
    expect(verifiedBuildingStateAt(chronicle, { subjectId: 'b1' }, '2026-11-03T00:30:00Z')).toBe('demolished')
  })

  it('bewahrt Mikrosekunden-Reihenfolge beim Umbau vor Abriss', () => {
    const chronicle = buildChronicle({
      events: [
        ev('removed', 'entity.deleted', 'b1', '2026-11-03T00:00:00.123456Z', {
          actor_id: 'owner', metadata: { deletion_kind: 'demolition' },
        }),
        ev('created', 'entity.created', 'b1', '2026-11-03T00:00:00.123455Z'),
      ],
      tombstones: [], existingEntityIds: new Set(), viewerProfileId: null,
      verifiedReceiptIds: new Set(['created', 'removed']),
    })
    expect(chronicle.entries.map(entry => entry.sourceId)).toEqual(['created', 'removed'])
    expect(verifiedBuildingStateAt(chronicle, { subjectId: 'b1' }, '2026-11-03T00:00:00.123455Z')).toBe('standing')
    expect(verifiedBuildingStateAt(chronicle, { subjectId: 'b1' }, '2026-11-03T00:00:00.123456Z')).toBe('demolished')
  })

  it('ein verifizierter Umbau belebt ein abgerissenes Haus nicht wieder', () => {
    const events = [
      ev('build', 'entity.created', 'b1', '2026-10-01T10:00:00Z'),
      ev('remove', 'entity.deleted', 'b1', '2026-10-02T10:00:00Z', {
        actor_id: 'owner', metadata: { deletion_kind: 'demolition' },
      }),
      ev('remodel', 'entity.updated', 'b1', '2026-10-03T10:00:00Z', {
        effects: [{ from: { building_levels: 1 }, to: { building_levels: 2 } }],
      }),
    ]
    const chronicle = buildChronicle({
      events, tombstones: [], existingEntityIds: new Set(), viewerProfileId: null,
      verifiedReceiptIds: new Set(['build', 'remove', 'remodel']),
    })
    expect(verifiedBuildingStateAt(chronicle, { subjectId: 'b1' }, '2026-10-02T12:00:00Z')).toBe('demolished')
    expect(verifiedBuildingStateAt(chronicle, { subjectId: 'b1' }, '2026-10-04T00:00:00Z')).toBe('unknown')
    const rebuilt = buildChronicle({
      events: [...events, ev('rebuild', 'entity.created', 'b1', '2026-10-04T10:00:00Z')],
      tombstones: [], existingEntityIds: new Set(['b1']), viewerProfileId: null,
      verifiedReceiptIds: new Set(['build', 'remove', 'remodel', 'rebuild']),
    })
    expect(verifiedBuildingStateAt(rebuilt, { subjectId: 'b1' }, '2026-10-05T00:00:00Z')).toBe('standing')
  })
})
