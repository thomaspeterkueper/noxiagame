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
    expect(house.i).toBe('osm:way:1')
    expect(built.blocks.find(block => block.k === 'church')!.i).toBeUndefined()
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

  it('plants single trees and avenues in the tile they stand in', () => {
    const tree: SourceFeature = { id: 't', featureType: 'tree', geometry: { kind: 'point', coordinates: at(50, 50) }, properties: {} }
    const avenue: SourceFeature = { id: 'r', featureType: 'tree_row', geometry: { kind: 'line', coordinates: [at(10, 100), at(90, 100)] }, properties: {} }
    const planted = buildTile([tree, avenue], tile, TILE_Z)
    // ein Baum und eine Allee von rund 80 m mit 8 m Abstand (10 oder 11 Bäume, je nach Rundung am Ende)
    expect(planted.trees!.length / 2).toBeGreaterThanOrEqual(11)
    expect(planted.trees!.length / 2).toBeLessThanOrEqual(12)
    expect(buildTile([tree], { x: tile.x + 1, y: tile.y }, TILE_Z).trees).toBeUndefined()
  })

  it('keeps a running track mapped as a line', () => {
    const ring: SourceFeature = { id: 'k', featureType: 'sport', geometry: { kind: 'line', coordinates: [at(30, 30), at(130, 30), at(130, 90), at(30, 90)] }, properties: { visual_class: 'track' } }
    expect(buildTile([ring], tile, TILE_Z).tracks).toHaveLength(1)
  })

  it('keeps address and name of a building', () => {
    const house = buildTile([{ id: 'h', featureType: 'building', geometry: polygon([[40, 40], [52, 40], [52, 48], [40, 48], [40, 40]]), properties: { 'addr:street': 'Bogenstraße', 'addr:housenumber': '15', name: 'SSF' } }], tile, TILE_Z)
    expect(house.blocks[0].h).toBe('Bogenstraße 15')
    expect(house.blocks[0].nm).toBe('SSF')
  })

  it('keeps the present use of a building from OSM (W-4)', () => {
    const square = polygon([[40, 40], [52, 40], [52, 48], [40, 48], [40, 40]])
    const bar = buildTile([{ id: 'b', featureType: 'building', geometry: square, properties: { building: 'yes', amenity: 'bar', name: 'Metropol', noxia_source_id: 'osm:way:7' } }], tile, TILE_Z)
    expect(bar.blocks[0].u).toBe('a:bar')
    expect(bar.blocks[0].i).toBe('osm:way:7')
    const flats = buildTile([{ id: 'f', featureType: 'building', geometry: square, properties: { building: 'apartments' } }], tile, TILE_Z)
    expect(flats.blocks[0].u).toBe('b:apartments')
    const plain = buildTile([{ id: 'p', featureType: 'building', geometry: square, properties: { building: 'yes' } }], tile, TILE_Z)
    expect(plain.blocks[0].u).toBeUndefined()
  })

  it('keeps named landmarks with their describing tags', () => {
    const church: SourceFeature = { id: 'c', featureType: 'landmark', geometry: { kind: 'point', coordinates: at(60, 60) }, properties: { name: 'St. Johannes', visual_class: 'place_of_worship', religion: 'christian', height: '20' } }
    const placed = buildTile([church], tile, TILE_Z)
    expect(placed.places).toEqual([{ x: 60, y: 60, n: 'St. Johannes', k: 'place_of_worship', t: { religion: 'christian' } }])
  })

  it('stays small', () => {
    expect(JSON.stringify(built).length).toBeLessThan(900)
  })
})

describe('world lab: streets and water (Thomas, 26.10.2026: „Straßen etwas wild, Kreisel, Wasser“)', () => {
  const line = (points: Array<[number, number]>) => ({ kind: 'line' as const, coordinates: points.map(([x, y]) => at(x, y)) })
  const circle = (cx: number, cy: number, r: number) => Array.from({ length: 17 }, (_, i) => [cx + r * Math.cos(i / 16 * 2 * Math.PI), cy + r * Math.sin(i / 16 * 2 * Math.PI)] as [number, number])
  const features: SourceFeature[] = [
    { id: 'aisle', featureType: 'road', geometry: line([[10, 10], [60, 10]]), properties: { highway: 'service', service: 'parking_aisle', name: 'Parkplatz' } },
    { id: 'zone', featureType: 'road', geometry: line([[20, 20], [60, 20], [60, 50], [20, 50], [20, 20]]), properties: { highway: 'pedestrian', area: 'yes' } },
    { id: 'ring', featureType: 'road', geometry: line(circle(120, 120, 14)), properties: { highway: 'tertiary', junction: 'roundabout' } },
    { id: 'pipe', featureType: 'waterway', geometry: line([[0, 90], [100, 90]]), properties: { waterway: 'stream', tunnel: 'culvert' } },
    { id: 'brook', featureType: 'waterway', geometry: line([[0, 100], [100, 100]]), properties: { waterway: 'stream' } },
  ]
  const out = buildTile(features, tile, TILE_Z)

  it('draws parking aisles as narrow service lanes without a name', () => {
    const aisle = out.roads.find(road => road.c === 'service')
    expect(aisle).toBeDefined()
    expect(aisle!.n).toBeUndefined()
  })
  it('draws a pedestrian area as a paved plaza, not as a road around it', () => {
    expect(out.areas.some(area => area.k === 'plaza')).toBe(true)
    expect(out.roads.filter(road => road.c === 'service')).toHaveLength(1)
  })
  it('marks roundabouts and gives them a green island', () => {
    expect(out.roads.find(road => road.r === 1)).toBeDefined()
    expect(out.islands).toHaveLength(1)
    const island = out.islands![0]
    const xs = island.filter((_, i) => i % 2 === 0)
    // Radius 14 m minus halbe Fahrbahn (3 m) und Rand (0,8 m) ≈ 10 m
    expect(Math.max(...xs) - 120).toBeGreaterThan(9)
    expect(Math.max(...xs) - 120).toBeLessThan(11)
  })
  it('skips culverts and keeps brooks narrow', () => {
    expect(out.rivers).toHaveLength(1)
    expect(out.rw).toEqual([2.4])
  })
})

describe('world lab: finer lines win (Thomas, 27.10.2026: Bahnhof, Kreisel, Brücken)', () => {
  const line = (points: Array<[number, number]>) => ({ kind: 'line' as const, coordinates: points.map(([x, y]) => at(x, y)) })
  it('keeps the most detailed copy of the same OSM way', () => {
    const coarse: SourceFeature = { id: 'a', featureType: 'rail', geometry: line([[10, 10], [150, 150]]), properties: { railway: 'rail', service: 'siding', noxia_source_id: 'osm:way:1' } }
    const fine: SourceFeature = { id: 'b', featureType: 'rail', geometry: line([[10, 10], [40, 20], [80, 60], [120, 120], [150, 150]]), properties: { railway: 'rail', service: 'siding', noxia_source_id: 'osm:way:1' } }
    const out = buildTile([coarse, fine], tile, TILE_Z)
    expect(out.rails).toHaveLength(1)
    expect(out.rails![0].p.length).toBeGreaterThan(4)
  })
  it('marks bridges', () => {
    const out = buildTile([{ id: 'br', featureType: 'road', geometry: line([[10, 50], [40, 50]]), properties: { highway: 'residential', bridge: 'yes' } }], tile, TILE_Z)
    expect(out.roads[0].b).toBe(1)
  })
})

describe('world lab: Gotteshäuser ohne Umriss', () => {
  const landmark = (props: Record<string, unknown>): SourceFeature => ({ id: 'l1', featureType: 'landmark', geometry: { kind: 'point', coordinates: at(80, 90) }, properties: { name: 'Lukaskirche', amenity: 'place_of_worship', building: 'church', noxia_source_id: 'osm:way:264006197', ...props } })
  const road: SourceFeature = { id: 'r1', featureType: 'road', geometry: { kind: 'line', coordinates: [at(0, 100), at(190, 130)] }, properties: { visual_class: 'residential', highway: 'residential' } }

  it('setzt eine Kirche als Haus an den Punkt, wenn die Daten keinen Umriss haben', () => {
    const built = buildTile([landmark({}), road], tile, TILE_Z)
    const church = built.blocks.find(block => block.i === 'osm:way:264006197')
    expect(church?.k).toBe('church')
    expect(church?.nm).toBe('Lukaskirche')
    expect(church!.w).toBeGreaterThan(church!.d)
    // längs der Straße (steigt nach Osten leicht an)
    expect(Math.abs(church!.a)).toBeGreaterThan(0.05)
    expect(Math.abs(church!.a)).toBeLessThan(0.4)
  })

  it('setzt die Rochuskapelle als Achteck', () => {
    const built = buildTile([landmark({ name: 'Rochuskapelle', building: 'chapel', noxia_source_id: 'osm:way:246890728' })], tile, TILE_Z)
    const chapel = built.blocks.find(block => block.i === 'osm:way:246890728')
    expect(chapel?.f).toHaveLength(16)
    expect(chapel!.w).toBeLessThan(12)
  })

  it('setzt kein Ersatzhaus, wenn die Daten den Umriss haben – auch wenn der Punkt zuerst kommt', () => {
    const outline: SourceFeature = { id: 'b1', featureType: 'building', geometry: polygon([[70, 80], [90, 80], [90, 100], [70, 100]]), properties: { building: 'church', amenity: 'place_of_worship', name: 'Lukaskirche', noxia_source_id: 'osm:way:264006197' } }
    const built = buildTile([landmark({}), outline], tile, TILE_Z)
    const churches = built.blocks.filter(block => block.i === 'osm:way:264006197')
    expect(churches).toHaveLength(1)
    expect(churches[0].w).toBeCloseTo(20, 0)
  })
})
