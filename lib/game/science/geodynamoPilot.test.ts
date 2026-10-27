import { describe, expect, it } from 'vitest'
import { projectGeodynamoPilot, type GeodynamoPilotInput } from './geodynamoPilot'
const example: GeodynamoPilotInput = {
  bodyId: 'earth',
  geologicalTimeMyr: 260,
  referenceTimeMyr: 263,
  referenceDipoleMomentAm2: 8e22,
  baselineHeatFluxWm2: 0.08,
  heatFluxAnomalyWm2: 0,
  heatFluxSensitivity: 0.2,
  reversalAgesMyr: [262, 261, 260.5],
}
describe('geodynamo research pilot', () => {
  it('counts polarity flips without conflating them with strength', () => {
    const r = projectGeodynamoPilot(example)
    expect(r.dipolePolarity).toBe(-1)
    expect(r.illustrativeDipoleMomentAm2).toBe(8e22)
    expect(r.extinctionPrediction).toBeNull()
  })
  it('does not modify input or persist anything', () => {
    const before = JSON.stringify(example)
    expect(projectGeodynamoPilot(example)).toEqual(projectGeodynamoPilot(example))
    expect(JSON.stringify(example)).toEqual(before)
  })
  it('bounds the illustrative heat-flux response', () => {
    const r = projectGeodynamoPilot({...example, heatFluxAnomalyWm2: 5 })
    expect(r.illustrativeDipoleMomentAm2).toBe(16e22)
  })
  it('rejects impossible and ambiguous inputs', () => {
    expect(() => projectGeodynamoPilot({...example, reversalAgesMyr: [261,261]})).toThrow()
    expect(() => projectGeodynamoPilot({...example, baselineHeatFluxWm2: 0})).toThrow()
    expect(() => projectGeodynamoPilot({...example, referenceDipoleMomentAm2: -1})).toThrow()
  })
})
