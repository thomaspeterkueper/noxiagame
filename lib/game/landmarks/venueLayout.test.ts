import { describe, expect, it } from 'vitest'
import { landmarkRoomLayout, LANDMARK_LEVELS, type LandmarkRoomKind } from './interiors'
import { toL, toV, toVenueLayout } from './venueLayout'
import { isVenueBlocked, venuePath } from '../hospitality/venues'

const KINDS: LandmarkRoomKind[] = ['library', 'worship', 'shop', 'workshop', 'artlounge', 'mosque', 'synagogue', 'hindu_temple', 'buddhist_temple', 'community_hall', 'resonance_place', 'hospitality', 'cemetery', 'rowhouse', 'rowhouse_wg', 'rowhouse_duplex', 'rowhouse_duplex_corner']

describe('Orte im allgemeinen Innenraum-Motor', () => {
  it('rechnet Punkte hin und zurück', () => {
    const p = { x: 380, y: 300 }
    const back = toL(toV(p))
    expect(Math.abs(back.x - p.x)).toBeLessThan(.2)
    expect(Math.abs(back.y - p.y)).toBeLessThan(.2)
  })
  for (const kind of KINDS) {
    for (let level = 0; level < (LANDMARK_LEVELS[kind] ?? 1); level++) {
      it(`${kind} (Geschoss ${level}): Start frei, Sitzplätze und Bereiche erreichbar`, () => {
        const l = landmarkRoomLayout(kind, level, level > 0)
        const v = toVenueLayout(l)
        expect(v.furniture.length).toBe(l.furniture.length)
        expect(isVenueBlocked(v, v.start)).toBe(false)
        const targets = [...v.spots.filter(s => s.id.startsWith('lm-') && s.kind === 'seat'), ...l.spots.map(s => ({ ...toV(s), id: s.id }))]
        for (const t of targets) {
          const path = venuePath(v, v.start, t)
          // Ein echter Weg (mehr als nur Start und Ziel) oder das Ziel liegt direkt daneben
          expect(path.length > 2 || Math.hypot(t.x - v.start.x, t.y - v.start.y) < 40, `${kind}: ${t.id}`).toBe(true)
        }
      })
    }
  }
})
