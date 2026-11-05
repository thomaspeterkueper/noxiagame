import { describe, expect, it } from 'vitest'
import { geoToMerc, tileAt } from './mercator'
import { heightTint, TERRAIN_N, terrainCellOf, terrainCellsAround, terrainLattice, terrainShade, tileTerrain } from './terrain'

const sundern = { lat: 51.3285, lon: 8.0006 }

describe('Höhengitter', () => {
  it('Kachel der Stufe 17 liegt in genau einer Zelle der Stufe 15', () => {
    const tile = tileAt(geoToMerc(sundern))
    const cell = terrainCellOf(tile)
    expect(cell).toEqual({ x: Math.floor(tile.x / 4), y: Math.floor(tile.y / 4) })
    const lattice = terrainLattice(cell)
    expect(lattice).toHaveLength(TERRAIN_N * TERRAIN_N)
    // erste Zeile im Norden, erste Spalte im Westen
    expect(lattice[0].lat).toBeGreaterThan(lattice[TERRAIN_N * (TERRAIN_N - 1)].lat)
    expect(lattice[0].lon).toBeLessThan(lattice[TERRAIN_N - 1].lon)
  })

  it('Nachbarzellen teilen ihre Randpunkte', () => {
    const a = terrainLattice({ x: 100, y: 200 }), b = terrainLattice({ x: 101, y: 200 })
    for (let row = 0; row < TERRAIN_N; row++) {
      expect(a[row * TERRAIN_N + TERRAIN_N - 1].lon).toBeCloseTo(b[row * TERRAIN_N].lon, 9)
    }
    expect(terrainCellsAround({ x: 5, y: 5 }, 1)).toHaveLength(9)
  })

  it('Kachelhöhen sind an gemeinsamen Kanten gleich (keine Stufen)', () => {
    // schiefe Ebene + Hügel als Zellhöhen
    const cell = Array.from({ length: TERRAIN_N * TERRAIN_N }, (_, k) => {
      const col = k % TERRAIN_N, row = Math.floor(k / TERRAIN_N)
      return 250 + col * 7 - row * 3 + 20 * Math.exp(-((col - 4) ** 2 + (row - 4) ** 2) / 6)
    })
    const left = tileTerrain(cell, { x: 400, y: 800 })!, right = tileTerrain(cell, { x: 401, y: 800 })!
    for (let j = 0; j < 9; j++) expect(left[j * 9 + 8]).toBeCloseTo(right[j * 9], 5)
    // Ecke der Zelle entspricht dem Gitterpunkt
    expect(left[0]).toBeCloseTo(cell[0], 1)
  })

  it('lehnt unvollständige Zellen ab', () => {
    expect(tileTerrain([1, 2, 3], { x: 0, y: 0 })).toBeNull()
    expect(tileTerrain(Array(81).fill(NaN), { x: 0, y: 0 })).toBeNull()
  })
})

describe('Hangschattierung und Höhenlinien', () => {
  it('eben: keine Schattierung, keine Linien', () => {
    const shade = terrainShade(Array(81).fill(300), 190)
    expect(shade.quads.every(q => Math.abs(q.light) < 0.02 && q.h === 300)).toBe(true)
    expect(shade.contours).toHaveLength(0)
  })

  it('Höhenfarbe: Tal dunkler, Höhe heller, Mitte neutral', () => {
    expect(heightTint(200).color).toBe(0x24432c)
    expect(heightTint(200).alpha).toBeGreaterThan(0.15)
    expect(heightTint(420).alpha).toBeLessThan(0.02)
    expect(heightTint(640).color).toBe(0xfff2cc)
    expect(heightTint(640).alpha).toBeGreaterThan(0.2)
  })

  it('Hang nach Nordwesten ist hell, nach Südosten dunkel', () => {
    // Höhe steigt nach Osten: Hang schaut nach Westen → zum Licht hin
    const east = terrainShade(Array.from({ length: 81 }, (_, k) => 300 + (k % 9) * 4), 190)
    expect(east.quads.every(q => q.light > 0)).toBe(true)
    const west = terrainShade(Array.from({ length: 81 }, (_, k) => 300 - (k % 9) * 4), 190)
    expect(west.quads.every(q => q.light < 0)).toBe(true)
  })

  it('Höhenlinien alle 10 m, jede fünfte hervorgehoben', () => {
    // 300 … 332 m von Westen nach Osten → Linien bei 300?, 310, 320, 330
    const shade = terrainShade(Array.from({ length: 81 }, (_, k) => 300.5 + (k % 9) * 4), 190)
    expect(shade.contours.map(c => c.s.length > 0)).toEqual([true, true, true])
    const lines = terrainShade(Array.from({ length: 81 }, (_, k) => 295 + (k % 9) * 4), 190)
    expect(lines.contours.find(c => c.major)).toBeDefined()
  })
})
