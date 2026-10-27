// lib/worldlab/facility.ts
// Anlagen aus NOXIA-Gebäuden ohne echtes Haus (Raumhafen, Fabrik, Lager …):
// Gebäude, die nah beieinander stehen, bilden eine Anlage mit befestigtem
// Vorfeld und Zaun (Thomas, 27.10.2026: „sieht furchtbar aus“ – die Bauten
// standen einzeln auf der Wiese). Reine Geometrie in Bodenmetern (x Ost, y Süd).

export interface Pt { x: number; y: number }
export interface Footprint { x: number; y: number; w: number; d: number; /** Grad */ rotation: number }

/** Ecken eines gedrehten Rechtecks, um `margin` Meter vergrößert. */
export function footprintCorners(f: Footprint, margin = 0): Pt[] {
  const a = f.rotation * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a)
  const hw = f.w / 2 + margin, hd = f.d / 2 + margin
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, ly]) => ({ x: f.x + lx * cos - ly * sin, y: f.y + lx * sin + ly * cos }))
}

/** Konvexe Hülle (Andrew), gegen den Uhrzeigersinn in einem y-nach-unten-System egal – Hauptsache geschlossen und ohne Doppelpunkte. */
export function convexHull(points: readonly Pt[]): Pt[] {
  const pts = [...points].sort((p, q) => p.x - q.x || p.y - q.y)
  if (pts.length <= 2) return pts
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Pt[] = [], upper: Pt[] = []
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p) }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p) }
  upper.pop(); lower.pop()
  return lower.concat(upper)
}

/** Kleinster Abstand zweier Grundrisse, grob über die umschreibenden Kreise (reicht für die Gruppierung). */
function gapBetween(a: Footprint, b: Footprint) {
  const ra = Math.hypot(a.w, a.d) / 2, rb = Math.hypot(b.w, b.d) / 2
  // Kreise überschätzen lange Bauten; mittlere Halbachse ist die bessere Näherung.
  const ia = (a.w + a.d) / 4, ib = (b.w + b.d) / 4
  return Math.hypot(a.x - b.x, a.y - b.y) - (ra + ia) / 2 - (rb + ib) / 2
}

/** Gruppen von Gebäuden, die höchstens `gapM` auseinander stehen (Indizes in die Eingabe). */
export function facilityClusters(items: readonly Footprint[], gapM = 45): number[][] {
  const parent = items.map((_, i) => i)
  const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]))
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (gapBetween(items[i], items[j]) <= gapM) parent[find(i)] = find(j)
  }
  const groups = new Map<number, number[]>()
  items.forEach((_, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), i]) })
  return [...groups.values()]
}

/** Umriss des Vorfelds einer Gruppe: Hülle aller um `marginM` vergrößerten Grundrisse. */
export function apronOutline(items: readonly Footprint[], marginM = 8): Pt[] {
  return convexHull(items.flatMap(item => footprintCorners(item, marginM)))
}

/** Punkte entlang eines geschlossenen Umrisses im Abstand `stepM` (für Zaunpfosten, Lampen). */
export function pointsAlong(ring: readonly Pt[], stepM: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    for (let t = 0; t < length; t += stepM) out.push({ x: a.x + (b.x - a.x) * t / length, y: a.y + (b.y - a.y) * t / length })
  }
  return out
}

/** Gebäudearten, die die Karte selbst zeichnet statt ein Bild zu vergrößern. */
export function nativeStandKind(typeId: string): 'pad' | 'solar' | null {
  if (typeId.startsWith('spaceport_pad')) return 'pad'
  if (typeId === 'solar' || typeId.startsWith('solar_')) return 'solar'
  return null
}

/** Achteck eines Landeplatzes: Rechteck mit abgeschrägten Ecken (Anteil `chamfer` der kürzeren Seite). */
export function padOutline(f: Footprint, chamfer = 0.18): Pt[] {
  const a = f.rotation * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a)
  const hw = f.w / 2, hd = f.d / 2, c = Math.min(hw, hd) * 2 * chamfer
  const local: Array<[number, number]> = [[-hw + c, -hd], [hw - c, -hd], [hw, -hd + c], [hw, hd - c], [hw - c, hd], [-hw + c, hd], [-hw, hd - c], [-hw, -hd + c]]
  return local.map(([lx, ly]) => ({ x: f.x + lx * cos - ly * sin, y: f.y + lx * sin + ly * cos }))
}
