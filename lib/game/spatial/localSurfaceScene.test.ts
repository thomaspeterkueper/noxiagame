import { describe, expect, it } from 'vitest'
import { buildLocalSurfaceScene } from './localSurfaceScene'
import { buildPlanetaryLocalScene } from './planetaryLocalScene'
import { buildEarthLocalScene } from '../../world/spatial/earthLocalScene'

describe('shared local surface scene', () => {
  it('keeps land cover that encloses the scene without a vertex inside it', () => {
    const origin = { lat: 51.3298, lon: 8.0073 }
    const ring = (d: number) => [
      { lat: origin.lat - d, lon: origin.lon - d },
      { lat: origin.lat - d, lon: origin.lon + d },
      { lat: origin.lat + d, lon: origin.lon + d },
      { lat: origin.lat + d, lon: origin.lon - d },
      { lat: origin.lat - d, lon: origin.lon - d },
    ]
    const scene = buildEarthLocalScene({
      origin,
      radiusM: 260,
      features: [
        { id: 'forest-around', featureType: 'forest', geometry: { kind: 'polygon', coordinates: ring(.02) }, properties: { landuse: 'forest' } },
        { id: 'meadow-around', featureType: 'farmland', geometry: { kind: 'polygon', coordinates: ring(.03) }, properties: { landuse: 'meadow' } },
        { id: 'forest-far', featureType: 'forest', geometry: { kind: 'polygon', coordinates: ring(.002).map(p => ({ lat: p.lat + .1, lon: p.lon })) }, properties: {} },
        { id: 'river', featureType: 'waterway', geometry: { kind: 'line', coordinates: [{ lat: origin.lat - .02, lon: origin.lon }, { lat: origin.lat + .02, lon: origin.lon }] }, properties: { waterway: 'river' } },
      ],
    })

    expect(scene.polygons.map(polygon => polygon.id)).toEqual(['forest-around', 'meadow-around'])
    expect(scene.polygons[1].className).toBe('meadow')
    expect(scene.paths).toHaveLength(1)
    expect(scene.paths[0].className).toBe('river')
  })

  it('derives placeholder massing only where no real footprint is known', () => {
    const origin = { lat: 51.3298, lon: 8.0073 }
    const square = (lat: number, lon: number, d: number) => [
      { lat: lat - d, lon: lon - d }, { lat: lat - d, lon: lon + d }, { lat: lat + d, lon: lon + d }, { lat: lat + d, lon: lon - d }, { lat: lat - d, lon: lon - d },
    ]
    const urban = { id: 'urban-1', featureType: 'urban', geometry: { kind: 'polygon' as const, coordinates: square(origin.lat, origin.lon, .001) }, properties: { landuse: 'residential' } }
    const house = { id: 'house-1', featureType: 'building', geometry: { kind: 'polygon' as const, coordinates: square(origin.lat, origin.lon, .00005) }, properties: { building: 'house' } }

    const withoutFootprints = buildEarthLocalScene({ origin, radiusM: 260, features: [urban] })
    expect(withoutFootprints.buildings.length).toBeGreaterThan(0)
    expect(withoutFootprints.buildings.every(building => building.provenance === 'derived')).toBe(true)

    const withFootprints = buildEarthLocalScene({ origin, radiusM: 260, features: [urban, house] })
    expect(withFootprints.buildings.map(building => building.id)).toEqual(['house-1'])
  })

  it('uses one scene contract for Earth geography', () => {
    const scene = buildEarthLocalScene({
      origin: { lat: 51.3298, lon: 8.0073 },
      radiusM: 260,
      features: [
        {
          id: 'road-1',
          featureType: 'road',
          geometry: {
            kind: 'line',
            coordinates: [
              { lat: 51.3298, lon: 8.0073 },
              { lat: 51.3300, lon: 8.0076 },
            ],
          },
          properties: { highway: 'residential' },
        },
      ],
    })

    expect(scene.body).toBe('earth')
    expect(scene.frameId).toBe('earth-wgs84-local-enu')
    expect(scene.roadGraph).toHaveLength(1)
  })

  it('uses the same scene contract for a Moon metric surface', () => {
    const scene = buildPlanetaryLocalScene({
      body: 'moon',
      frameId: 'moon_shackleton_local',
      radiusM: 260,
      entities: [
        {
          id: 'hab-1',
          entity_id: 'habitat',
          name: 'Habitat',
          x_m: 12,
          y_m: -8,
          footprint_width_m: 20,
          footprint_depth_m: 14,
          rotation_deg: 90,
        },
      ],
      corridors: [
        {
          id: 'road-1',
          kind: 'hardened-road',
          points: [{ xM: 0, yM: 0 }, { xM: 40, yM: 0 }],
        },
      ],
      mobileObjects: [{ id: 'rover-1', label: 'Rover', xM: 20, yM: 5, role: 'rover' }],
    })

    expect(scene.body).toBe('moon')
    expect(scene.buildings[0]?.provenance).toBe('canonical')
    expect(scene.roadGraph).toHaveLength(1)
    expect(scene.mobileObjects).toHaveLength(1)
  })

  it('keeps route semantics body-independent', () => {
    const scene = buildLocalSurfaceScene({
      body: 'phobos',
      frameId: 'phobos_stickney_local',
      radiusM: 200,
      paths: [
        { id: 'service', kind: 'service-path', points: [{ xM: 0, yM: 0 }, { xM: 10, yM: 4 }] },
        { id: 'rail', kind: 'rail', points: [{ xM: 0, yM: 0 }, { xM: 30, yM: 0 }] },
      ],
    })

    expect(scene.roadGraph.map(item => item.id)).toEqual(['service'])
    expect(scene.railGraph.map(item => item.id)).toEqual(['rail'])
  })
})
