import { describe, expect, it } from 'vitest'
import { availablePilots, hiredPilotFee, pilotByIndex } from './pilots'

describe('pilots', () => {
  it('bietet drei Piloten, stabil je Schiff, Ort und Tag', () => {
    const a = availablePilots('ship-1', 'earth', '2026-11-06')
    expect(a).toHaveLength(3)
    expect(availablePilots('ship-1', 'earth', '2026-11-06')).toEqual(a)
    expect(availablePilots('ship-1', 'earth', '2026-11-07')).not.toEqual(a)
    expect(a.map(p => p.level)).toEqual([1, 2, 3])
  })
  it('Veteranen kosten mehr als Neulinge', () => {
    const [n, , v] = availablePilots('s', 'moon', '2026-11-06')
    expect(hiredPilotFee({ energy: 10 }, v)).toBeGreaterThan(hiredPilotFee({ energy: 10 }, n))
    expect(hiredPilotFee({ energy: 10 }, { feeFactor: 1 })).toBe(100)
    expect(hiredPilotFee({ energy: 0 }, { feeFactor: 1 })).toBe(1)
  })
  it('liefert null für ungültige Auswahl', () => {
    expect(pilotByIndex('s', 'moon', 'd', 5)).toBeNull()
    expect(pilotByIndex('s', 'moon', 'd', 1)?.level).toBe(2)
  })
})
