// lib/worldlab/plantPlacement.ts
// Wo auf der Erdkarte Bäume und Büsche stehen (05.11.2026).
//
// OpenStreetMap kennt in Sundern keine Einzelbäume, nur Waldflächen. Deshalb setzt
// die Karte Pflanzen in Wald, Parks, Wohngebiete (zwischen die Häuser), Friedhöfe,
// Kleingärten und Spielplätze – mit Arten, die zur Gegend passen. Jede Pflanze sagt,
// woher wir sie kennen: Standort aus OSM (Einzelbaum, Allee) oder geschätzt.
// Das Raster hängt an absoluten Kachelmetern, damit Nachbarkacheln nahtlos
// aneinanderpassen und beim Neuladen alles an seinem Platz bleibt.

import { ROAD_STYLES } from './blocks'
import { seeded } from './ambient'
import { plantRegion, type PlantId, type PlantRegion } from './plants'
import type { SimplifiedTile } from './simplify'
import { insidePolygon } from './walking'

type P = { x: number; y: number }

export interface PlantSpot {
  x: number; y: number
  species: PlantId
  /** Größe gegenüber der typischen Höhe der Art (0,5 … 1,15) */
  scale: number
  /** osm: Standort aus OpenStreetMap (Art geschätzt); estimate: Standort und Art geschätzt */
  source: 'osm' | 'estimate'
}

type Mix = ReadonlyArray<readonly [PlantId, number]>

const MIX: Record<'forest' | 'park' | 'garden' | 'cemetery' | 'street' | 'orchard' | 'bush' | 'water', Mix> = {
  // Sauerland: viel Fichte (trotz Käferflächen), Buche, Eiche, Birke auf Freiflächen
  forest: [['fichte', 34], ['buche', 24], ['eiche', 12], ['birke', 10], ['kiefer', 6], ['laerche', 6], ['ahorn', 6], ['erle', 2]],
  park: [['linde', 22], ['ahorn', 20], ['kastanie', 14], ['eiche', 12], ['buche', 10], ['birke', 12], ['kirsche', 6], ['pappel', 4]],
  garden: [['apfel', 22], ['kirsche', 18], ['birke', 14], ['ahorn', 10], ['fichte', 10], ['linde', 6], ['kiefer', 4]],
  cemetery: [['linde', 30], ['eiche', 20], ['ahorn', 20], ['birke', 15], ['buche', 15]],
  street: [['linde', 35], ['ahorn', 30], ['kastanie', 15], ['eiche', 10], ['birke', 10]],
  orchard: [['apfel', 55], ['kirsche', 45]],
  bush: [['hasel', 35], ['holunder', 30], ['liguster', 35]],
  water: [['weide', 55], ['erle', 45]],
}

function pick(mix: Mix, r: number): PlantId {
  const total = mix.reduce((sum, [, w]) => sum + w, 0)
  let acc = 0
  for (const [id, w] of mix) { acc += w / total; if (r < acc) return id }
  return mix[mix.length - 1][0]
}

/** Art für die Gegend: in warmen und unbekannten Breiten nur „Laub-“ oder „Nadelbaum“, nichts Erfundenes. */
function regional(id: PlantId, region: PlantRegion): PlantId {
  if (region === 'central') return id
  if (region === 'warm') return 'laubbaum'
  return id === 'fichte' || id === 'kiefer' || id === 'laerche' ? 'nadelbaum' : 'laubbaum'
}

const FILL: Partial<Record<string, { step: number; keep: number; mix: keyof typeof MIX; cluster?: boolean; bushes?: { step: number; keep: number } }>> = {
  forest: { step: 10, keep: 0.86, mix: 'forest' },
  park: { step: 15, keep: 0.42, mix: 'park', cluster: true, bushes: { step: 9, keep: 0.12 } },
  garden: { step: 15, keep: 0.3, mix: 'garden', cluster: true, bushes: { step: 8, keep: 0.14 } },
  cemetery: { step: 18, keep: 0.45, mix: 'cemetery', cluster: true },
  allotments: { step: 11, keep: 0.42, mix: 'orchard', bushes: { step: 7, keep: 0.22 } },
  playground: { step: 18, keep: 0.35, mix: 'park' },
}
const MAX_PLANTS = 900

function segmentDistance(p: P, a: P, b: P) {
  const dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/**
 * Pflanzen einer Kachel. `origin`: Lage der Kachel in absoluten Metern; `at`: Mitte der Kachel (Grad).
 */
export function plantSpots(data: Pick<SimplifiedTile, 'size' | 'areas' | 'roads' | 'rivers' | 'blocks' | 'trees'> & { rw?: number[] }, origin: P, at: { lat: number; lon: number }): PlantSpot[] {
  const region = plantRegion(at.lat, at.lon)
  const out: PlantSpot[] = []
  const size = data.size
  const rings = (kinds: string[]) => data.areas.filter(a => kinds.includes(a.k)).map(a => { const r: P[] = []; for (let i = 0; i + 1 < a.p.length; i += 2) r.push({ x: a.p[i], y: a.p[i + 1] }); return r })
  const blockedAreas = rings(['water', 'pool', 'parking', 'pitch', 'track', 'hardcourt', 'clay', 'sand', 'plaza'])
  const roads = data.roads.map(road => ({ half: ROAD_STYLES[road.c].widthM / 2 + (road.c === 'path' ? 0.8 : 1.8), p: road.p }))
  const rivers = data.rivers.map((p, i) => ({ half: (data.rw?.[i] ?? 3) / 2 + 1.2, p }))
  const nearLine = (p: P, lines: Array<{ half: number; p: number[] }>, extra = 0) => {
    for (const line of lines) for (let i = 0; i + 3 < line.p.length; i += 2) {
      if (segmentDistance(p, { x: line.p[i], y: line.p[i + 1] }, { x: line.p[i + 2], y: line.p[i + 3] }) < line.half + extra) return true
    }
    return false
  }
  const nearHouse = (p: P) => data.blocks.some(b => Math.abs(b.x - p.x) < Math.max(b.w, b.d) / 2 + 2.2 && Math.abs(b.y - p.y) < Math.max(b.w, b.d) / 2 + 2.2 && Math.hypot(b.x - p.x, b.y - p.y) < Math.max(b.w, b.d) / 2 + 2.2)
  const free = (p: P) => !blockedAreas.some(r => insidePolygon(p, r)) && !nearLine(p, roads) && !nearLine(p, rivers) && !nearHouse(p)
  const waterSide = (p: P) => nearLine(p, rivers, 12)

  // Standorte aus OSM (Einzelbäume, Alleen): Art nach Lage geschätzt
  const trees = data.trees ?? []
  for (let i = 0; i + 1 < trees.length; i += 2) {
    const p = { x: trees[i], y: trees[i + 1] }, key = (origin.x + p.x).toFixed(1) + ',' + (origin.y + p.y).toFixed(1)
    const mix = waterSide(p) ? MIX.water : MIX.street
    out.push({ ...p, species: regional(pick(mix, seeded('osm-tree:' + key)), region), scale: 0.75 + seeded('size:' + key) * 0.35, source: 'osm' })
  }

  for (const area of data.areas) {
    const fill = FILL[area.k]
    if (!fill || out.length >= MAX_PLANTS) continue
    const ring: P[] = []
    for (let i = 0; i + 1 < area.p.length; i += 2) ring.push({ x: area.p[i], y: area.p[i + 1] })
    if (ring.length < 3) continue
    const xs = ring.map(p => p.x), ys = ring.map(p => p.y)
    const minX = Math.max(0, Math.min(...xs)), maxX = Math.min(size, Math.max(...xs)), minY = Math.max(0, Math.min(...ys)), maxY = Math.min(size, Math.max(...ys))
    const layers: Array<{ step: number; keep: number; bush: boolean }> = [{ step: fill.step, keep: fill.keep, bush: false }]
    if (fill.bushes && region === 'central') layers.push({ ...fill.bushes, bush: true })
    for (const layer of layers) {
      const { step } = layer
      for (let gy = Math.floor((origin.y + minY) / step); gy * step - origin.y < maxY; gy++) for (let gx = Math.floor((origin.x + minX) / step); gx * step - origin.x < maxX; gx++) {
        if (out.length >= MAX_PLANTS) break
        const key = `${area.k}:${layer.bush ? 'b' : 't'}:${gx}:${gy}`
        let keep = layer.keep
        // Gruppen statt gleichmäßiger Streuung: grobe Zellen von 45 m sind dichter oder lichter
        if (fill.cluster) keep *= 0.35 + 1.3 * seeded('grove:' + area.k + ':' + Math.floor(gx * step / 45) + ':' + Math.floor(gy * step / 45))
        if (seeded('keep:' + key) > keep) continue
        const p = { x: gx * step - origin.x + (seeded('jx:' + key) - 0.5) * step * 0.7, y: gy * step - origin.y + (seeded('jy:' + key) - 0.5) * step * 0.7 }
        if (p.x < 0 || p.x >= size || p.y < 0 || p.y >= size || !insidePolygon(p, ring) || !free(p)) continue
        let species: PlantId
        if (layer.bush) species = pick(MIX.bush, seeded('sp:' + key))
        else if (waterSide(p) && seeded('w:' + key) < 0.6) species = pick(MIX.water, seeded('sp:' + key))
        else if (area.k === 'forest') {
          // Bestände: In einer Zelle von 50 m herrscht eine Art vor
          const stand = pick(MIX.forest, seeded('stand:' + Math.floor(gx * step / 50) + ':' + Math.floor(gy * step / 50)))
          species = seeded('mix:' + key) < 0.72 ? stand : pick(MIX.forest, seeded('sp:' + key))
        } else species = pick(MIX[fill.mix], seeded('sp:' + key))
        out.push({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, species: regional(species, region), scale: (layer.bush ? 0.7 : 0.6) + seeded('size:' + key) * (layer.bush ? 0.5 : 0.55), source: 'estimate' })
      }
    }
  }
  return out
}
