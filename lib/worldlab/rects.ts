// lib/worldlab/rects.ts
// Überschneiden sich zwei gedrehte Rechtecke? (Trennachsen-Test)
// Rechteck: Mitte x/y, halbe Breite hw, halbe Tiefe hd, Drehung a (Bogenmaß).

export interface Rect { x: number; y: number; hw: number; hd: number; a: number }

function corners(r: Rect) {
  const c = Math.cos(r.a), s = Math.sin(r.a)
  return [[-r.hw, -r.hd], [r.hw, -r.hd], [r.hw, r.hd], [-r.hw, r.hd]].map(([lx, ly]) => ({ x: r.x + lx * c - ly * s, y: r.y + lx * s + ly * c }))
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  if (Math.hypot(a.x - b.x, a.y - b.y) > Math.hypot(a.hw, a.hd) + Math.hypot(b.hw, b.hd)) return false
  const ca = corners(a), cb = corners(b)
  for (const r of [a, b]) {
    for (const axis of [{ x: Math.cos(r.a), y: Math.sin(r.a) }, { x: -Math.sin(r.a), y: Math.cos(r.a) }]) {
      const pa = ca.map(p => p.x * axis.x + p.y * axis.y), pb = cb.map(p => p.x * axis.x + p.y * axis.y)
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false
    }
  }
  return true
}
