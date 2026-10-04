import { describe, expect, it } from 'vitest'
import { buildLocalSurfaceScene } from './localSurfaceScene'
import { buildPlanetaryLocalScene } from './planetaryLocalScene'
import { buildEarthLocalScene } from '../../world/spatial/earthLocalScene'

describe('shared local surface scene', () => {
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
