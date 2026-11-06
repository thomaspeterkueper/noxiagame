// lib/game/landmarks/venueLayout.ts
// Ein Motor für alle Räume (06.11.2026): Der Grundriss eines Ortes (Bibliothek, Gotteshaus,
// Laden, Friedhof …) aus interiors.ts wird zum Grundriss des allgemeinen Innenraum-Motors –
// Möbel, Sitzplätze, Personalplatz, Bedienpunkt, Ausgang. Reine Regeln.

import { LANDMARK_ROOM, crowdSpots, type LandmarkPoint, type LandmarkRoomLayout } from './interiors'
import { CIVIC_STANDARD_INTERIOR } from '../buildings/interiors/templates/civicStandard'
import { VENUE_HEIGHT, VENUE_WIDTH, type VenueFurniture, type VenueLayout, type VenueSpot } from '../hospitality/venues'

// ── Grundriss: Landmark-Raum (760 × 480, Wände 24/736/28/456) → Motor (760 × 470, Wände 35/725/42/436) ──
const SX = (725 - 35) / (LANDMARK_ROOM.right - LANDMARK_ROOM.left)
const SY = (436 - 42) / (LANDMARK_ROOM.bottom - LANDMARK_ROOM.top)
export const toV = (p: LandmarkPoint): LandmarkPoint => ({ x: Math.round((35 + (p.x - LANDMARK_ROOM.left) * SX) * 10) / 10, y: Math.round((42 + (p.y - LANDMARK_ROOM.top) * SY) * 10) / 10 })
export const toL = (p: LandmarkPoint): LandmarkPoint => ({ x: LANDMARK_ROOM.left + (p.x - 35) / SX, y: LANDMARK_ROOM.top + (p.y - 42) / SY })
export const rectV = (r: { x: number; y: number; w: number; h: number }) => { const a = toV(r); return { x: a.x, y: a.y, w: Math.max(4, r.w * SX), h: Math.max(4, r.h * SY) } }
export const SEAT_KINDS = new Set(['pew', 'bench', 'chair', 'cushion', 'armchair', 'sofa'])


/** Der Landmark-Grundriss als Grundriss des Motors: Möbel, Sitzplätze, Personalplatz, Ausgang. */
export function toVenueLayout(l: LandmarkRoomLayout): VenueLayout {
  const furniture: VenueFurniture[] = l.furniture.map(item => ({ id: item.id, kind: item.kind as VenueFurniture['kind'], ...rectV(item) }))
  const seat = (id: string, p: LandmarkPoint, label: string): VenueSpot => ({ id, kind: 'seat', ...toV(p), roomId: 'service', label, posture: 'sitting' })
  const spots: VenueSpot[] = []
  for (const spot of l.spots) if (spot.action === 'sit') spots.push(seat('lm-' + spot.id, spot, spot.label.toLowerCase()))
  // Für Gemeinde und Gäste: Plätze auf Bänken, Stühlen, Kissen, sonst frei im Raum.
  crowdSpots(l, 24).forEach((p, i) => {
    const on = l.furniture.find(item => SEAT_KINDS.has(item.kind) && p.x >= item.x - 2 && p.x <= item.x + item.w + 2 && p.y >= item.y - 2 && p.y <= item.y + item.h + 2)
    spots.push(on ? seat('crowd-' + i, p, on.kind === 'pew' ? 'in einer Bank' : on.kind === 'cushion' ? 'auf einem Kissen' : 'auf einem Platz') : { id: 'crowd-' + i, kind: 'standing', ...toV(p), roomId: 'service', label: 'im Raum', posture: 'standing' })
  })
  if (l.staff) spots.push({ id: 'lm-staff', kind: 'staff', ...toV(l.staff), roomId: 'service', label: 'am Tresen', posture: 'standing' })
  const desk = l.spots.find(s => s.action === 'staff')
  const servicePoint = desk ? { ...toV(desk), label: desk.label, locative: 'am Tresen' } : l.staff ? { ...toV({ x: l.staff.x, y: l.staff.y + 50 }), label: 'TRESEN', locative: 'am Tresen' } : { x: -999, y: -999, label: '', locative: '' }
  return {
    kind: l.kind,
    template: CIVIC_STANDARD_INTERIOR,
    noun: l.noun,
    locative: 'in ' + l.noun,
    width: VENUE_WIDTH,
    height: VENUE_HEIGHT,
    start: toV(l.start),
    exit: toV(l.exit),
    playerRoomId: 'service',
    servicePoint,
    windows: l.kind === 'cemetery' ? [] : [{ x: 150, w: 90 }, { x: 520, w: 90 }],
    furniture,
    spots,
    roomFact: `Du bist in ${l.noun}.`,
    guestBackFact: '',
    staffBackFact: '',
  }
}

