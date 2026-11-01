import { describe, expect, it } from 'vitest'
import { buildLocalSurfaceScene } from './localSurfaceScene'
import {
  isLocalScenePointWalkable,
  localSceneInteractionDistance,
  localSceneInteractions,
  resolveLocalSceneStep,
  routeAcrossLocalScene,
  targetAccessDistance,
} from './localSceneRuntime'

describe('shared local scene runtime', () => {
  const scene = buildLocalSurfaceScene({
    body: 'moon',
    frameId: 'test',
    radiusM: 100,
    paths: [
      {
        id: 'west-east',
        kind: 'service-path',
        points: [{ xM: -40, yM: 0 }, { xM: 0, yM: 0 }, { xM: 40, yM: 0 }],
      },
      {
        id: 'north',
        kind: 'service-path',
        points: [{ xM: 0, yM: 0 }, { xM: 0, yM: 40 }],
      },
    ],
    buildings: [
      {
        id: 'hab-1',
        center: { xM: 20, yM: 12 },
        widthM: 12,
        depthM: 10,
        rotationDeg: 0,
        provenance: 'canonical',
        label: 'Habitat',
        entityId: 'habitat',
      },
    ],
    mobileObjects: [
      { id: 'rover-1', point: { xM: -20, yM: 4 }, label: 'Rover 1', role: 'rover' },
      { id: 'crew-1', point: { xM: 0, yM: 20 }, label: 'Crew 1', role: 'crew' },
    ],
  })

  it('routes over the shared path network instead of drawing only a direct line', () => {
    const route = routeAcrossLocalScene(scene, { xM: -35, yM: 3 }, { xM: 2, yM: 35 })
    expect(route.usesNetwork).toBe(true)
    expect(route.points.length).toBeGreaterThan(3)
    expect(route.points.some(point => Math.abs(point.xM) < 0.1 && Math.abs(point.yM) < 0.1)).toBe(true)
    expect(route.distanceM).toBeGreaterThan(60)
  })

  it('prevents actors from walking through building footprints and allows axis sliding', () => {
    expect(isLocalScenePointWalkable(scene, { xM: 20, yM: 12 })).toBe(false)
    const stopped = resolveLocalSceneStep(scene, { xM: 12, yM: 12 }, { xM: 20, yM: 12 })
    expect(stopped).toEqual({ xM: 12, yM: 12 })

    const slid = resolveLocalSceneStep(scene, { xM: 12, yM: 4 }, { xM: 17, yM: 10 })
    expect(slid).toEqual({ xM: 17, yM: 4 })
  })

  it('derives building, vehicle and person interactions from one scene contract', () => {
    const interactions = localSceneInteractions(scene)
    expect(interactions.find(item => item.label === 'Habitat')?.kind).toBe('building')
    expect(interactions.find(item => item.label === 'Rover 1')?.kind).toBe('vehicle')
    expect(interactions.find(item => item.label === 'Crew 1')?.kind).toBe('person')

    const habitat = interactions.find(item => item.label === 'Habitat')
    expect(habitat).toBeTruthy()
    expect(localSceneInteractionDistance({ xM: 13, yM: 12 }, habitat!)).toBeCloseTo(1, 5)
  })

  it('falls back to a direct local route if no usable network exists', () => {
    const empty = buildLocalSurfaceScene({ body: 'deimos', frameId: 'empty', radiusM: 100 })
    const route = routeAcrossLocalScene(empty, { xM: 0, yM: 0 }, { xM: 3, yM: 4 })
    expect(route.usesNetwork).toBe(false)
    expect(route.distanceM).toBe(5)
    expect(route.points).toHaveLength(2)
  })

  // A real outline: a hall running diagonally across the scene. Its bounding
  // box is a 60 m square, the hall itself only a 10 m wide strip.
  const diagonal = buildLocalSurfaceScene({
    body: 'earth',
    frameId: 'diagonal',
    radiusM: 100,
    paths: [],
    buildings: [{
      id: 'hall',
      center: { xM: 0, yM: 0 },
      widthM: 60,
      depthM: 60,
      rotationDeg: 0,
      provenance: 'observed',
      footprint: [{ xM: -30, yM: -23 }, { xM: -23, yM: -30 }, { xM: 30, yM: 23 }, { xM: 23, yM: 30 }],
    }],
  })

  it('blocks a building by its outline, not by its bounding box', () => {
    expect(isLocalScenePointWalkable(diagonal, { xM: 0, yM: 0 })).toBe(false)
    expect(isLocalScenePointWalkable(diagonal, { xM: 20, yM: -20 })).toBe(true)
    expect(isLocalScenePointWalkable(diagonal, { xM: -20, yM: 20 })).toBe(true)
    // close to the wall counts as blocked, a step further does not
    expect(isLocalScenePointWalkable(diagonal, { xM: 3.9, yM: -3.9 })).toBe(false)
    expect(isLocalScenePointWalkable(diagonal, { xM: 7, yM: -7 })).toBe(true)
  })

  it('lets someone who stands inside a building walk out again', () => {
    const inside = { xM: 0, yM: 0 }
    const out = resolveLocalSceneStep(diagonal, inside, { xM: 4, yM: -4 })
    expect(out).toEqual({ xM: 4, yM: -4 })
    // from walkable ground the wall still stops the step
    const outside = { xM: 10, yM: -10 }
    expect(resolveLocalSceneStep(diagonal, outside, { xM: 2, yM: -2 })).not.toEqual({ xM: 2, yM: -2 })
  })

  it('measures landmark access to the building edge when the POI centre lies inside a footprint (church entry)', () => {
    const player = { xM: 8, yM: 12 }
    const centre = { xM: 20, yM: 12 }
    expect(Math.hypot(centre.xM - player.xM, centre.yM - player.yM)).toBe(12)
    expect(targetAccessDistance(scene, { xM: 4, yM: 12 }, centre)).toBeCloseTo(10, 5)
    expect(targetAccessDistance(scene, player, centre)).toBeCloseTo(6, 5)
  })

  it('keeps centre distance for targets outside any building (control case)', () => {
    expect(targetAccessDistance(scene, { xM: -20, yM: 4 }, { xM: -30, yM: 4 })).toBeCloseTo(10, 5)
  })
})
