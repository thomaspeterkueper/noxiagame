import { describe, expect, it } from 'vitest'
import { isLandmarkRoomBlocked, landmarkPath, landmarkRoomKind, landmarkRoomLayout, LANDMARK_LEVELS } from './interiors'
import { rowhouseVariantFor, ROWHOUSE_LEVELS } from './rowhouse'

const AT = { lat: 50.25583, lon: 8.6494 }

describe('Reihenhausserie Krokusweg, Friedrichsdorf', () => {
  it('erkennt die Häuser der Reihe an Anschrift und Lage', () => {
    expect(rowhouseVariantFor('Krokusweg 10', AT)).toBe('rowhouse_wg')
    expect(rowhouseVariantFor('Krokusweg 4', AT)).toBe('rowhouse')
    expect(rowhouseVariantFor('Krokusweg 13', AT)).toBe('rowhouse_duplex')
    expect(rowhouseVariantFor('Krokusweg 3', AT)).toBe('rowhouse_duplex_corner')
    expect(rowhouseVariantFor('Krokusweg 1', AT)).toBeNull()
    expect(rowhouseVariantFor('Krokusweg 16', AT)).toBeNull()
    expect(rowhouseVariantFor('Krokusweg 10', { lat: 51.3, lon: 8.0 })).toBeNull()
    expect(rowhouseVariantFor('Rosenweg 10', AT)).toBeNull()
    expect(landmarkRoomKind('rowhouse_wg')).toBe('rowhouse_wg')
    expect(LANDMARK_LEVELS.rowhouse_wg).toBe(ROWHOUSE_LEVELS)
  })

  for (const kind of ['rowhouse', 'rowhouse_wg', 'rowhouse_duplex', 'rowhouse_duplex_corner'] as const) {
    for (let level = 0; level < ROWHOUSE_LEVELS; level++) {
      it(`${kind} Geschoss ${level}: alle Bereiche und Treppen erreichbar`, () => {
        const layout = landmarkRoomLayout(kind, level, level > 0)
        expect(isLandmarkRoomBlocked(layout, layout.start)).toBe(false)
        for (const spot of layout.spots) {
          expect(isLandmarkRoomBlocked(layout, spot), `${level}/${spot.id} frei`).toBe(false)
          const path = landmarkPath(layout, layout.start, spot)
          const near = Math.hypot(spot.x - layout.start.x, spot.y - layout.start.y) < 40
          expect(path.length > 2 || near, `${level}/${spot.id} erreichbar`).toBe(true)
        }
        const stairs = layout.spots.filter(spot => spot.action === 'stairs')
        expect(stairs.length).toBeGreaterThan(0)
        for (const spot of stairs) expect(spot.toLevel).not.toBe(level)
      })
    }
  }

  it('Doppelstockhaus: Außentreppe verbindet untere Wohnung und Laubengang', () => {
    const lower = landmarkRoomLayout('rowhouse_duplex', 0)
    expect(lower.spots.find(spot => spot.id === 'outside-up')?.toLevel).toBe(1)
    const entry = landmarkRoomLayout('rowhouse_duplex', 1, true)
    expect(entry.spots.some(spot => spot.id === 'walkway-down' && spot.toLevel === 0)).toBe(true)
    expect(entry.spots.some(spot => spot.id === 'down-3')).toBe(false)
    expect(landmarkRoomLayout('rowhouse_duplex', 2).spots.find(spot => spot.id === 'up-2')?.toLevel).toBe(3)
  })

  it('WG: Priyas Zimmer im 1. OG, Matratze im Keller', () => {
    expect(landmarkRoomLayout('rowhouse_wg', 1).spots.some(spot => spot.label === 'PRIYAS ZIMMER')).toBe(true)
    expect(landmarkRoomLayout('rowhouse_wg', 3).furniture.some(item => item.id === 'cellar-mattress')).toBe(true)
    expect(landmarkRoomLayout('rowhouse', 3).furniture.some(item => item.id === 'cellar-mattress')).toBe(false)
  })
})
