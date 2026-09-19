import { describe, expect, it } from 'vitest'
import { advanceFacilityMaintenance, incidentPressure, serviceFacility } from './facilityMaintenance'

const fresh = { tileEntityId: 'f1', condition: 1, wear: 0, maintenanceDue: false, lastServiceTick: null, updatedTick: null }

describe('facility maintenance', () => {
  it('accumulates deterministic wear from operation and environment', () => {
    const next = advanceFacilityMaintenance(fresh, { utilization: 1, environmentStress: 0.5 }, 1)
    expect(next.wear).toBeCloseTo(0.01)
    expect(next.condition).toBeCloseTo(0.99)
    expect(next.maintenanceDue).toBe(false)
  })

  it('exposes incident pressure only after maintenance is due', () => {
    expect(incidentPressure({ ...fresh, wear: 0.64, condition: 0.36 })).toBe(0)
    expect(incidentPressure({ ...fresh, wear: 0.825, condition: 0.175, maintenanceDue: true })).toBe(0.5)
  })

  it('service restores condition without pretending the facility is factory-new', () => {
    const serviced = serviceFacility({ ...fresh, wear: 0.8, condition: 0.2, maintenanceDue: true }, 50)
    expect(serviced).toMatchObject({ wear: 0.08, condition: 0.92, maintenanceDue: false, lastServiceTick: 50 })
  })
})
