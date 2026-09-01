import { describe, expect, it } from 'vitest'
import { BUILDING_TECHNICAL_PROVENANCE } from './technicalProvenance'

describe('building technical provenance', () => {
  it('binds the four resolved generic dossier gaps', () => {
    expect(BUILDING_TECHNICAL_PROVENANCE.mine).toMatchObject({
      sourceDocumentId: 'DOC:OTA:OTA-TEC-0108-2026-DE',
      sharedObjectId: 'BLD:NOX:mine-1',
      mappingRole: 'implements',
    })
    expect(BUILDING_TECHNICAL_PROVENANCE.solar).toMatchObject({
      sourceDocumentId: 'DOC:OTA:OTA-TEC-0109-2026-DE',
      sharedObjectId: 'BLD:NOX:solarfeld-1',
      mappingRole: 'implements',
    })
    expect(BUILDING_TECHNICAL_PROVENANCE.laboratory).toMatchObject({
      sourceDocumentId: 'DOC:OTA:OTA-TEC-0110-2026-DE',
      mappingRole: 'references',
    })
    expect(BUILDING_TECHNICAL_PROVENANCE.scanner).toMatchObject({
      sourceDocumentId: 'DOC:OTA:OTA-TEC-0111-2026-DE',
      sharedObjectId: 'BLD:NOX:scanner-1',
      mappingRole: 'implements',
    })
  })

  it('keeps ambiguous generalizations relation-based', () => {
    expect(BUILDING_TECHNICAL_PROVENANCE.factory.mappingRole).toBe('references')
    expect(BUILDING_TECHNICAL_PROVENANCE.ice_drill.mappingRole).toBe('specializes')
    expect(BUILDING_TECHNICAL_PROVENANCE.habitat.mappingRole).toBe('references')
    expect(BUILDING_TECHNICAL_PROVENANCE.residential_block.mappingRole).toBe('references')
    expect(BUILDING_TECHNICAL_PROVENANCE.smelter.mappingRole).toBe('specializes')
  })

  it('does not fabricate technical provenance for gameplay/service-only buildings', () => {
    for (const id of ['school', 'bank', 'admin', 'bar']) {
      expect(BUILDING_TECHNICAL_PROVENANCE[id]).toBeUndefined()
    }
  })

  it('keeps NOXIA balancing outside provenance records', () => {
    for (const provenance of Object.values(BUILDING_TECHNICAL_PROVENANCE)) {
      expect(provenance).not.toHaveProperty('cost')
      expect(provenance).not.toHaveProperty('buildTimeTicks')
      expect(provenance).not.toHaveProperty('produces')
      expect(provenance).not.toHaveProperty('populationBonus')
      expect(provenance.evidenceImpactPolicy).toBe('signal-only')
    }
  })
})
