import { describe, expect, it } from 'vitest'
import { boxFootprint, distanceToRing, insidePolygon, RoadGraph, scaleRing, stepWithObstacles } from './walking'

describe('obstacles', () => {
  const house = boxFootprint(10, 10, 5, 4, 0, 0.5)
  const blocked = (p: { x: number; y: number }) => insidePolygon(p, house)
  it('knows what is inside a house', () => {
    expect(blocked({ x: 10, y: 10 })).toBe(true)
    expect(blocked({ x: 20, y: 10 })).toBe(false)
  })
  it('slides along a wall instead of walking through it', () => {
    // schräg auf die Westwand zu: rutscht in y weiter
    const next = stepWithObstacles({ x: 4, y: 3 }, { x: 5, y: 4 }, blocked)
    expect(blocked(next)).toBe(false)
    expect(next.y).toBe(4)
  })
  it('rutscht an einer schrägen Wand entlang statt stehen zu bleiben', () => {
    // Haus um 45° gedreht; die Figur läuft schräg auf die Wand zu, beide Achsen sind zu
    // lange Wand, um 20° gedreht; die Figur läuft genau nach Osten darauf zu
    const tilted = boxFootprint(10, 0, 1, 30, 20 * Math.PI / 180, 0)
    const inTilted = (p: { x: number; y: number }) => insidePolygon(p, tilted)
    const from = { x: 8.6, y: 0 }
    expect(inTilted(from)).toBe(false)
    expect(inTilted({ x: 9.2, y: 0 })).toBe(true)
    const next = stepWithObstacles(from, { x: 9.2, y: 0 }, inTilted)
    expect(inTilted(next)).toBe(false)
    expect(next).not.toEqual(from)
  })
  it('verkleinert Häuser um die Mitte', () => {
    const ring = scaleRing([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], { x: 5, y: 5 }, 0.9)
    expect(ring[0]).toEqual({ x: 0.5, y: 0.5 })
    expect(ring[2]).toEqual({ x: 9.5, y: 9.5 })
  })
  it('lets you leave a house you stand in', () => {
    expect(stepWithObstacles({ x: 10, y: 10 }, { x: 11, y: 10 }, blocked)).toEqual({ x: 11, y: 10 })
  })
})

describe('RoadGraph', () => {
  it('routes along streets that meet at a corner', () => {
    const graph = new RoadGraph()
    graph.addLine([{ x: 0, y: 0 }, { x: 100, y: 0 }])
    graph.addLine([{ x: 100, y: 0 }, { x: 100, y: 100 }])
    const path = graph.route({ x: 0, y: 2 }, { x: 102, y: 100 })!
    expect(path[0]).toEqual({ x: 0, y: 2 })
    expect(path[path.length - 1]).toEqual({ x: 102, y: 100 })
    // geht über die Ecke, nicht quer
    expect(path.some(p => p.x === 100 && p.y === 0)).toBe(true)
  })
  it('joins lines from different tiles at shared points', () => {
    const graph = new RoadGraph()
    graph.addLine([{ x: 0, y: 0 }, { x: 50, y: 0.2 }])
    graph.addLine([{ x: 50.1, y: 0 }, { x: 100, y: 0 }])
    expect(graph.route({ x: 0, y: 0 }, { x: 100, y: 0 })).not.toBeNull()
  })
})

describe('distanceToRing (Eintritt in Kirchen und Bibliotheken)', () => {
  const church = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }]
  it('misst bis zur Hauswand, nicht bis zur Mitte', () => {
    // Mittelpunkt (20, 10): Wer an der Wand steht, ist 20 m von der Mitte entfernt, aber nur 3 m von der Wand.
    expect(distanceToRing({ x: -3, y: 10 }, church)).toBeCloseTo(3, 5)
    expect(Math.hypot(-3 - 20, 10 - 10)).toBeGreaterThan(14)
  })
  it('rechnet an Ecken mit dem Abstand zur Ecke', () => {
    expect(distanceToRing({ x: 43, y: 24 }, church)).toBeCloseTo(5, 5)
  })
  it('ist 0 im Haus', () => {
    expect(distanceToRing({ x: 10, y: 10 }, church)).toBe(0)
  })
})
