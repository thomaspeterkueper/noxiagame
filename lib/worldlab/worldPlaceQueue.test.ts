import { describe, expect, it } from 'vitest'
import { isCompactSnapshot, missingCenterCells, missingRingCells, pickWorldPlaceTasks, worldPlaceTask, type WorldPlaceRow } from './worldPlaceQueue'
import { earthPlaceSlug } from '@/lib/world/spatial/earthPlaceIdentity'
import { detailCell } from './detailCells'

const now = Date.parse('2026-10-28T00:00:00Z')
const due = now - 3 * 3600_000
const row = (over: Partial<WorldPlaceRow>): WorldPlaceRow => ({ slug: 'earth-place-46p80739-6p54938', source: 'overpass:maps.mail.ru:compact-v2', center_lat: 46.80739, center_lon: 6.54938, source_checked_at: '2026-10-27T20:26:08Z', ...over })

describe('worldPlaceQueue', () => {
  it('erkennt das Notprofil', () => {
    expect(isCompactSnapshot('overpass:maps.mail.ru:compact-v2')).toBe(true)
    expect(isCompactSnapshot('overpass:overpass-api.de:earth-osm-generalized-v3')).toBe(false)
    expect(isCompactSnapshot(null)).toBe(false)
  })
  it('leere Orte füllen, Notprofil nachbessern, sonst nichts', () => {
    expect(worldPlaceTask(row({}), 0, due)).toBe('fill')
    expect(worldPlaceTask(row({}), 242, due)).toBe('upgrade')
    expect(worldPlaceTask(row({ source: 'overpass:x:earth-osm-generalized-v3' }), 242, due)).toBeNull()
    expect(worldPlaceTask(row({ source: 'noxia:local-detail' }), 0, due)).toBe('fill')
    expect(worldPlaceTask(row({ source: 'noxia:local-detail' }), 50, due)).toBeNull()
  })
  it('wartet drei Stunden nach dem letzten Versuch', () => {
    expect(worldPlaceTask(row({ source_checked_at: '2026-10-27T23:00:00Z' }), 0, due)).toBeNull()
    expect(worldPlaceTask(row({ source_checked_at: null }), 0, due)).toBe('fill')
  })
  it('leere Orte vor Nachbesserungen', () => {
    const picked = pickWorldPlaceTasks([{ row: 'a', task: 'upgrade' }, { row: 'b', task: null }, { row: 'c', task: 'fill' }, { row: 'd', task: 'fill' }], 2)
    expect(picked.map(p => p.row)).toEqual(['c', 'd'])
    expect(pickWorldPlaceTasks([{ row: 'a', task: 'upgrade' }, { row: 'c', task: 'fill' }], 2).map(p => p.row)).toEqual(['c', 'a'])
  })
  it('legt fehlende Ortsdetail-Zellen an der Mitte benannter Orte an', () => {
    const seelenberg = row({ slug: 'earth-place-50p26092-8p41486', center_lat: 50.26092, center_lon: 8.41486 })
    const cells = missingCenterCells([seelenberg], earthPlaceSlug)
    expect(cells).toHaveLength(1)
    expect(cells[0].slug).toBe(earthPlaceSlug(detailCell({ lat: 50.26092, lon: 8.41486 })))
    // vorhandene Zelle und Ortsdetail-Zeilen selbst lösen nichts aus
    const existing = row({ slug: cells[0].slug, source: 'noxia:local-detail', center_lat: cells[0].lat, center_lon: cells[0].lon })
    expect(missingCenterCells([seelenberg, existing], earthPlaceSlug)).toHaveLength(0)
    expect(missingCenterCells([row({ slug: 'earth-sauerland' })], earthPlaceSlug)).toHaveLength(0)
  })
  it('legt Ringzellen erst an, wenn die Mitte geholt wurde, von innen nach außen', () => {
    const dwarka = row({ slug: 'earth-place-22p23786-68p96754', center_lat: 22.23786, center_lon: 68.96754 })
    expect(missingRingCells([dwarka], earthPlaceSlug)).toHaveLength(0)
    const centre = detailCell({ lat: 22.23786, lon: 68.96754 })
    const done = row({ slug: earthPlaceSlug(centre), source: 'noxia:local-detail', center_lat: centre.lat, center_lon: centre.lon, source_checked_at: '2026-11-02T00:00:00Z' })
    const first = missingRingCells([dwarka, done], earthPlaceSlug, 2, 100)
    expect(first).toHaveLength(8)              // Ring 1: 3 × 3 ohne Mitte
    expect(new Set(first.map(c => c.slug)).size).toBe(8)
    expect(first.every(c => Math.abs(c.lat - centre.lat) < 0.0125)).toBe(true)
    // Ring 1 vollständig vorhanden → Ring 2 (16 Zellen)
    const rows1 = [dwarka, done, ...first.map(c => row({ slug: c.slug, source: 'noxia:local-detail', center_lat: c.lat, center_lon: c.lon }))]
    expect(missingRingCells(rows1, earthPlaceSlug, 2, 100)).toHaveLength(16)
    expect(missingRingCells(rows1, earthPlaceSlug, 2, 5)).toHaveLength(5)
  })
})
