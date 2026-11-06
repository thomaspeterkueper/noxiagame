import { describe, expect, it } from 'vitest'
import { gateProduction } from './inputGate'
import { runProcess } from '../food/chain'

const defs = new Map([
  ['hydroponics', { consumption: [{ resource: 'water', amount: 1 }, { resource: 'energy', amount: 1 }] }],
  ['solar', { consumption: [] }],
])

describe('Produktion nur mit Eingängen (Request 0930)', () => {
  it('ein Gebäude ohne Eingang erzeugt nichts und meldet das fehlende Gut', () => {
    const gate = gateProduction([{ id: 'a', entity_id: 'hydroponics' }], defs, { water: 5, energy: 0 })
    expect(gate.running.has('a')).toBe(false)
    expect(gate.limitedBy.get('a')).toBe('energy')
    expect(gate.consumed).toEqual({})
    expect(gate.stockAfter).toEqual({ water: 5, energy: 0 })
  })
  it('Gebäude ohne Eingänge laufen immer', () => {
    expect(gateProduction([{ id: 's', entity_id: 'solar' }], defs, {}).running.has('s')).toBe(true)
  })
  it('bei Knappheit gewinnt die kleinere Kennung, deterministisch', () => {
    const buildings = [{ id: 'b', entity_id: 'hydroponics' }, { id: 'a', entity_id: 'hydroponics' }]
    const gate = gateProduction(buildings, defs, { water: 1, energy: 1 })
    expect([...gate.running]).toEqual(['a'])
    expect(gate.limitedBy.get('b')).toBe('water')
    expect(gate.consumed).toEqual({ water: 1, energy: 1 })
    expect(gate.stockAfter).toEqual({ water: 0, energy: 0 })
  })
  it('kein Bestand wird negativ', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: 'h' + i, entity_id: 'hydroponics' }))
    const gate = gateProduction(many, defs, { water: 3, energy: 7 })
    expect(gate.running.size).toBe(3)
    expect(Math.min(...Object.values(gate.stockAfter))).toBeGreaterThanOrEqual(0)
  })
  it('gleiche Regel wie runProcess der Lebensmittelkette', () => {
    const process = { code: 'x', inputs: [{ good: 'water', amount: 1 }, { good: 'energy', amount: 1 }], outputs: [{ good: 'food', amount: 2 }], durationHours: 1, labor: { skill: 'gardening', personHours: 0 }, environments: [] } as never
    for (const stock of [{ water: 1, energy: 1 }, { water: 0, energy: 3 }, { water: 2, energy: 0 }]) {
      const viaChain = runProcess(stock as never, process, 1)
      const viaGate = gateProduction([{ id: 'a', entity_id: 'hydroponics' }], defs, stock)
      expect(viaGate.running.has('a')).toBe(viaChain.batches === 1)
      if (!viaGate.running.has('a')) expect(viaGate.limitedBy.get('a')).toBe(viaChain.limitedBy)
    }
  })
})
