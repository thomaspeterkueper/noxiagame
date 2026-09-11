import { describe, expect, it } from 'vitest'
import { createInteriorInstance } from './instances'
import { findInteriorRoute, isPortalTraversable } from './navigation'
import { LABORATORY_STANDARD_01 } from './templates/laboratoryStandard'

describe('interior instances and navigation', () => {
  it('initializes room and portal runtime state from the template', () => {
    const instance = createInteriorInstance(LABORATORY_STANDARD_01, {
      id: 'INT:LAB:001',
      buildingInstanceId: 'BLD:LAB:001',
    })

    expect(Object.keys(instance.roomStates)).toHaveLength(LABORATORY_STANDARD_01.rooms.length)
    expect(Object.keys(instance.portalStates)).toHaveLength(LABORATORY_STANDARD_01.portals.length)
    expect(Object.values(instance.roomStates).every(room => room.operationalState === 'operational')).toBe(true)
  })

  it('finds a route through usable portals', () => {
    const instance = createInteriorInstance(LABORATORY_STANDARD_01, {
      id: 'INT:LAB:002',
      buildingInstanceId: 'BLD:LAB:002',
    })

    const route = findInteriorRoute(
      LABORATORY_STANDARD_01,
      instance,
      'entrance',
      'analysis-lab',
    )

    expect(route).not.toBeNull()
    expect(route?.rooms[0]).toBe('entrance')
    expect(route?.rooms.at(-1)).toBe('analysis-lab')
  })

  it('blocks traversal through locked portals without deleting topology', () => {
    const instance = createInteriorInstance(LABORATORY_STANDARD_01, {
      id: 'INT:LAB:003',
      buildingInstanceId: 'BLD:LAB:003',
    })
    const portalId = LABORATORY_STANDARD_01.portals.find(portal => portal.toRoomId === 'analysis-lab')?.id
    expect(portalId).toBeTruthy()
    if (!portalId) return

    instance.portalStates[portalId].state = 'locked'

    expect(isPortalTraversable(instance, portalId)).toBe(false)
    expect(findInteriorRoute(LABORATORY_STANDARD_01, instance, 'entrance', 'analysis-lab')).toBeNull()
  })

  it('allows callers to supply access-control rules independently of portal state', () => {
    const instance = createInteriorInstance(LABORATORY_STANDARD_01, {
      id: 'INT:LAB:004',
      buildingInstanceId: 'BLD:LAB:004',
    })

    const route = findInteriorRoute(
      LABORATORY_STANDARD_01,
      instance,
      'entrance',
      'analysis-lab',
      { canUsePortal: portalId => portalId !== 'door-corridor-analysis' },
    )

    expect(route).toBeNull()
  })
})
