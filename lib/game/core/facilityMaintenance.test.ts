import { describe, expect, it } from 'vitest'
import { maintenanceIncidentPressure, projectFacilityMaintenance, projectFacilityOperation } from './facilityMaintenance'

const healthy = { tileEntityId: 'f1', condition: 1, wear: 0, maintenanceDue: false, lastMaintainedTick: null, updatedTick: null }

describe('facility maintenance', () => {
  it('accumulates wear from actual operating load', () => {
    const next = projectFacilityOperation(healthy, { wearRate: 0.1, load: 0.8 }, 10)
    expect(next.wear).toBeCloseTo(0.08)
    expect(next.condition).toBeCloseTo(0.92)
    expect(maintenanceIncidentPressure(next)).toBe('none')
  })

  it('marks degraded facilities as maintenance due', () => {
    const next = projectFacilityOperation({ ...healthy, wear: 0.58, condition: 0.42 }, { wearRate: 0.05, load: 1 }, 11)
    expect(next.maintenanceDue).toBe(true)
    expect(maintenanceIncidentPressure(next)).toBe('degraded')
  })

  it('maintenance restores condition deterministically', () => {
    const next = projectFacilityMaintenance({ ...healthy, wear: 0.8, condition: 0.2, maintenanceDue: true }, 12, 0.9)
    expect(next.condition).toBe(0.9)
    expect(next.wear).toBeCloseTo(0.1)
    expect(next.maintenanceDue).toBe(false)
  })
})
