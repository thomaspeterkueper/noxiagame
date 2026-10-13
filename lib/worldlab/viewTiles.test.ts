import { describe, expect, it } from 'vitest'
import { growView, minZoomForTiles, tilesForView } from './viewTiles'

const options = { anchorTile: { x: 100, y: 200 }, tileSizeM: 190, isoY: 0.5 }
const iso = (x: number, y: number) => ({ u: x - y, v: (x + y) * 0.5 })

/** Ausschnitt um einen Bodenpunkt, so groß wie ein Bildschirm bei diesem Zoom. */
function viewAt(x: number, y: number, width: number, height: number, zoom: number) {
  const c = iso(x, y)
  return { left: c.u - width / 2 / zoom, right: c.u + width / 2 / zoom, top: c.v - height / 2 / zoom, bottom: c.v + height / 2 / zoom }
}

describe('tilesForView', () => {
  it('beginnt mit der Kachel unter der Bildmitte', () => {
    const tiles = tilesForView(viewAt(95, 95, 1280, 800, 2.6), options)
    expect(tiles[0]).toEqual({ x: 100, y: 200 })
  })

  it('enthält jede Kachel, deren Mitte sichtbar ist, und keine weit draußen', () => {
    const view = viewAt(300, -50, 1280, 800, 1)
    const keys = new Set(tilesForView(view, options).map(t => `${t.x}/${t.y}`))
    for (let ty = -8; ty <= 8; ty++) {
      for (let tx = -8; tx <= 8; tx++) {
        const c = iso((tx + 0.5) * 190, (ty + 0.5) * 190)
        const inside = c.u >= view.left && c.u <= view.right && c.v >= view.top && c.v <= view.bottom
        if (inside) expect(keys.has(`${100 + tx}/${200 + ty}`)).toBe(true)
        // Weiter als eine Kachelbreite vom Ausschnitt entfernt: nie geladen.
        const far = c.u < view.left - 400 || c.u > view.right + 400 || c.v < view.top - 200 || c.v > view.bottom + 200
        if (far) expect(keys.has(`${100 + tx}/${200 + ty}`)).toBe(false)
      }
    }
  })

  it('wächst mit dem Herauszoomen etwa wie die sichtbare Bodenfläche', () => {
    const near = tilesForView(viewAt(95, 95, 1280, 800, 2.6), options).length
    const far = tilesForView(viewAt(95, 95, 1280, 800, 0.8), options).length
    expect(near).toBeLessThanOrEqual(12)
    // 1280·800/0,8² m² ≈ 55 Kachelflächen, dazu der angeschnittene Rand.
    expect(far).toBeGreaterThan(55)
    expect(far).toBeLessThan(110)
  })

  it('erweitert den Ausschnitt nach unten für hohe Gebäude', () => {
    const view = viewAt(95, 95, 1280, 800, 2.6)
    expect(tilesForView(growView(view, 0, 300), options).length).toBeGreaterThan(tilesForView(view, options).length)
  })
})

describe('minZoomForTiles', () => {
  it('begrenzt die Fläche auf die gewünschte Zahl Kacheln', () => {
    const zoom = minZoomForTiles(1280, 800, 190, 48)
    expect(1280 * 800 / zoom ** 2 / 190 ** 2).toBeCloseTo(48, 6)
  })
})
