// lib/worldlab/streetLabels.ts
// Wo ein Straßenname steht: einmal je Straße und Kachel, mittig auf dem
// längsten geraden Stück, in Laufrichtung und immer lesbar (nie kopfüber).
// Reine Rechnung, damit sie ohne Grafik prüfbar ist.

export interface StreetLabel { name: string; x: number; y: number; angle: number; lengthM: number }

type P = { x: number; y: number }

/**
 * Beschriftungen für die Straßen einer Kachel. `roads` in Bodenmetern (x Ost,
 * y Süd); `project` bildet einen Bodenpunkt in die Bildebene ab (für die
 * Leserichtung). Straßen mit weniger als `minM` Meter am Stück bleiben ohne Namen.
 */
export function streetLabels(roads: ReadonlyArray<{ n?: string; p: readonly number[] }>, project: (x: number, y: number) => P, minM = 45): StreetLabel[] {
  const best = new Map<string, StreetLabel>()
  for (const road of roads) {
    if (!road.n) continue
    for (let i = 0; i + 3 < road.p.length; i += 2) {
      const a = { x: road.p[i], y: road.p[i + 1] }, b = { x: road.p[i + 2], y: road.p[i + 3] }
      const lengthM = Math.hypot(b.x - a.x, b.y - a.y)
      if (lengthM < minM) continue
      const known = best.get(road.n)
      if (known && known.lengthM >= lengthM) continue
      const sa = project(a.x, a.y), sb = project(b.x, b.y)
      let angle = Math.atan2(sb.y - sa.y, sb.x - sa.x)
      // Lesbar halten: Text läuft nie von rechts nach links.
      if (angle > Math.PI / 2) angle -= Math.PI
      if (angle < -Math.PI / 2) angle += Math.PI
      best.set(road.n, { name: road.n, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, angle, lengthM })
    }
  }
  return [...best.values()]
}
