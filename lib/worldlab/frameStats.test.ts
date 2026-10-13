import { describe, expect, it } from 'vitest'
import { FrameStats } from './frameStats'

describe('FrameStats', () => {
  it('fasst Bildrate, Ausreißer und Ruckler zusammen', () => {
    const stats = new FrameStats(4)
    stats.push({ intervalMs: 16, logicMs: 1, renderMs: 2 })
    stats.push({ intervalMs: 16, logicMs: 1, renderMs: 2 })
    stats.push({ intervalMs: 16, logicMs: 1, renderMs: 2 })
    stats.push({ intervalMs: 52, logicMs: 3, renderMs: 30 })
    const s = stats.summary()
    expect(s.fps).toBeCloseTo(1000 * 4 / 100, 6)
    expect(s.worstMs).toBe(52)
    expect(s.stutters).toBe(1)
    expect(s.renderMaxMs).toBe(30)
    expect(s.logicMs).toBeCloseTo(1.5, 6)
  })

  it('vergisst Bilder außerhalb des Fensters', () => {
    const stats = new FrameStats(2)
    stats.push({ intervalMs: 100, logicMs: 0, renderMs: 0 })
    stats.push({ intervalMs: 16, logicMs: 0, renderMs: 0 })
    stats.push({ intervalMs: 16, logicMs: 0, renderMs: 0 })
    expect(stats.summary().worstMs).toBe(16)
  })
})
