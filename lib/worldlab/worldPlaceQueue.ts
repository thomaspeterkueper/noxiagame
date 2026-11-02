// lib/worldlab/worldPlaceQueue.ts
// Was der stündliche Lauf /api/cron/world-places mit einem Ort tun soll
// (Thomas, 28.10.2026: „Prüfen der anderen Standorte?“).
//
// Befund 28.10.: Vuiteboeuf, Seelenberg und Dvārakā kamen im geduldigen Modus nur
// mit dem Notprofil `compact-v2` an (Orte, Straßen, Flüsse, Wald, Wohngebiet –
// keine Wahrzeichen, keine Sportplätze, keine Bahn). Der Lauf hielt sie für fertig,
// weil sie nicht leer waren. Jetzt:
//   1. leere Orte zuerst (wie bisher),
//   2. danach Orte mit Notprofil: mit dem vollen Profil nachholen; scheitert das,
//      bleibt der alte Stand stehen,
//   3. benannte Orte bekommen eine Ortsdetail-Zelle an ihrer Mitte (Gebäude), damit
//      man dort nicht auf leerem Boden ankommt.

import { DETAIL_CELL_LAT, detailCell } from './detailCells'

export const COMPACT_PROFILE = 'compact-v2'
export const LOCAL_DETAIL_SOURCE = 'noxia:local-detail'

export type WorldPlaceRow = { slug: string; source: string | null; center_lat: number; center_lon: number; source_checked_at: string | null }
export type WorldPlaceTask = 'fill' | 'upgrade' | null

/** Ein Ort mit Notprofil: Quelle endet auf `:compact-v2`. */
export function isCompactSnapshot(source: string | null | undefined) {
  return Boolean(source && source.endsWith(':' + COMPACT_PROFILE))
}

/** Aufgabe für einen Ort, oder null, wenn nichts zu tun ist oder er noch nicht dran ist. */
export function worldPlaceTask(row: WorldPlaceRow, featureCount: number, dueBefore: number): WorldPlaceTask {
  if (row.source_checked_at && new Date(row.source_checked_at).getTime() > dueBefore) return null
  if (featureCount === 0) return 'fill'
  if (row.source !== LOCAL_DETAIL_SOURCE && isCompactSnapshot(row.source)) return 'upgrade'
  return null
}

/** Leere Orte vor Nachbesserungen, sonst Reihenfolge wie geliefert (ältester Versuch zuerst). */
export function pickWorldPlaceTasks<T>(items: Array<{ row: T; task: WorldPlaceTask }>, limit: number) {
  const fill = items.filter(item => item.task === 'fill')
  const upgrade = items.filter(item => item.task === 'upgrade')
  return [...fill, ...upgrade].slice(0, limit) as Array<{ row: T; task: 'fill' | 'upgrade' }>
}

/** Ortsdetail-Zelle an der Mitte eines benannten Ortes, wenn sie noch fehlt. */
export function missingCenterCells(rows: WorldPlaceRow[], slugOf: (point: { lat: number; lon: number }) => string) {
  const known = new Set(rows.map(row => row.slug))
  const out: Array<{ slug: string; lat: number; lon: number }> = []
  for (const row of rows) {
    if (row.source === LOCAL_DETAIL_SOURCE || !row.slug.startsWith('earth-place-')) continue
    const cell = detailCell({ lat: Number(row.center_lat), lon: Number(row.center_lon) })
    const slug = slugOf(cell)
    if (known.has(slug)) continue
    known.add(slug)
    out.push({ slug, ...cell })
  }
  return out
}

/**
 * Ringe um die Mitte (Thomas, 02.11.2026, Dwarka: im Außenring fehlten rund 3.600 Häuser, weil dort nur das
 * Notprofil ohne Gebäude liegt). Sobald die Mitte eines Ortes fertig geholt ist, kommen die Zellen rundum
 * dran, von innen nach außen: `rings` Zellen weit (2 Ringe = 5 × 5 Zellen ≈ 3,3 km). Höchstens `limit` neue
 * Zellen je Aufruf, damit die öffentlichen OpenStreetMap-Dienste nicht überlastet werden.
 */
export function missingRingCells(rows: WorldPlaceRow[], slugOf: (point: { lat: number; lon: number }) => string, rings = 2, limit = 8) {
  const bySlug = new Map(rows.map(row => [row.slug, row]))
  const known = new Set(rows.map(row => row.slug))
  const out: Array<{ slug: string; lat: number; lon: number }> = []
  for (let ring = 1; ring <= rings; ring++) {
    for (const place of rows) {
      if (place.source === LOCAL_DETAIL_SOURCE || !place.slug.startsWith('earth-place-')) continue
      const center = detailCell({ lat: Number(place.center_lat), lon: Number(place.center_lon) })
      const centerRow = bySlug.get(slugOf(center))
      // erst wenn die Mitte geholt wurde; äußere Ringe erst, wenn der Ring davor da ist
      if (!centerRow || !centerRow.source_checked_at) continue
      for (let dr = -ring; dr <= ring; dr++) for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue
        const lat = center.lat + dr * DETAIL_CELL_LAT
        const lonStep = DETAIL_CELL_LAT / Math.max(0.05, Math.cos(lat * Math.PI / 180))
        const cell = detailCell({ lat, lon: center.lon + dc * lonStep })
        const slug = slugOf(cell)
        if (known.has(slug)) continue
        known.add(slug)
        out.push({ slug, ...cell })
        if (out.length >= limit) return out
      }
      // ein Ring nach dem anderen: Ring 2 erst, wenn Ring 1 vollständig vorhanden ist
      if (out.length) return out
    }
  }
  return out
}
