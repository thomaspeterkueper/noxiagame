import { describe, expect, it } from 'vitest'
import { NIGHT_BOUNDS, NIGHT_PLACES, NIGHT_START, nightBlocked, nightFind, nightPlaceNear, nightStep } from './dvarakaNacht'

describe('Dvārakā – die dritte Nacht', () => {
  it('Start liegt in der Herberge und in den Grenzen', () => {
    expect(nightBlocked(NIGHT_START)).toBe(false)
    expect(nightPlaceNear(NIGHT_START)?.id).toBe('N1')
  })
  it('alle Orte liegen in den Grenzen, Kennungen eindeutig', () => {
    expect(NIGHT_PLACES.every(place => !nightBlocked(place.at))).toBe(true)
    expect(new Set(NIGHT_PLACES.map(place => place.id)).size).toBe(NIGHT_PLACES.length)
  })
  it('[R]-Orte tragen den Fundzettel der Grabung, [F]-Orte keinen', () => {
    for (const place of NIGHT_PLACES) {
      if (place.label === 'R') expect(nightFind(place)).not.toBeNull()
      else expect(place.find).toBeUndefined()
    }
  })
  it('Schritt bleibt in den Grenzen', () => {
    const edge = { x: NIGHT_BOUNDS.maxX - 1, y: 0 }
    const next = nightStep(edge, { x: edge.x + 500, y: 0 }, 38)
    expect(nightBlocked(next)).toBe(false)
  })
  it('Ort nur in Reichweite', () => {
    expect(nightPlaceNear({ x: 600, y: 190 })).toBeNull()
  })
})
