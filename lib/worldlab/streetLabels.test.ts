import { describe, expect, it } from 'vitest'
import { streetLabels } from './streetLabels'

const iso = (x: number, y: number) => ({ x: x - y, y: (x + y) / 2 })

describe('streetLabels', () => {
  it('labels each street once, on its longest straight piece', () => {
    const labels = streetLabels([
      { n: 'Bogenstraße', p: [0, 0, 30, 0, 130, 0] },
      { n: 'Bogenstraße', p: [0, 50, 60, 50] },
      { n: 'Lockweg', p: [0, 0, 0, 20] },
      { p: [0, 0, 200, 0] },
    ], iso)
    expect(labels.map(l => l.name)).toEqual(['Bogenstraße'])
    expect(labels[0].x).toBe(80)
    expect(labels[0].lengthM).toBe(100)
  })

  it('never turns text upside down', () => {
    const [east] = streetLabels([{ n: 'A', p: [100, 0, 0, 0] }], iso)   // von Ost nach West gezeichnet
    expect(Math.abs(east.angle)).toBeLessThanOrEqual(Math.PI / 2)
    const [south] = streetLabels([{ n: 'B', p: [0, 100, 0, 0] }], iso)
    expect(Math.abs(south.angle)).toBeLessThanOrEqual(Math.PI / 2)
  })
})
