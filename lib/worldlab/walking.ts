// lib/worldlab/walking.ts
// Gehen auf der Weltkarte: Häuser sind Hindernisse, weite Wege folgen den Straßen.
// Reine Rechnung in Bodenmetern (x Ost, y Süd), ohne Grafik.

export type P = { x: number; y: number }

/** Grundriss als Vieleck (Ecken in Bodenmetern). */
export type Footprint = P[]

/**
 * Häuser werden minimal kleiner gezeichnet als in den Kartendaten (Thomas,
 * 28.10.2026: „immer noch Bewegungsschwierigkeiten – vielleicht die Bauwerke
 * minimal kleiner darstellen“). Hindernis ist genau das gezeichnete Haus, ohne
 * zusätzlichen Rand: Zwischen zwei 10-m-Häusern wird der Durchgang so 1 m breiter.
 * Kauf, Bauprüfung und Flächen rechnen weiter mit dem echten Grundriss.
 */
export const HOUSE_DRAW_SCALE = 0.9

/** Vieleck um einen Mittelpunkt verkleinern. */
export function scaleRing(ring: readonly P[], centre: P, scale: number): P[] {
  return ring.map(p => ({ x: centre.x + (p.x - centre.x) * scale, y: centre.y + (p.y - centre.y) * scale }))
}

/** Liegt `p` im Vieleck? (Strahlverfahren) */
export function insidePolygon(p: P, ring: readonly P[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Rechteck eines Blocks (Mitte, halbe Breite/Tiefe, Drehung) als Vieleck, um `pad` Meter vergrößert. */
export function boxFootprint(cx: number, cy: number, hw: number, hd: number, angle: number, pad = 0): Footprint {
  const cos = Math.cos(angle), sin = Math.sin(angle)
  const w = hw + pad, d = hd + pad
  return [[-w, -d], [w, -d], [w, d], [-w, d]].map(([lx, ly]) => ({ x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos }))
}

/** Schräg gestellte Ausweichrichtungen (Grad), kleine Abweichung zuerst. */
const SLIDE_ANGLES = [20, -20, 40, -40, 60, -60, 80, -80]

/**
 * Ein Schritt von `from` nach `to` unter Hindernissen: Ist das Ziel frei, wird
 * es erreicht; sonst wird entlang einer Achse geglitten; sonst in einer leicht
 * gedrehten Richtung (Häuser stehen schräg, in der Schrägansicht läuft man
 * diagonal – vorher blieb man an jeder schrägen Wand stehen); sonst bleibt man stehen.
 * Wer schon in einem Haus steht (Start, Sprung), darf hinaus.
 */
export function stepWithObstacles(from: P, to: P, blocked: (p: P) => boolean): P {
  if (!blocked(to) || blocked(from)) return to
  const dx = to.x - from.x, dy = to.y - from.y
  // Achsen nur, wenn sie überhaupt bewegen (sonst „gleitet“ man auf der Stelle)
  const alongX = { x: to.x, y: from.y }
  if (Math.abs(dx) > 1e-6 && !blocked(alongX)) return alongX
  const alongY = { x: from.x, y: to.y }
  if (Math.abs(dy) > 1e-6 && !blocked(alongY)) return alongY
  for (const degrees of SLIDE_ANGLES) {
    const a = degrees * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a)
    // etwas kürzer, je stärker die Abweichung (an der Wand entlang statt hinein)
    const k = Math.cos(a)
    const next = { x: from.x + (dx * cos - dy * sin) * k, y: from.y + (dx * sin + dy * cos) * k }
    if (!blocked(next)) return next
  }
  return from
}

/** Wegenetz aus Straßenlinien: Knoten sind Linienpunkte, auf 1 m zusammengefasst. */
export class RoadGraph {
  private readonly nodes: P[] = []
  private readonly index = new Map<string, number>()
  private readonly edges: Array<Array<{ to: number; cost: number }>> = []

  private node(p: P) {
    const key = Math.round(p.x) + ',' + Math.round(p.y)
    let id = this.index.get(key)
    if (id === undefined) { id = this.nodes.length; this.nodes.push(p); this.edges.push([]); this.index.set(key, id) }
    return id
  }

  addLine(points: readonly P[]) {
    for (let i = 1; i < points.length; i++) {
      // Lange Stücke unterteilen, damit man auch mitten auf einer Straße ein- und aussteigt.
      const a = points[i - 1], b = points[i]
      const length = Math.hypot(b.x - a.x, b.y - a.y)
      const parts = Math.max(1, Math.ceil(length / 25))
      let previous = this.node(a)
      for (let k = 1; k <= parts; k++) {
        const p = { x: a.x + (b.x - a.x) * k / parts, y: a.y + (b.y - a.y) * k / parts }
        const next = this.node(p)
        if (next !== previous) {
          const cost = Math.hypot(this.nodes[next].x - this.nodes[previous].x, this.nodes[next].y - this.nodes[previous].y)
          this.edges[previous].push({ to: next, cost }); this.edges[next].push({ to: previous, cost })
        }
        previous = next
      }
    }
  }

  get size() { return this.nodes.length }

  nearest(p: P): number {
    let best = -1, bestD = Infinity
    for (let i = 0; i < this.nodes.length; i++) {
      const d = Math.hypot(this.nodes[i].x - p.x, this.nodes[i].y - p.y)
      if (d < bestD) { bestD = d; best = i }
    }
    return best
  }

  /** Kürzester Weg (A*) von `from` nach `to` über das Netz; Anfang und Ende gerade dazu. */
  route(from: P, to: P): P[] | null {
    if (!this.nodes.length) return null
    const start = this.nearest(from), goal = this.nearest(to)
    const h = (i: number) => Math.hypot(this.nodes[i].x - this.nodes[goal].x, this.nodes[i].y - this.nodes[goal].y)
    const cost = new Map<number, number>([[start, 0]]), came = new Map<number, number>()
    const open: Array<{ id: number; f: number }> = [{ id: start, f: h(start) }]
    const done = new Set<number>()
    while (open.length) {
      let best = 0
      for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i
      const { id } = open.splice(best, 1)[0]
      if (id === goal) {
        const path: P[] = [to]
        for (let at: number | undefined = goal; at !== undefined; at = came.get(at)) path.push(this.nodes[at])
        path.push(from)
        return path.reverse()
      }
      if (done.has(id)) continue
      done.add(id)
      for (const edge of this.edges[id]) {
        const next = (cost.get(id) ?? 0) + edge.cost
        if (next < (cost.get(edge.to) ?? Infinity)) { cost.set(edge.to, next); came.set(edge.to, id); open.push({ id: edge.to, f: next + h(edge.to) }) }
      }
    }
    return null
  }
}
