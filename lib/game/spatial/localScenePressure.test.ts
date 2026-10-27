import { describe, expect, it } from 'vitest'
import { buildLocalSurfaceScene } from './localSurfaceScene'
import { isInsidePressurizedSpace, isLocalScenePointWalkable, pressurizedBuildingAt, resolveLocalSceneStep, routeAcrossLocalScene } from './localSceneRuntime'

// Habitat und Lebenserhaltung über einen Druckkorridor verbunden; draußen eine Piste zum Fahrzeughof.
const scene = buildLocalSurfaceScene({
  body: 'phobos', frameId: 'test', radiusM: 300,
  buildings: [
    { id: 'hab', center: { xM: 0, yM: 0 }, widthM: 26, depthM: 20, rotationDeg: 0, provenance: 'canonical', entityId: 'habitat' },
    { id: 'ls', center: { xM: 40, yM: 0 }, widthM: 22, depthM: 22, rotationDeg: 0, provenance: 'canonical', entityId: 'life_support_hub' },
    { id: 'yard', center: { xM: 140, yM: 0 }, widthM: 34, depthM: 26, rotationDeg: 0, provenance: 'canonical', entityId: 'rover_yard' },
    { id: 'pad', center: { xM: 220, yM: -100 }, widthM: 70, depthM: 55, rotationDeg: 0, provenance: 'canonical', entityId: 'landing_pad_phobos' },
  ],
  paths: [
    { id: 'tube', kind: 'pressurized-corridor', points: [{ xM: 0, yM: 0 }, { xM: 40, yM: 0 }] },
    { id: 'track', kind: 'service-path', points: [{ xM: 40, yM: 0 }, { xM: 140, yM: 0 }] },
  ],
})
const none = { pressurized: true as const, outfit: 'none' as const }
const suit = { pressurized: true as const, outfit: 'suit' as const }
const rover = { pressurized: true as const, outfit: 'rover' as const }

describe('local scene: walking where there is air (Phobos, Moon, Mars)', () => {
  it('knows where the air is: pressurized buildings and corridors, not yards or pads', () => {
    expect(isInsidePressurizedSpace(scene, { xM: 0, yM: 0 })).toBe(true)
    expect(isInsidePressurizedSpace(scene, { xM: 20, yM: 1 })).toBe(true)      // im Druckkorridor
    expect(isInsidePressurizedSpace(scene, { xM: 90, yM: 0 })).toBe(false)     // auf der Piste draußen
    expect(isInsidePressurizedSpace(scene, { xM: 140, yM: 0 })).toBe(false)    // offener Fahrzeughof
    expect(isInsidePressurizedSpace(scene, { xM: 220, yM: -100 })).toBe(false) // Landeplatz
    expect(pressurizedBuildingAt(scene, { xM: 40, yM: 5 })?.id).toBe('ls')
  })

  it('without a suit you walk through buildings and corridors, but not outside', () => {
    expect(isLocalScenePointWalkable(scene, { xM: 5, yM: 3 }, 0.8, none)).toBe(true)   // mitten durchs Habitat
    expect(isLocalScenePointWalkable(scene, { xM: 0, yM: 40 }, 0.8, none)).toBe(false) // draußen
    // Schritt nach draußen bleibt an der Wand stehen
    const stopped = resolveLocalSceneStep(scene, { xM: 0, yM: 8 }, { xM: 0, yM: 14 }, 0.8, none)
    expect(stopped.yM).toBeLessThanOrEqual(10)
    // Route zur Lebenserhaltung geht durch den Korridor, nicht über die Piste
    const route = routeAcrossLocalScene(scene, { xM: 0, yM: 0 }, { xM: 40, yM: 0 }, { rules: none })
    expect(route.usesNetwork).toBe(true)
    expect(route.points.every(point => isInsidePressurizedSpace(scene, point))).toBe(true)
  })

  it('in a suit you go anywhere; in a rover only outside', () => {
    expect(isLocalScenePointWalkable(scene, { xM: 0, yM: 40 }, 0.8, suit)).toBe(true)
    expect(isLocalScenePointWalkable(scene, { xM: 0, yM: 0 }, 0.8, suit)).toBe(true)
    expect(isLocalScenePointWalkable(scene, { xM: 90, yM: 0 }, 0.8, rover)).toBe(true)
    expect(isLocalScenePointWalkable(scene, { xM: 0, yM: 0 }, 0.8, rover)).toBe(false)
    expect(isLocalScenePointWalkable(scene, { xM: 140, yM: 0 }, 0.8, rover)).toBe(true) // Fahrzeughof
  })

  it('leaves Earth as it was: buildings block', () => {
    expect(isLocalScenePointWalkable(scene, { xM: 0, yM: 0 })).toBe(false)
  })
})
