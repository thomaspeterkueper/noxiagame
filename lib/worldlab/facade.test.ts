import { describe, expect, it } from 'vitest'
import { apply, ART_PX_PER_M, iso, ISO_HEIGHT, leftToRight, roofMatrix, wallMatrix } from './facade'

const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 6)
  expect(a.y).toBeCloseTo(b.y, 6)
}

describe('Ansicht', () => {
  it('ist geometrisch richtig: Blick 30° von oben', () => {
    // Für eine echte Parallelprojektion mit 45° Drehung und 30° Neigung gilt
    // Höhe je Meter = √2 · cos 30° bei Bodenstauchung sin 30° = ½.
    expect(ISO_HEIGHT).toBeCloseTo(Math.SQRT2 * Math.cos(Math.PI / 6), 9)
  })
})

describe('wallMatrix', () => {
  const from = { x: 10, y: 20 }, to = { x: 22, y: 20 }   // 12 m nach Osten
  const m = wallMatrix(from, to, 6)                       // zwei Geschosse à 3 m

  it('legt die linke obere Bildecke auf die Wandoberkante', () => {
    close(apply(m, 0, 0), iso(10, 20, 6))
  })

  it('misst 16 Pixel je Meter entlang der Wand und nach unten', () => {
    close(apply(m, 12 * ART_PX_PER_M, 0), iso(22, 20, 6))
    close(apply(m, 0, 6 * ART_PX_PER_M), iso(10, 20, 0))
    close(apply(m, 12 * ART_PX_PER_M, 3 * ART_PX_PER_M), iso(22, 20, 3))
  })

  it('folgt gedrehten Wänden', () => {
    const r = wallMatrix({ x: 0, y: 0 }, { x: 3, y: 4 }, 3)  // 5 m schräg
    close(apply(r, 5 * ART_PX_PER_M, 3 * ART_PX_PER_M), iso(3, 4, 0))
  })
})

describe('leftToRight', () => {
  it('ordnet die Ecken nach ihrer Lage im Bild', () => {
    const [a, b] = leftToRight({ x: 5, y: 0 }, { x: 0, y: 5 })
    expect(a).toEqual({ x: 0, y: 5 })
    expect(b).toEqual({ x: 5, y: 0 })
  })
})

describe('roofMatrix', () => {
  // Traufe von (0,0) nach (10,0) auf 6 m, Dach steigt nach Süden, 1 : 1.
  const m = roofMatrix({ x: 0, y: 0 }, { x: 10, y: 0 }, 6, { x: 0, y: 1 }, 1)

  it('legt Ziegelreihen parallel zur Traufe', () => {
    close(apply(m, 0, 0), iso(0, 0, 6))
    close(apply(m, 10 * ART_PX_PER_M, 0), iso(10, 0, 6))
  })

  it('geht im Bild nach oben den Hang hinauf, gemessen auf der Dachfläche', () => {
    // √2 m Dachfläche bei 45° = 1 m Lauf und 1 m Steigung
    close(apply(m, 0, -Math.SQRT2 * ART_PX_PER_M), iso(0, 1, 7))
  })
})
