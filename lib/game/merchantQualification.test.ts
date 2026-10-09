import { describe, expect, it } from 'vitest'
import { isCommercialBasicsModule, merchantStanding, type MerchantTrade } from './merchantQualification'

const t = (resource: string, loc: string, profit: number, n: number): MerchantTrade =>
  ({ resource, from_location: loc, profit, traded_at: `2026-10-09T10:${String(n).padStart(2, '0')}:00Z` })

describe('merchantStanding', () => {
  it('zählt nur Verkäufe an einem anderen Ort als dem Einkaufsort', () => {
    const s = merchantStanding([t('water', 'earth', -440, 1), t('water', 'earth', 200, 2), t('water', 'moon', 900, 3)], [])
    expect(s.purchases).toBe(1)
    expect(s.salesElsewhere).toBe(1)
    expect(s.qualified).toBe(false)
  })
  it('qualifiziert durch Erfahrung oder durch Grundausbildung', () => {
    const trades = [t('water', 'earth', -440, 0), ...[1, 2, 3, 4, 5].map(n => t('water', 'moon', 300, n))]
    expect(merchantStanding(trades, []).qualified).toBe(true)
    expect(merchantStanding([], ['LRN:SSF:ECO-L0-0001']).qualified).toBe(false)
    expect(merchantStanding([], ['LRN:SSF:ECO-L0-0001', 'ECO-L0-000001', 'LRN:SSF:ECO-L0-0002']).commercialBasicsCompleted).toBe(2)
    expect(merchantStanding([], ['LRN:SSF:ECO-L0-0001', 'LRN:SSF:ECO-L0-0002', 'LRN:SSF:ECO-L0-0003']).qualified).toBe(true)
    expect(merchantStanding([], ['LRN:SSF:PHY-1101']).qualified).toBe(false)
  })
  it('erkennt Grundmodule unabhängig vom Präfix', () => {
    expect(isCommercialBasicsModule('ECO-L0-000001')).toBe(true)
    expect(isCommercialBasicsModule('LRN:SSF:ECO-L0-0003')).toBe(true)
    expect(isCommercialBasicsModule('LRN:SSF:ECO-L1-0001')).toBe(false)
  })
})
