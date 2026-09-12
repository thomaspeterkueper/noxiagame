import { describe, expect, it } from 'vitest'
import {
  getInteriorFunctionDomainBinding,
  hasRequiredDomainObjects,
  INTERIOR_FUNCTION_DOMAIN_BINDINGS,
  type InteriorDomainObjectRef,
} from './domainBindings'

describe('interior function domain bindings', () => {
  it('requires a physical sample and instrument for laboratory measurements', () => {
    const binding = getInteriorFunctionDomainBinding('sample.raman-ir-analysis')
    expect(binding).not.toBeNull()
    if (!binding) return

    expect(binding.requiredInputs).toEqual(['sample', 'instrument'])
    expect(binding.expectedOutputs).toEqual(['measurement', 'raw-data'])

    const sampleOnly: InteriorDomainObjectRef[] = [{ kind: 'sample', id: 'SAMPLE:001' }]
    expect(hasRequiredDomainObjects(binding, sampleOnly)).toBe(false)

    const ready: InteriorDomainObjectRef[] = [
      { kind: 'sample', id: 'SAMPLE:001' },
      { kind: 'instrument', id: 'INSTRUMENT:RAMAN:001' },
    ]
    expect(hasRequiredDomainObjects(binding, ready)).toBe(true)
  })

  it('keeps measurement acquisition separate from knowledge-driven interpretation', () => {
    const measurement = getInteriorFunctionDomainBinding('sample.basic-analysis')
    const reanalysis = getInteriorFunctionDomainBinding('data.reanalyse')

    expect(measurement?.expectedOutputs).toEqual(['measurement', 'raw-data'])
    expect(measurement?.authoritativeDomains).not.toContain('knowledge')

    expect(reanalysis?.requiredInputs).toEqual(['raw-data'])
    expect(reanalysis?.expectedOutputs).toEqual(['interpretation', 'discovery'])
    expect(reanalysis?.authoritativeDomains).toContain('knowledge')
  })

  it('does not model ground truth as an interior-owned domain object', () => {
    const serialized = JSON.stringify(INTERIOR_FUNCTION_DOMAIN_BINDINGS)
    expect(serialized).not.toContain('ground-truth')
    expect(serialized).not.toContain('groundTruth')
  })

  it('delegates non-research actions to their existing authoritative domains', () => {
    expect(getInteriorFunctionDomainBinding('cargo.transfer')?.authoritativeDomains)
      .toEqual(['logistics', 'inventory', 'vehicles'])
    expect(getInteriorFunctionDomainBinding('station.dock')?.authoritativeDomains)
      .toEqual(['orbit', 'travel', 'vehicles'])
    expect(getInteriorFunctionDomainBinding('medical.treat')?.authoritativeDomains)
      .toEqual(['people'])
  })
})
