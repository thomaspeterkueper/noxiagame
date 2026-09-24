import { describe, expect, it } from 'vitest'
import {
  assessCanonicalTharsisHubSeed,
  projectBuildingCapabilityEvidence,
} from './settlementCapabilityProjection'

describe('settlement capability projection', () => {
  it('projects known building functions without inventing specialist medicine', () => {
    const evidence = projectBuildingCapabilityEvidence([
      { id: 'med-1', entityId: 'medical_core', operational: true },
      { id: 'hab-1', entityId: 'habitat_cluster', operational: true },
    ])
    expect(evidence.map(item => item.support)).toEqual(
      expect.arrayContaining(['general-medical-care', 'habitation', 'radiation-safe-haven']),
    )
    expect(evidence.map(item => item.support)).not.toContain('operative-obstetrics')
    expect(evidence.map(item => item.support)).not.toContain('neonatal-care')
  })

  it('classifies the canonical Tharsis seed conservatively', () => {
    const result = assessCanonicalTharsisHubSeed()
    expect(result.profile.capabilities).toContain('adult-survival-capable')
    expect(result.profile.capabilities).not.toContain('pregnancy-and-birth-capable')
    expect(result.profile.capabilities).not.toContain('child-development-capable')
    expect(result.profile.capabilities).not.toContain('multigenerational-capable')
    expect(result.missingByCapability['pregnancy-and-birth-capable']).toEqual(
      expect.arrayContaining(['pregnancy-monitoring', 'operative-obstetrics', 'neonatal-care']),
    )
  })

  it('does not count failed buildings as operational evidence', () => {
    const evidence = projectBuildingCapabilityEvidence([
      { id: 'eclss-1', entityId: 'eclss_hub', operational: false },
    ])
    expect(evidence).toEqual([
      { support: 'eclss', sourceRef: 'building:eclss-1', operational: false },
    ])
  })
})
