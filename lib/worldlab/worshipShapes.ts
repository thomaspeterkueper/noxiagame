// lib/worldlab/worshipShapes.ts
// Erstellt: 31.10.2026
// Gotteshäuser ohne Gebäudeumriss in den Kartendaten (Sundern: Lukaskirche, Rochuskapelle …):
// Die Daten führen nur einen Punkt. Damit dort ein Haus steht, setzt die Karte ein Gebäude in
// passender Größe an den Punkt – eine Kirche als Langhaus (mit Turm), eine Kapelle klein,
// die Rochuskapelle als achteckiger Zentralbau. Rein, ohne Datenbank.

export interface WorshipMassing {
  /** Länge (lange Seite) und Breite in Metern. */
  w: number
  d: number
  /** Achteckiger Grundriss statt Rechteck. */
  octagon: boolean
  /** Geschosse (Höhe der Traufe). */
  levels: number
}

/** Besondere Bauten nach OSM-Kennung. Rochuskapelle von 1925: achteckiger, längsoblonger Zentralbau (Deutsche Digitale Bibliothek). */
export const WORSHIP_MASSING_BY_SOURCE: Record<string, WorshipMassing> = {
  'osm:way:246890728': { w: 11, d: 9, octagon: true, levels: 2 },
}

/** Größe nach Art des Gotteshauses, wenn nichts Besonderes bekannt ist. */
export function worshipMassing(properties: Record<string, unknown>): WorshipMassing {
  const source = String(properties.noxia_source_id ?? '')
  const known = WORSHIP_MASSING_BY_SOURCE[source]
  if (known) return known
  const tag = String(properties.building ?? properties.visual_class ?? '').toLowerCase()
  const name = String(properties.name ?? '').toLowerCase()
  if (/chapel/.test(tag) || /kapelle/.test(name)) return { w: 9, d: 6, octagon: false, levels: 2 }
  if (/mosque|synagogue|temple/.test(tag) || /moschee|synagoge|tempel/.test(name)) return { w: 16, d: 14, octagon: false, levels: 3 }
  if (/church|cathedral/.test(tag) || /kirche|dom\b|münster/.test(name)) return { w: 24, d: 11, octagon: false, levels: 4 }
  return { w: 14, d: 10, octagon: false, levels: 3 }
}

/** Achteck mit abgeschnittenen Ecken um (cx, cy), gedreht um `angle` (Bogenmaß); x/y abwechselnd. */
export function octagonRing(cx: number, cy: number, w: number, d: number, angle: number): number[] {
  const cut = Math.min(w, d) * 0.29
  const hw = w / 2, hd = d / 2
  const local: Array<[number, number]> = [
    [-hw + cut, -hd], [hw - cut, -hd], [hw, -hd + cut], [hw, hd - cut],
    [hw - cut, hd], [-hw + cut, hd], [-hw, hd - cut], [-hw, -hd + cut],
  ]
  const cos = Math.cos(angle), sin = Math.sin(angle)
  return local.flatMap(([x, y]) => [Math.round((cx + x * cos - y * sin) * 10) / 10, Math.round((cy + x * sin + y * cos) * 10) / 10])
}

/** Richtung (Bogenmaß, −π/2 … π/2) der nächsten Straße bis `maxM` Meter, sonst 0. Straßen: x/y abwechselnd. */
export function nearestRoadAngle(x: number, y: number, roads: ReadonlyArray<{ p: number[] }>, maxM = 60): number {
  let best = { d: maxM, a: 0 }
  for (const road of roads) {
    for (let i = 0; i + 3 < road.p.length; i += 2) {
      const ax = road.p[i], ay = road.p[i + 1], bx = road.p[i + 2], by = road.p[i + 3]
      const dx = bx - ax, dy = by - ay
      const length2 = dx * dx + dy * dy
      if (length2 < 1) continue
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length2))
      const distance = Math.hypot(x - (ax + t * dx), y - (ay + t * dy))
      if (distance < best.d) {
        let angle = Math.atan2(dy, dx)
        while (angle > Math.PI / 2) angle -= Math.PI
        while (angle <= -Math.PI / 2) angle += Math.PI
        best = { d: distance, a: angle }
      }
    }
  }
  return best.a
}
