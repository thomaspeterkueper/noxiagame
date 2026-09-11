import { describe, expect, it } from 'vitest'
import { createInteriorInstance, validateInteriorInstance } from './instances'
import { findInteriorRoute, isPortalTraversable } from './navigation'
import { LABORATORY_STANDARD_INTERIOR } from './templates/laboratoryStandard'

describe('interior instances and navigation', () => {
  it('initializes room and portal runtime state from the template', () => {
    const instance = createInteriorInstance(LABORATORY_STANDARD_INTERIOR, {
      id: 'INT:LAB:001',
      buildingInstanceId: 'BLD:LAB:001',
    })

    expect(Object.keys(instance.roomStates)).toHaveLength(LABORATORY_STANDARD_INTERIOR.rooms.length)
    expect(Object.keys(instance.portalStates)).toHaveLength(LABORATORY_STANDARD_INTERIOR.portals.length)
    expect(Object.values(instance.roomStates).every(room => room.operationalState === 'operational')).toBe(true)
    expect(Object.values(instance.roomStates).every(room => room.occupancy === 0)).toBe(true)
    expect(validateInteriorInstance(LABORATORY_STANDARD_INTERIOR, instance)).toEqual([])
  })

  it('detects persisted runtime state that no longer matches its template', () => {
    const instance = createInteriorInstance(LABORATORY_STANDARD_INTERIOR, {
      id: 'INT:LAB:INVALID',
      buildingInstanceId: 'BLD:LAB:INVALID',
    })

    delete instance.roomStates['analysis-lab']
    instance.portalStates['legacy-portal'] = {
      portalId: 'legacy-portal',
      state: 'closed',
    }

    expect(validateInteriorInstance(LABORATORY_STANDARD_INTERIOR, instance).map(issue => issue.code)).toEqual(
      expect.arrayContaining(['missing-room-state', 'unknown-portal-state']),
    )
  })

  it('finds a route through usable portals', () => {
    const instance = createInteriorInstance(LABORATORY_STANDARD_INTERIOR, {
      id: 'INT:LAB:002',
      buildingInstanceId: 'BLD:LAB:002',
    })

    const route = findInteriorRoute(
      LABORATORY_STANDARD_INTERIOR,
      instance,
      'airlock',
      'analysis-lab',
    )

    expect(route).not.toBeNull()
    expect(route?.rooms).toEqual(['airlock', 'corridor-0', 'analysis-lab'])
    expect(route?.steps.map(step => step.portalId)).toEqual([
      'p-airlock-corridor',
      'p-corridor-analysis',
    ])
  })

  it('blocks traversal through locked portals without deleting topology', () => {
    const instance = createInteriorInstance(LABORATORY_STANDARD_INTERIOR, {
      id: 'INT:LAB:003',
      buildingInstanceId: 'BLD:LAB:003',
    })
    const portalId = 'p-corridor-analysis'

    instance.portalStates[portalId].state = 'locked'

    expect(isPortalTraversable(instance, portalId)).toBe(false)
    expect(findInteriorRoute(LABORATORY_STANDARD_INTERIOR, instance, 'airlock', 'analysis-lab')).toBeNull()
  })

  it('allows callers to supply access-control rules independently of portal state', () => {
    const instance = createInteriorInstance(LABORATORY_STANDARD_INTERIOR, {
      id: 'INT:LAB:004',
      buildingInstanceId: 'BLD:LAB:004',
    })

    const route = findInteriorRoute(
      LABORATORY_STANDARD_INTERIOR,
      instance,
      'airlock',
      'analysis-lab',
      { canUsePortal: portalId => portalId !== 'p-corridor-analysis' },
    )

    expect(route).toBeNull()
  })
})
