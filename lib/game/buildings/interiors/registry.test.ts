import { describe, expect, it } from 'vitest'
import { getInteriorTemplateForBuildingType } from './registry'

describe('shared building interior registry',()=>{
  it.each([
    ['residential_block','habitat-standard-v1'],
    ['medical_core','medical-standard-v1'],
    ['factory','workshop-standard-v1'],
    ['warehouse','logistics-standard-v1'],
    ['school','academy-standard-v1'],
    ['reactor_module','utility-standard-v1'],
    ['admin','civic-standard-v1'],
    ['cafe','cafe-standard-v1'],
    ['bar','bar-standard-v1'],
    ['restaurant','restaurant-standard-v1'],
    ['robotic_kitchen','robotic-kitchen-standard-v1'],
    ['automated_food_service','robotic-kitchen-standard-v1'],
    ['habitat_food_cell','robotic-kitchen-standard-v1'],
    ['church','sacred-place-standard-v1'],
    ['mosque','sacred-place-standard-v1'],
    ['temple','sacred-place-standard-v1'],
    ['resonance_place','resonance-place-standard-v1'],
    ['omnizedenz_resonance_place','resonance-place-standard-v1'],
  ])('maps %s to %s',(buildingId,templateId)=>{
    expect(getInteriorTemplateForBuildingType(buildingId)?.id).toBe(templateId)
  })

  it('keeps unknown buildings explicit instead of inventing a topology',()=>{
    expect(getInteriorTemplateForBuildingType('unknown-building')).toBeNull()
  })
})
