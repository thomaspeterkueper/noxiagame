import { describe, expect, it } from 'vitest'
import { evaluateMarsCloudIfEnabled } from './cloudRuntime'
import type { MarsCloudConditions } from './cloudEvents'

const conditions: MarsCloudConditions = {
  regionId: 'arsia-mons', bucket: 1, localHour: 7,
  saturationRatio: 3, nucleiAvailability: 0.01, lift: 0.8,
  terrainAvailable: true,
}

describe('Mars cloud runtime feature gate', () => {
  it('is disabled by default', () => {
    expect(evaluateMarsCloudIfEnabled(conditions)).toEqual({ status: 'disabled' })
    expect(evaluateMarsCloudIfEnabled(conditions, {})).toEqual({ status: 'disabled' })
  })
  it('requires an explicit opt-in to evaluate', () => {
    expect(evaluateMarsCloudIfEnabled(conditions, { enabled: false }).status).toBe('disabled')
    expect(evaluateMarsCloudIfEnabled(conditions, { enabled: true }).status).toBe('evaluated')
  })
  it('keeps experimental nucleation off unless separately enabled', () => {
    const baseline = evaluateMarsCloudIfEnabled(conditions, { enabled: true })
    const experiment = evaluateMarsCloudIfEnabled(conditions, {
      enabled: true, experimentalHomogeneousNucleation: true,
    })
    if (baseline.status !== 'evaluated' || experiment.status !== 'evaluated') throw new Error('unexpected gate state')
    expect(baseline.evaluation.state).toBe('inactive')
    expect(experiment.evaluation.mechanism).toBe('homogeneous-hypothesis')
  })
})
