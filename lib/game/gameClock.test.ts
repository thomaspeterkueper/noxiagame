import { describe, expect, it } from 'vitest'
import { clockHour, clockOffset, clockTick, clockWeekday, tickOfClock, tickUtcMs } from './gameClock'

describe('game clock = German time', () => {
  it('maps the anchor tick to Wednesday 20:00 in Germany', () => {
    expect(new Date(tickUtcMs(2598)).toISOString()).toBe('2026-10-28T19:00:00.000Z')
    expect(clockHour(2598)).toBe(20)
    expect(clockWeekday(2598)).toBe(2)
  })

  it('is 11:00 in Germany when the old clock said 21:00', () => {
    // 29.10.2026, 10:00 UTC = 11:00 in Deutschland
    const tick = 2598 + 15
    expect(tick % 24).toBe(21)
    expect(clockHour(tick)).toBe(11)
    expect(clockWeekday(tick)).toBe(3)
  })

  it('follows summer time', () => {
    // 1.7.2027, 10:00 UTC = 12:00 Sommerzeit
    const tick = 2598 + Math.round((Date.UTC(2027, 6, 1, 10) - Date.UTC(2026, 9, 28, 19)) / 3_600_000)
    expect(clockOffset(tick)).toBe(-9)
    expect(clockHour(tick)).toBe(12)
    expect(clockOffset(2598)).toBe(-10)
  })

  it('converts back from clock ticks', () => {
    for (const tick of [2598, 2610, 3000, 9000]) expect(tickOfClock(clockTick(tick))).toBe(tick)
  })
})
