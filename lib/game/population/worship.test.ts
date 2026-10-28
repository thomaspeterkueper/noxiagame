import { describe, expect, it } from 'vitest'
import { CONGREGATION_CAP, liturgyFor, phaseAt, pickCongregation, scheduleAt, scheduledWindowsFor, windowStartLabel } from './worship'
import { stJohannesActivityWindows } from './realPlaceActivity'

const neighbours = Array.from({ length: 80 }, (_, i) => ({ id: `n${i}`, distanceM: (i * 13) % 1200 }))

describe('congregation', () => {
  it('brings close relations and part of the neighbourhood, capped per occasion', () => {
    const picked = pickCongregation({ kind: 'service', windowStart: 154, relations: [{ id: 'friend', affinity: 0.9 }], neighbours })
    expect(picked.length).toBeGreaterThan(3)
    expect(picked.length).toBeLessThanOrEqual(CONGREGATION_CAP.service)
    expect(picked.every(id => id === 'friend' || neighbours.find(n => n.id === id)!.distanceM <= 900)).toBe(true)
    expect(pickCongregation({ kind: 'open_community', windowStart: 18, relations: [], neighbours }).length).toBeLessThanOrEqual(2)
  })

  it('is the same congregation on every tick of a window, a different one next week', () => {
    const a = pickCongregation({ kind: 'service', windowStart: 154, relations: [], neighbours })
    expect(pickCongregation({ kind: 'service', windowStart: 154, relations: [], neighbours })).toEqual(a)
    expect(pickCongregation({ kind: 'service', windowStart: 154 + 168, relations: [], neighbours })).not.toEqual(a)
  })

  it('never brings the host or weak relations', () => {
    const picked = pickCongregation({ kind: 'service', windowStart: 154, relations: [{ id: 'host', affinity: 1 }, { id: 'weak', affinity: 0.2 }], neighbours: [], exclude: new Set(['host']) })
    expect(picked).toEqual([])
  })
})

describe('schedule', () => {
  it('knows the running and the next service', () => {
    expect(scheduleAt(stJohannesActivityWindows, 154).running?.kind).toBe('service')
    const next = scheduleAt(stJohannesActivityWindows, 100).next
    expect(next?.kind).toBe('open_community')
    expect(windowStartLabel(154)).toBe('So 10 Uhr')
    expect(windowStartLabel(2597)).toBe('Do 5 Uhr')
  })

  it('adds special services from scheduled events', () => {
    const extra = scheduledWindowsFor([{ payload: { personKey: 'p', kind: 'service', label: 'Probe-Gottesdienst', startsTick: 2600, endsTick: 2602 } }, { payload: { personKey: 'other', kind: 'service', startsTick: 1, endsTick: 2 } }, { payload: { personKey: 'p', kind: 'nonsense', startsTick: 1, endsTick: 2 } }], 'p')
    expect(extra).toEqual([{ kind: 'service', label: 'Probe-Gottesdienst', startTick: 2600, endTick: 2602 }])
    expect(scheduleAt(stJohannesActivityWindows, 2600, extra).running?.label).toBe('Probe-Gottesdienst')
    expect(scheduleAt(stJohannesActivityWindows, 2599, extra).next?.label).toBe('Probe-Gottesdienst')
  })
})

describe('liturgy', () => {
  it('follows the tradition and has a sermon', () => {
    const mass = liturgyFor('service', 'catholic')
    expect(mass.some(phase => phase.title === 'Eucharistiefeier')).toBe(true)
    expect(liturgyFor('service', 'protestant').some(phase => phase.title === 'Kirchcafé')).toBe(true)
    expect(phaseAt(mass, 25)?.speak).toBe(true)
    expect(phaseAt(mass, 500)?.title).toBe('Begegnung danach')
    expect(liturgyFor('shabbat', 'jewish', 'Gottesdienst zum Schabbatbeginn')[0].title).toBe('Kabbalat Schabbat')
    expect(liturgyFor('shabbat', 'jewish', 'Schabbat-Gottesdienst')[1].title).toBe('Toralesung')
  })

  it('every phase list is contiguous from minute 0', () => {
    for (const kind of ['service', 'open_community', 'friday_prayer', 'shabbat', 'aarti', 'dharma_service', 'resonance_round'] as const) {
      const phases = liturgyFor(kind, 'catholic')
      expect(phases[0].from).toBe(0)
      for (let i = 1; i < phases.length; i++) expect(phases[i].from).toBe(phases[i - 1].to)
    }
  })
})
