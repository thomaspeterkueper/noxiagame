import { describe, expect, it } from 'vitest'
import { hasPilotTraining, pilotFee } from './pilotQualification'

describe('pilotQualification', () => {
  it('verlangt beide Module, unabhängig vom ID-Präfix', () => {
    expect(hasPilotTraining(['LRN:SSF:PHY-1101'])).toBe(false)
    expect(hasPilotTraining(['LRN:SSF:PHY-1101', 'LRN:SSF:AST-2101'])).toBe(true)
    expect(hasPilotTraining(['PHY-1101', 'AST-2101', 'LRN:SSF:ECO-L0-0001'])).toBe(true)
  })
  it('berechnet das Honorar nur ohne Ausbildung', () => {
    expect(pilotFee({ energy: 8 }, false)).toBe(80)
    expect(pilotFee({ energy: 8 }, true)).toBe(0)
  })
})
