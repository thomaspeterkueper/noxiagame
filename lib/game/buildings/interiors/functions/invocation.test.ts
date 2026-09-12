import { describe, expect, it } from 'vitest'
import { createInteriorInstance } from '../instances'
import { LABORATORY_STANDARD_INTERIOR } from '../templates/laboratoryStandard'
import { validateInteriorFunctionInvocation } from './invocation'

describe('interior function invocation contract', () => {
  const instance = createInteriorInstance(LABORATORY_STANDARD_INTERIOR, {
    id: 'INT:LAB:FUNCTIONS:001',
    buildingInstanceId: 'BLD:LAB:FUNCTIONS:001',
  })

  it('accepts a room function when the required authoritative object refs are supplied', () => {
    expect(validateInteriorFunctionInvocation(
      LABORATORY_STANDARD_INTERIOR,
      instance,
      {
        interiorInstanceId: instance.id,
        roomId: 'analysis-lab',
        functionId: 'sample.raman-ir-analysis',
        objectRefs: [
          { kind: 'sample', id: 'SAMPLE:001' },
          { kind: 'instrument', id: 'INSTRUMENT:RAMAN:001' },
        ],
      },
    )).toEqual([])
  })

  it('rejects an analysis request with no instrument reference', () => {
    expect(validateInteriorFunctionInvocation(
      LABORATORY_STANDARD_INTERIOR,
      instance,
      {
        interiorInstanceId: instance.id,
        roomId: 'analysis-lab',
        functionId: 'sample.raman-ir-analysis',
        objectRefs: [{ kind: 'sample', id: 'SAMPLE:001' }],
      },
    )).toContainEqual(expect.objectContaining({ code: 'missing-required-domain-object' }))
  })

  it('rejects a valid function when invoked from the wrong room', () => {
    expect(validateInteriorFunctionInvocation(
      LABORATORY_STANDARD_INTERIOR,
      instance,
      {
        interiorInstanceId: instance.id,
        roomId: 'storage',
        functionId: 'sample.raman-ir-analysis',
        objectRefs: [
          { kind: 'sample', id: 'SAMPLE:001' },
          { kind: 'instrument', id: 'INSTRUMENT:RAMAN:001' },
        ],
      },
    )).toContainEqual(expect.objectContaining({ code: 'function-not-available-in-room' }))
  })

  it('allows data reanalysis without a physical instrument because raw data is authoritative input', () => {
    expect(validateInteriorFunctionInvocation(
      LABORATORY_STANDARD_INTERIOR,
      instance,
      {
        interiorInstanceId: instance.id,
        roomId: 'data-room',
        functionId: 'data.reanalyse',
        objectRefs: [{ kind: 'raw-data', id: 'RAW:SCAN:001' }],
      },
    )).toEqual([])
  })
})
