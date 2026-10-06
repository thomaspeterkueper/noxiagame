import { describe, expect, it } from 'vitest'
import { getInteriorTemplateForBuildingType } from '@/lib/game/buildings/interiors/registry'
import { targetInteriorRoom } from './interiorPresence'

describe('NPC interior room targeting',()=>{
  it('sends resting residents toward quarters',()=>{
    const template=getInteriorTemplateForBuildingType('residential_block')!
    expect(targetInteriorRoom({template,activity:'resting',assignmentType:'home',roleCode:'resident'})).toBe('quarters')
  })

  it('sends medical work toward treatment',()=>{
    const template=getInteriorTemplateForBuildingType('medical_core')!
    expect(targetInteriorRoom({template,activity:'working',assignmentType:'work',roleCode:'medical_service'})).toBe('reception')
  })

  it('sends technical inspection into the plant',()=>{
    const template=getInteriorTemplateForBuildingType('reactor_module')!
    expect(targetInteriorRoom({template,activity:'inspecting',assignmentType:'work',roleCode:'technician'})).toBe('plant')
  })

  it('uses social rooms for social interaction',()=>{
    const template=getInteriorTemplateForBuildingType('habitat_cluster')!
    expect(targetInteriorRoom({template,activity:'socialising',assignmentType:'home',roleCode:'resident'})).toBe('common')
  })

  it('keeps travelling people at an entry room',()=>{
    const template=getInteriorTemplateForBuildingType('warehouse')!
    expect(targetInteriorRoom({template,activity:'travelling',assignmentType:'work',roleCode:'logistics'})).toBe('receiving')
  })
})
