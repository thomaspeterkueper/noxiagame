import { describe, expect, it } from 'vitest'
import {
  assessSettlementHumanCapabilities,
  type SettlementCapabilityEvidence,
} from './settlementCapabilityGraph'

const evidence = (support: SettlementCapabilityEvidence['support']): SettlementCapabilityEvidence => ({
  support,
  sourceRef: 'test',
  operational: true,
})

describe('settlement capability graph', () => {
  it('does not treat a medical center as a magic reproduction unlock', () => {
    const result = assessSettlementHumanCapabilities('mars:tharsis', [
      evidence('habitation'), evidence('eclss'), evidence('general-medical-care'),
      evidence('radiation-safe-haven'),
    ])
    expect(result.profile.capabilities).toContain('adult-survival-capable')
    expect(result.profile.capabilities).not.toContain('pregnancy-and-birth-capable')
    expect(result.missingByCapability['pregnancy-and-birth-capable']).toEqual(
      expect.arrayContaining(['pregnancy-monitoring', 'operative-obstetrics', 'neonatal-care']),
    )
  })

  it('derives multigenerational capability only from the complete service graph', () => {
    const supports = [
      'habitation','eclss','general-medical-care','pregnancy-monitoring',
      'operative-obstetrics','neonatal-care','radiation-safe-haven',
      'child-development-space','schooling','developmental-monitoring',
      'gravity-transition-support',
    ] as const
    const result = assessSettlementHumanCapabilities(
      'station:test',
      supports.map(evidence),
      'mixed-gravity',
    )
    expect(result.profile.capabilities).toContain('multigenerational-capable')
    expect(result.profile.gravityArchitecture).toBe('mixed-gravity')
  })

  it('ignores non-operational infrastructure', () => {
    const result = assessSettlementHumanCapabilities('moon:test', [
      { support: 'habitation', sourceRef: 'hab-1', operational: false },
    ])
    expect(result.profile.capabilities).toEqual([])
  })
})
