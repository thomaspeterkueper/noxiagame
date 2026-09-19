import { describe, expect, it } from 'vitest'
import { healthEffectFromFacilityIncident } from './facilityIncidents'

const base = { tick: 20, locationId: 'mars', tileEntityId: 'facility-1', severity: 0.5, causeRef: 'maintenance:seal' }

describe('facility incident health effects', () => {
  it('maps a containment breach affecting a person to environmental exposure', () => {
    expect(healthEffectFromFacilityIncident({ ...base, kind: 'containment_breach', affectedPersonId: 'p1' }))
      .toEqual({ eventType: 'environmental_exposure', severity: 0.5 })
  })

  it('maps an explicit workplace accident to injury', () => {
    expect(healthEffectFromFacilityIncident({ ...base, kind: 'workplace_accident', affectedPersonId: 'p1' }))
      .toEqual({ eventType: 'workplace_accident', severity: 0.5 })
  })

  it('does not injure anyone for equipment failure without an affected person', () => {
    expect(healthEffectFromFacilityIncident({ ...base, kind: 'equipment_failure', affectedPersonId: null })).toBeNull()
  })

  it('does not infer injury from equipment failure alone', () => {
    expect(healthEffectFromFacilityIncident({ ...base, kind: 'equipment_failure', affectedPersonId: 'p1' })).toBeNull()
  })
})
