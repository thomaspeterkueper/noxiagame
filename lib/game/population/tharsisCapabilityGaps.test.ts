import { describe, expect, it } from 'vitest'
import {
  getCanonicalTharsisCapabilityGaps,
  getModulesForCapabilityGap,
  THARSIS_CAPABILITY_GAP_MODULES,
} from './tharsisCapabilityGaps'

describe('Tharsis capability gap plan', () => {
  it('keeps reproductive medicine as an explicit medical extension', () => {
    const gaps = getCanonicalTharsisCapabilityGaps()
    expect(gaps['pregnancy-and-birth-capable']).toEqual(
      expect.arrayContaining(['pregnancy-monitoring', 'operative-obstetrics', 'neonatal-care']),
    )
    expect(getModulesForCapabilityGap('pregnancy-and-birth-capable').map(m => m.id))
      .toContain('perinatal-care-suite')
  })

  it('models child development across habitat, education, medicine and transition services', () => {
    const modules = getModulesForCapabilityGap('child-development-capable').map(m => m.id)
    expect(modules).toEqual(expect.arrayContaining([
      'child-development-zone',
      'development-services',
      'gravity-transition-service',
    ]))
  })

  it('does not introduce artificial gravity as a biological unlock', () => {
    expect(THARSIS_CAPABILITY_GAP_MODULES.flatMap(m => m.provides))
      .not.toContain('artificial-gravity-access')
  })
})
