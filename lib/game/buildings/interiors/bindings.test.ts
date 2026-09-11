import { describe, expect, it } from 'vitest'
import { createInteriorForBuildingInstance } from './bindings'
import { getInteriorTemplateForBuildingType } from './registry'

describe('building interior binding', () => {
  it('resolves the standard laboratory template by building type', () => {
    const template = getInteriorTemplateForBuildingType('laboratory')

    expect(template?.id).toBe('laboratory-standard-01')
    expect(template?.buildingTypeId).toBe('laboratory')
  })

  it('creates an interior instance for a bindable laboratory building', () => {
    const result = createInteriorForBuildingInstance(
      { id: 'BLD:LAB:EARTH:001', buildingTypeId: 'laboratory' },
      { interiorInstanceId: 'INT:LAB:EARTH:001' },
    )

    expect(result).not.toBeNull()
    expect(result?.buildingInstanceId).toBe('BLD:LAB:EARTH:001')
    expect(result?.interior.templateId).toBe('laboratory-standard-01')
    expect(result?.interior.buildingInstanceId).toBe('BLD:LAB:EARTH:001')
  })

  it('uses the same template regardless of world-body naming outside the binding contract', () => {
    const earth = createInteriorForBuildingInstance(
      { id: 'BLD:LAB:EARTH:002', buildingTypeId: 'laboratory' },
      { interiorInstanceId: 'INT:LAB:EARTH:002' },
    )
    const moon = createInteriorForBuildingInstance(
      { id: 'BLD:LAB:MOON:002', buildingTypeId: 'laboratory' },
      { interiorInstanceId: 'INT:LAB:MOON:002' },
    )
    const mars = createInteriorForBuildingInstance(
      { id: 'BLD:LAB:MARS:002', buildingTypeId: 'laboratory' },
      { interiorInstanceId: 'INT:LAB:MARS:002' },
    )

    expect(earth?.interior.templateId).toBe('laboratory-standard-01')
    expect(moon?.interior.templateId).toBe('laboratory-standard-01')
    expect(mars?.interior.templateId).toBe('laboratory-standard-01')
  })

  it('returns null for building types without an interior template', () => {
    const result = createInteriorForBuildingInstance(
      { id: 'BLD:ROAD:001', buildingTypeId: 'road' },
      { interiorInstanceId: 'INT:ROAD:001' },
    )

    expect(result).toBeNull()
  })
})
