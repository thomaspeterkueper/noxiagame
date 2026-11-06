import { describe, expect, it } from 'vitest'
import { localEnuToPlanetary, PLANETARY_REFERENCES } from '@/lib/game/spatial/planetary'
import { mercPerGroundMetre } from './mercator'
import { bodyProjection, EARTH_PROJECTION } from './bodyProjection'
import { buildBodyTile, corridorsToGeo } from './bodyTiles'
import { BODY_LOOKS } from './bodies'
import { THARSIS_HUB_SURFACE_CORRIDORS } from '@/lib/game/seeds/tharsisHubSurfaceCorridors'

const mars = PLANETARY_REFERENCES.mars
const projection = bodyProjection(mars.equatorialRadiusM)
const THARSIS = { lat: 14, lon: -102 }

/** Bodenabstand zweier Punkte über die Projektion (wie die Zeichenmaschine rechnet) */
function groundMetres(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const k = mercPerGroundMetre(a.lat), ma = projection.geoToMerc(a), mb = projection.geoToMerc(b)
  return Math.hypot(ma.x - mb.x, ma.y - mb.y) / k
}

describe('Projektion je Himmelskörper', () => {
  it('Erde bleibt genau die bisherige Rechnung', () => {
    const p = { lat: 51.3262, lon: 8 }
    expect(BODY_LOOKS.earth!.projection).toBe(EARTH_PROJECTION)
    // Standard-Kachelraster z17 (OSM): Sundern liegt in x 68448, y 43690
    expect(EARTH_PROJECTION.tileAt(EARTH_PROJECTION.geoToMerc(p))).toEqual({ x: 68448, y: 43690 })
    // dieselbe allgemeine Rechnung mit dem Erdradius ergibt dieselbe Kachel
    const general = bodyProjection(PLANETARY_REFERENCES.earth.equatorialRadiusM)
    expect(general.tileAt(general.geoToMerc(p))).toEqual({ x: 68448, y: 43690 })
  })
  it('Marskachel ist rund 158 m groß bei Tharsis', () => {
    const size = projection.tileSizeMerc / mercPerGroundMetre(THARSIS.lat)
    expect(size).toBeGreaterThan(150)
    expect(size).toBeLessThan(165)
  })
  it('Meterabstände im Ortsrahmen bleiben auf der Karte erhalten', () => {
    const origin = { latDeg: THARSIS.lat, lonDeg: THARSIS.lon, elevationM: 0 }
    const toGeo = (e: number, n: number) => { const g = localEnuToPlanetary({ eastM: e, northM: n, upM: 0 }, origin, mars); return { lat: g.latDeg, lon: g.lonDeg } }
    // Warenlager (−310/230) und Reaktor (230/150) aus der Datenbank
    const a = toGeo(-310, 230), b = toGeo(230, 150)
    expect(Math.abs(groundMetres(a, b) - Math.hypot(540, 80))).toBeLessThan(1)
    expect(Math.abs(projection.mercToGeo(projection.geoToMerc(a)).lat - a.lat)).toBeLessThan(1e-9)
  })
})

describe('Kacheln aus den Wegen des Ortes', () => {
  const roads = corridorsToGeo({ reference: mars, origin: THARSIS, corridors: THARSIS_HUB_SURFACE_CORRIDORS })
  it('jeder Weg liegt in mindestens einer Kachel um den Ursprung, mit Maßen in der Kachel', () => {
    const center = projection.tileAt(projection.geoToMerc(THARSIS))
    let found = 0
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
      const tile = buildBodyTile({ x: center.x + dx, y: center.y + dy }, 17, projection, roads)
      for (const road of tile.roads) {
        found++
        expect(road.p.length).toBeGreaterThanOrEqual(4)
        for (let i = 0; i < road.p.length; i++) expect(road.p[i]).toBeGreaterThan(-40)
      }
    }
    expect(found).toBeGreaterThanOrEqual(THARSIS_HUB_SURFACE_CORRIDORS.length)
  })
  it('ferne Kacheln bleiben leer', () => {
    const center = projection.tileAt(projection.geoToMerc(THARSIS))
    expect(buildBodyTile({ x: center.x + 40, y: center.y }, 17, projection, roads).roads).toHaveLength(0)
  })
})
