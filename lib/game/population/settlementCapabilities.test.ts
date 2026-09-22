import { describe, expect, it } from 'vitest'
import {
  createUnassessedHumanCapabilityProfile,
  hasSettlementHumanCapability,
  type SettlementHumanCapabilityProfile,
} from './settlementCapabilities'

describe('settlement human capabilities', () => {
  it('does not infer higher capabilities from adult survival', () => {
    const profile: SettlementHumanCapabilityProfile = {
      ...createUnassessedHumanCapabilityProfile('mars:tharsis'),
      capabilities: ['adult-survival-capable'],
    }

    expect(hasSettlementHumanCapability(profile, 'adult-survival-capable')).toBe(true)
    expect(hasSettlementHumanCapability(profile, 'pregnancy-and-birth-capable')).toBe(false)
    expect(hasSettlementHumanCapability(profile, 'child-development-capable')).toBe(false)
    expect(hasSettlementHumanCapability(profile, 'multigenerational-capable')).toBe(false)
  })

  it('starts unassessed without inventing biological capability', () => {
    const profile = createUnassessedHumanCapabilityProfile('moon:shackleton')
    expect(profile.capabilities).toEqual([])
    expect(profile.gravityArchitecture).toBe('native-only')
    expect(profile.evidenceSourceDocumentId).toBe('OTA-SCI-0086-2026-DE')
  })
})
