import { describe, expect, it } from 'vitest'
import { hasPilotTraining, pilotFee, PILOT_RULE_EFFECTIVE_TICK } from './pilotQualification'

describe('pilotQualification', () => {
  it('verlangt beide Module, unabhängig vom ID-Präfix', () => {
    expect(hasPilotTraining(['LRN:SSF:PHY-1101'])).toBe(false)
    expect(hasPilotTraining(['LRN:SSF:PHY-1101', 'LRN:SSF:AST-2101'])).toBe(true)
    expect(hasPilotTraining(['PHY-1101', 'AST-2101', 'LRN:SSF:ECO-L0-0001'])).toBe(true)
  })
  it('berechnet das Honorar nur ohne Ausbildung', () => {
    expect(pilotFee({ energy: 8 }, false, PILOT_RULE_EFFECTIVE_TICK)).toBe(80)
    expect(pilotFee({ energy: 8 }, true, PILOT_RULE_EFFECTIVE_TICK)).toBe(0)
  })
  it('erhebt während der Übergangsfrist kein Honorar', () => {
    expect(pilotFee({ energy: 8 }, false, PILOT_RULE_EFFECTIVE_TICK - 1)).toBe(0)
  })
})
