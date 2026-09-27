import { describe, expect, it } from 'vitest'
import { getInteriorTemplateForBuildingType } from './registry'

describe('cultural place interiors', () => {
  it.each([
    ['resonance_centre', 'resonance-centre-01'],
    ['community_hall', 'community-hall-01'],
    ['archive_library', 'archive-library-01'],
    ['sacred_space', 'sacred-space-01'],
  ])('binds %s to its interior template', (buildingType, templateId) => {
    expect(getInteriorTemplateForBuildingType(buildingType)?.id).toBe(templateId)
  })

  it('keeps the Resonance Centre explicitly plural-use', () => {
    const template = getInteriorTemplateForBuildingType('resonance_centre')
    expect(template?.rooms.some(room => room.tags?.includes('plural-use'))).toBe(true)
    expect(template?.rooms.some(room => room.capabilities?.includes('culture.public-debate'))).toBe(true)
  })

  it('supports provenance work in the archive', () => {
    const template = getInteriorTemplateForBuildingType('archive_library')
    expect(template?.rooms.some(room => room.capabilities?.includes('culture.provenance.verify'))).toBe(true)
  })

  it('does not encode a specific religion into the sacred-space topology', () => {
    const template = getInteriorTemplateForBuildingType('sacred_space')
    expect(template?.rooms.some(room => room.tags?.includes('institution-configurable'))).toBe(true)
  })
})
