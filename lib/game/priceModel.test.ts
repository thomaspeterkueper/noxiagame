import { describe, expect, it } from 'vitest'
import { nextMarketPrice, sellPriceFor, stepToward, targetBuyPrice } from './priceModel'

describe('targetBuyPrice', () => {
  it('folgt der Reichweite, nicht der absoluten Menge', () => {
    // 200 t reichen einer kleinen Kolonie lange, einer großen kurz.
    const small = targetBuyPrice({ resource: 'water', stock: 200, consumption: 1 })!
    const large = targetBuyPrice({ resource: 'water', stock: 200, consumption: 20 })!
    expect(large).toBeGreaterThan(small)
    expect(targetBuyPrice({ resource: 'water', stock: 48 * 5, consumption: 5 })).toBe(120)
  })
  it('bleibt in den Grenzen und kennt den Fall ohne Marktsignal', () => {
    expect(targetBuyPrice({ resource: 'energy', stock: 48466, consumption: 3 })).toBe(15)
    expect(targetBuyPrice({ resource: 'water', stock: 0, consumption: 5 })).toBe(200)
    expect(targetBuyPrice({ resource: 'water', stock: 999930, consumption: 0 })).toBeNull()
    expect(targetBuyPrice({ resource: 'components', stock: 0, consumption: 0 })).toBeNull()
  })
})

describe('stepToward', () => {
  it('bewegt sich immer und überspringt das Ziel nicht (keine Rundungsfalle)', () => {
    expect(stepToward(12, 15)).toBe(13)
    expect(stepToward(14, 15)).toBe(15)
    expect(stepToward(113, 59)).toBe(108)
    expect(stepToward(59, 59)).toBe(59)
  })
  it('erreicht das Ziel in endlich vielen Ticks', () => {
    let price = 12
    let ticks = 0
    while (price !== 78 && ticks < 200) { price = stepToward(price, 78); ticks++ }
    expect(price).toBe(78)
    expect(ticks).toBeLessThan(40)
  })
})

describe('nextMarketPrice', () => {
  it('hält den Ankaufspreis unter dem Verkaufspreis', () => {
    const p = nextMarketPrice({ resource: 'water', buyPrice: 12, sellPrice: 7, stock: 575, consumption: 5 })
    expect(p.buy).toBeGreaterThan(12)
    expect(p.sell).toBeLessThan(p.buy)
    expect(sellPriceFor(10)).toBe(5)
  })
  it('lässt Orte ohne Verbrauch unberührt', () => {
    expect(nextMarketPrice({ resource: 'water', buyPrice: 130, sellPrice: 100, stock: 316, consumption: 0 })).toEqual({ buy: 130, sell: 100, target: null })
  })
})
