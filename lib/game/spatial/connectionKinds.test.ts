import { describe, expect, it } from 'vitest'
import { isPassageConnection } from './connectionKinds'

describe('connections between modules', () => {
  it('treats corridors and former tether links as passages, cables as lines outside', () => {
    expect(isPassageConnection('pressurized-corridor')).toBe(true)
    expect(isPassageConnection('cargo-transfer-link')).toBe(true)
    expect(isPassageConnection('tether-corridor')).toBe(true)
    expect(isPassageConnection('anchor-tether')).toBe(true)
    expect(isPassageConnection('utility-umbilical')).toBe(false)
    expect(isPassageConnection('anchor-line')).toBe(false)
    expect(isPassageConnection('hardened-road')).toBe(false)
  })
})

import { PHOBOS_BASE_ALPHA_LOGISTICS, PHOBOS_BASE_ALPHA_NODES } from '@/lib/game/seeds/phobosBaseAlphaSeed'
import { buildPlanetaryLocalScene } from './planetaryLocalScene'
import { advanceAlongLocalSceneRoute, isInsidePressurizedSpace, routeAcrossLocalScene } from './localSceneRuntime'

describe('Stickney: the whole base connected inside', () => {
  it('walks from the habitat to the warehouse and the workshop without a suit', () => {
    const nodes = new Map(PHOBOS_BASE_ALPHA_NODES.map(node => [node.id, node]))
    const scene = buildPlanetaryLocalScene({
      body: 'phobos', frameId: 'test', radiusM: 300,
      entities: PHOBOS_BASE_ALPHA_NODES.map(node => ({ id: node.id, entity_id: node.catalogEntityId, x_m: node.xM, y_m: node.yM, rotation_deg: node.rotationDeg, footprint_width_m: node.footprintWidthM, footprint_depth_m: node.footprintDepthM })),
      corridors: PHOBOS_BASE_ALPHA_LOGISTICS.map((edge, i) => ({ id: 'c' + i, pressurized: isPassageConnection(edge.corridor), points: [nodes.get(edge.from)!, nodes.get(edge.to)!].map(n => ({ xM: n.xM, yM: n.yM })) })),
    })
    const rules = { pressurized: true as const, outfit: 'none' as const }
    for (const target of ['phobos_warehouse_1', 'phobos_workshop_1']) {
      const goal = nodes.get(target)!
      // Wie in der Szene: Route nach jedem Schritt neu von der aktuellen Lage
      let at = { xM: 0, yM: 0 }
      for (let step = 0; step < 200; step++) at = advanceAlongLocalSceneRoute(scene, at, routeAcrossLocalScene(scene, at, { xM: goal.xM, yM: goal.yM }, { rules }), 2.4, rules)
      expect(Math.hypot(at.xM - goal.xM, at.yM - goal.yM)).toBeLessThan(1)
      expect(isInsidePressurizedSpace(scene, at)).toBe(true)
    }
  })
})
