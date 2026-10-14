import { describe, expect, it } from 'vitest'
import { geoToMerc, mercPerGroundMetre, mercToGeo, tileAt, tileOrigin, TILE_SIZE_MERC, TILE_Z } from './mercator'
import { buildTile, clipToSquare, orientedBox, simplifyLine, type SourceFeature } from './simplify'

const SUNDERN = { lat: 51.3262, lon: 8.0 }
const tile = tileAt(geoToMerc(SUNDERN))
const origin = tileOrigin(tile)
const k = mercPerGroundMetre(SUNDERN.lat)
// Punkt in der Kachel: x Meter nach Osten, y Meter nach Süden ab Nordwestecke
const at = (x: number, y: number) => mercToGeo({ x: origin.x + x * k, y: origin.y - y * k })
const polygon = (points: Array<[number, number]>) => ({ kind: 'polygon' as const, coordinates: points.map(([x, y]) => at(x, y)) })

describe('world lab: one world in Web Mercator tiles', () => {
  it('round-trips coordinates and finds neighbouring tiles without gaps', () => {
    const back = mercToGeo(geoToMerc(SUNDERN))
    expect(back.lat).toBeCloseTo(SUNDERN.lat, 9)
    expect(back.lon).toBeCloseTo(SUNDERN.lon, 9)
    const east = tileAt({ x: origin.x + TILE_SIZE_MERC + 1, y: origin.y - 1 })
    expect(east).toEqual({ x: tile.x + 1, y: tile.y })
    expect(tileOrigin(east).x - origin.x).toBeCloseTo(TILE_SIZE_MERC, 6)
    // rund 190 m Kantenlänge am Boden auf dieser Breite
    expect(TILE_SIZE_MERC / k).toBeGreaterThan(185)
    expect(TILE_SIZE_MERC / k).toBeLessThan(195)
  })
})

describe('world lab: simplification', () => {
  it('drops points that do not change the line', () => {
    const line = [{ x: 0, y: 0 }, { x: 10, y: 0.2 }, { x: 20, y: 0 }, { x: 20, y: 30 }]
    expect(simplifyLine(line, 1)).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 30 }])
  })

  it('turns a rotated house outline into a block that stands the same way', () => {
    // 12 × 8 m, um 30° gedreht, Mitte bei (50, 60)
    const angle = Math.PI / 6
    const corners = [[-6, -4], [6, -4], [6, 4], [-6, 4]].map(([x, y]) => ({ x: 50 + x * Math.cos(angle) - y * Math.sin(angle), y: 60 + x * Math.sin(angle) + y * Math.cos(angle) }))
    const box = orientedBox(corners)!
    expect(box.x).toBeCloseTo(50, 5)
    expect(box.y).toBeCloseTo(60, 5)
    expect(box.w).toBeCloseTo(12, 5)
    expect(box.d).toBeCloseTo(8, 5)
    expect(box.a).toBeCloseTo(angle, 5)
  })

  const features: SourceFeature[] = [
    { id: 'house', featureType: 'building', geometry: polygon([[40, 40], [52, 40], [52, 48], [40, 48], [40, 40]]), properties: { visual_class: 'residential', noxia_source_id: 'osm:way:1' } },
    { id: 'house-again', featureType: 'building', geometry: polygon([[40, 40], [52, 40], [52, 48], [40, 48], [40, 40]]), properties: { visual_class: 'residential', noxia_source_id: 'osm:way:1' } },
    { id: 'hall', featureType: 'building', geometry: polygon([[80, 80], [130, 80], [130, 110], [80, 110], [80, 80]]), properties: { building: 'industrial' } },
    { id: 'church', featureType: 'building', geometry: polygon([[20, 120], [40, 120], [40, 150], [20, 150], [20, 120]]), properties: { building: 'church', 'building:levels': '5' } },
    { id: 'kennel', featureType: 'building', geometry: polygon([[5, 5], [8, 5], [8, 8], [5, 8], [5, 5]]), properties: {} },
    { id: 'next-door', featureType: 'building', geometry: polygon([[250, 40], [262, 40], [262, 48], [250, 48], [250, 40]]), properties: {} },
    { id: 'main', featureType: 'road', geometry: { kind: 'line', coordinates: [at(-50, 100), at(60, 100.3), at(300, 100)] }, properties: { highway: 'primary' } },
    { id: 'steps', featureType: 'road', geometry: { kind: 'line', coordinates: [at(10, 10), at(20, 10)] }, properties: { highway: 'steps' } },
    { id: 'path', featureType: 'road', geometry: { kind: 'line', coordinates: [at(10, 20), at(60, 20)] }, properties: { highway: 'footway' } },
    { id: 'far-road', featureType: 'road', geometry: { kind: 'line', coordinates: [at(900, 900), at(950, 900)] }, properties: { highway: 'residential' } },
    { id: 'river', featureType: 'waterway', geometry: { kind: 'line', coordinates: [at(0, 170), at(190, 175)] }, properties: {} },
    { id: 'lake', featureType: 'water', geometry: polygon([[100, 10], [150, 10], [150, 40], [100, 40], [100, 10]]), properties: {} },
    { id: 'wood', featureType: 'vegetation', geometry: polygon([[0, 0], [60, 0], [60, 30], [0, 30], [0, 0]]), properties: {} },
    { id: 'meadow', featureType: 'farmland', geometry: polygon([[-100, -100], [400, -100], [400, 400], [-100, 400], [-100, -100]]), properties: {} },
  ]
  const built = buildTile(features, tile, TILE_Z)

  it('keeps each building once, in the tile its centre lies in, and skips tiny ones', () => {
    expect(built.blocks.map(block => block.k).sort()).toEqual(['church', 'factory', 'house'])
    const house = built.blocks.find(block => block.k === 'house')!
    expect([house.x, house.y, house.w, house.d]).toEqual([46, 44, 12, 8])
    expect(built.blocks.find(block => block.k === 'church')!.l).toBe(5)
    // das Haus jenseits der Kachelgrenze gehört dem Nachbarn – und nur ihm
    const neighbour = buildTile(features, { x: tile.x + 1, y: tile.y }, TILE_Z)
    expect(neighbour.blocks).toHaveLength(1)
    expect(neighbour.blocks[0].x).toBeCloseTo(256 - built.size, 0)
  })

  it('reduces roads to three classes and leaves out what is not a road for walking around', () => {
    expect(built.roads.map(road => road.c)).toEqual(['path', 'main'])
    // die fast gerade Hauptstraße braucht nur ihre zwei Endpunkte
    expect(built.roads[1].p).toHaveLength(4)
    expect(built.rivers).toHaveLength(1)
  })

  it('orders areas so that water lies on top of forest on top of fields', () => {
    expect(built.areas.map(area => area.k)).toEqual(['field', 'forest', 'water'])
  })

  it('keeps sports grounds: grounds below track below pitch, golf stays vegetation', () => {
    const sport: SourceFeature[] = [
      { id: 'pitch', featureType: 'sport', geometry: polygon([[60, 60], [120, 60], [120, 100], [60, 100], [60, 60]]), properties: { visual_class: 'pitch' } },
      { id: 'track', featureType: 'sport', geometry: polygon([[50, 50], [130, 50], [130, 110], [50, 110], [50, 50]]), properties: { visual_class: 'track' } },
      { id: 'stadium', featureType: 'sport', geometry: polygon([[40, 40], [140, 40], [140, 120], [40, 120], [40, 40]]), properties: { visual_class: 'stadium' } },
      { id: 'green', featureType: 'vegetation', geometry: polygon([[0, 150], [20, 150], [20, 170], [0, 170], [0, 150]]), properties: { leisure: 'pitch', sport: 'golf' } },
    ]
    const tileWithSport = buildTile(sport, tile, TILE_Z)
    expect(tileWithSport.areas.map(area => area.k)).toEqual(['forest', 'grounds', 'track', 'pitch'])
    // das Spielfeld bleibt ein Rechteck
    expect(tileWithSport.areas[3].p).toHaveLength(10) // vier Ecken und der Schlusspunkt
  })

  it('cuts areas to the tile so neighbours never overlap', () => {
    const meadow = built.areas.find(area => area.k === 'field')!
    const xs = meadow.p.filter((_, i) => i % 2 === 0), ys = meadow.p.filter((_, i) => i % 2 === 1)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-0.2)
    expect(Math.max(...xs)).toBeLessThanOrEqual(built.size + 0.25)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-0.2)
    expect(Math.max(...ys)).toBeLessThanOrEqual(built.size + 0.25)
  })

  it('clips a square half inside to the inside half', () => {
    const cut = clipToSquare([{ x: -10, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 30 }, { x: -10, y: 30 }, { x: -10, y: 10 }], 0, 100)
    expect(cut.map(p => p.x).sort((a, b) => a - b)).toEqual([0, 0, 0, 10, 10])
  })

  it('draws residential areas as gardens, parks as parks, commerce and industry as built', () => {
    const square = polygon([[10, 10], [60, 10], [60, 60], [10, 60], [10, 10]])
    const kinds = (type: string, props: Record<string, unknown>) => buildTile([{ id: 'a', featureType: type, geometry: square, properties: props }], tile, TILE_Z).areas.map(area => area.k)
    expect(kinds('urban', { visual_class: 'residential' })).toEqual(['garden'])
    expect(kinds('urban', { visual_class: 'retail' })).toEqual(['built'])
    expect(kinds('industrial', { visual_class: 'industrial' })).toEqual(['built'])
    expect(kinds('vegetation', { visual_class: 'park' })).toEqual(['park'])
    expect(kinds('vegetation', { visual_class: 'scrub' })).toEqual(['forest'])
  })

  it('marks a football pitch once, in the tile of its centre', () => {
    const pitch: SourceFeature = { id: 'p', featureType: 'sport', geometry: polygon([[40, 40], [145, 40], [145, 108], [40, 108], [40, 40]]), properties: { visual_class: 'pitch', sport: 'soccer' } }
    const marked = buildTile([pitch], tile, TILE_Z)
    expect(marked.marks).toHaveLength(6)   // Mittellinie, Kreis, je zwei Räume an beiden Enden
    expect(buildTile([pitch], { x: tile.x + 1, y: tile.y }, TILE_Z).marks).toBeUndefined()
    const skate = { ...pitch, properties: { visual_class: 'pitch', sport: 'skateboard' } }
    expect(buildTile([skate], tile, TILE_Z).marks).toBeUndefined()
  })

  it('keeps the real footprint of an L-shaped factory', () => {
    const lShape = polygon([[20, 20], [120, 20], [120, 50], [60, 50], [60, 110], [20, 110], [20, 20]])
    const built2 = buildTile([{ id: 'f', featureType: 'building', geometry: lShape, properties: { building: 'industrial' } }], tile, TILE_Z)
    expect(built2.blocks[0].k).toBe('factory')
    expect(built2.blocks[0].f!.length).toBeGreaterThanOrEqual(12)
  })

  it('maps everyday places and sports to their own areas', () => {
    const square = polygon([[10, 10], [60, 10], [60, 40], [10, 40], [10, 10]])
    const kind = (type: string, props: Record<string, unknown>) => buildTile([{ id: 'a', featureType: type, geometry: square, properties: props }], tile, TILE_Z).areas.map(area => area.k)
    expect(kind('place_area', { visual_class: 'playground' })).toEqual(['playground'])
    expect(kind('place_area', { visual_class: 'cemetery' })).toEqual(['cemetery'])
    expect(kind('place_area', { visual_class: 'allotments' })).toEqual(['allotments'])
    expect(kind('place_area', { visual_class: 'parking' })).toEqual(['parking'])
    expect(kind('place_area', { visual_class: 'swimming_pool' })).toEqual(['pool'])
    expect(kind('place_area', { visual_class: 'garden' })).toEqual(['park'])
    expect(kind('sport', { visual_class: 'pitch', sport: 'equestrian' })).toEqual(['sand'])
    expect(kind('sport', { visual_class: 'pitch', sport: 'skateboard' })).toEqual(['hardcourt'])
    expect(kind('sport', { visual_class: 'pitch', sport: 'tennis' })).toEqual(['clay'])
    expect(kind('vegetation', { visual_class: 'nature_reserve' })).toEqual([])
    expect(kind('vegetation', { visual_class: 'grassland' })).toEqual(['field'])
  })

  it('marks tennis courts', () => {
    const court = polygon([[40, 40], [76, 40], [76, 58], [40, 58], [40, 40]])
    const marked = buildTile([{ id: 't', featureType: 'sport', geometry: court, properties: { visual_class: 'pitch', sport: 'tennis' } }], tile, TILE_Z)
    expect(marked.areas.map(area => area.k)).toEqual(['clay'])
    expect(marked.marks?.length).toBe(7)
  })

  it('stays small', () => {
    expect(JSON.stringify(built).length).toBeLessThan(900)
  })
})
