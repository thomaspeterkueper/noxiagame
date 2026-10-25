import { describe, expect, it } from 'vitest'
import { chainLines, lineLength, pointAlong, startAt, trainState } from './railLine'

const p = (lat: number, lon: number) => ({ lat, lon })

describe('railLine', () => {
  it('chains pieces that touch, in any direction', () => {
    const a = [p(51.33, 8.0), p(51.34, 8.0)]
    const b = [p(51.36, 8.0), p(51.34, 8.0)]       // reversed, touches a's tail
    const far = [p(52, 9), p(52.01, 9)]
    const chains = chainLines([a, far, b])
    expect(chains[0]).toHaveLength(3)
    expect(chains[0][2].lat).toBeCloseTo(51.36)
    expect(chains).toHaveLength(2)
  })
  it('starts at the station', () => {
    const line = [p(51.40, 8.0), p(51.33, 8.0)]
    expect(startAt(line, p(51.331, 8.0))[0].lat).toBeCloseTo(51.33)
  })
  it('runs a timetable: dwell, out, dwell, back', () => {
    const length = 1100 // 100 s Fahrt bei 11 m/s
    expect(trainState(length, 0).atStation).toBe(true)
    expect(trainState(length, 170_000).direction).toBe(1)
    expect(trainState(length, 170_000).distanceM).toBeCloseTo(550)
    expect(trainState(length, 250_000).distanceM).toBe(length)
    const back = trainState(length, 390_000)
    expect(back.direction).toBe(-1)
    expect(back.distanceM).toBeCloseTo(550)
    expect(back.nextArrivalS).toBeCloseTo(50)
  })
  it('finds points along the line', () => {
    const line = [p(51.33, 8.0), p(51.34, 8.0)]
    const half = pointAlong(line, lineLength(line) / 2)
    expect(half.at.lat).toBeCloseTo(51.335)
    expect(half.heading).toBeCloseTo(Math.PI / 2)
  })
})
