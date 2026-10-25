// lib/worldlab/railLine.ts
// Strecke und Fahrplan für den Zug der Weltkarte (Thomas, 25.10.2026: vom alten
// Bahnhof Sundern Richtung Neheim). Die Strecke kommt aus OpenStreetMap in
// mehreren Stücken; hier werden sie zu einer Linie verbunden. Der Fahrplan hängt
// nur an der Uhrzeit – jeder Spieler sieht den Zug an derselben Stelle.

export type GeoPoint = { lat: number; lon: number }

const M_PER_DEG = 111320
export function metresBetween(a: GeoPoint, b: GeoPoint) {
  return Math.hypot((a.lat - b.lat) * M_PER_DEG, (a.lon - b.lon) * M_PER_DEG * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180))
}
export function lineLength(line: readonly GeoPoint[]) {
  let sum = 0
  for (let i = 1; i < line.length; i++) sum += metresBetween(line[i - 1], line[i])
  return sum
}

/** Stücke verbinden, deren Enden nah beieinander liegen (gibt die längste Kette zuerst zurück). */
export function chainLines(pieces: readonly GeoPoint[][], joinM = 20): GeoPoint[][] {
  const rest = pieces.filter(piece => piece.length >= 2).map(piece => [...piece])
  const chains: GeoPoint[][] = []
  while (rest.length) {
    let chain = rest.shift()!
    let grown = true
    while (grown) {
      grown = false
      for (let i = 0; i < rest.length; i++) {
        const piece = rest[i], head = chain[0], tail = chain[chain.length - 1]
        const first = piece[0], last = piece[piece.length - 1]
        if (metresBetween(tail, first) <= joinM) chain = [...chain, ...piece.slice(1)]
        else if (metresBetween(tail, last) <= joinM) chain = [...chain, ...[...piece].reverse().slice(1)]
        else if (metresBetween(head, last) <= joinM) chain = [...piece.slice(0, -1), ...chain]
        else if (metresBetween(head, first) <= joinM) chain = [...[...piece].reverse().slice(0, -1), ...chain]
        else continue
        rest.splice(i, 1)
        grown = true
        break
      }
    }
    chains.push(chain)
  }
  return chains.sort((a, b) => lineLength(b) - lineLength(a))
}

/** Linie so drehen, dass sie am Bahnhof beginnt. */
export function startAt(line: readonly GeoPoint[], station: GeoPoint): GeoPoint[] {
  return metresBetween(line[0], station) <= metresBetween(line[line.length - 1], station) ? [...line] : [...line].reverse()
}

export interface TrainState {
  /** Meter ab dem Bahnhof */
  distanceM: number
  /** +1: fährt vom Bahnhof weg, −1: zum Bahnhof, 0: steht */
  direction: 1 | -1 | 0
  atStation: boolean
  /** Sekunden bis zur nächsten Ankunft am Bahnhof (0, wenn er dort steht) */
  nextArrivalS: number
  /** Sekunden bis zur nächsten Abfahrt am Bahnhof */
  nextDepartureS: number
}

export const TRAIN_SPEED_MPS = 11      // rund 40 km/h auf der Nebenbahn
export const TRAIN_DWELL_S = 120       // Aufenthalt an beiden Enden

/** Wo der Zug zur Zeit `nowMs` ist: Aufenthalt am Bahnhof, Fahrt hinaus, Aufenthalt am Ende, Fahrt zurück. */
export function trainState(lengthM: number, nowMs: number, speed = TRAIN_SPEED_MPS, dwellS = TRAIN_DWELL_S): TrainState {
  const runS = Math.max(1, lengthM / speed)
  const cycle = 2 * (runS + dwellS)
  const t = ((nowMs / 1000) % cycle + cycle) % cycle
  if (t < dwellS) return { distanceM: 0, direction: 0, atStation: true, nextArrivalS: 0, nextDepartureS: dwellS - t }
  if (t < dwellS + runS) { const s = t - dwellS; return { distanceM: s * speed, direction: 1, atStation: false, nextArrivalS: cycle - t, nextDepartureS: cycle - t + 0 } }
  if (t < 2 * dwellS + runS) return { distanceM: lengthM, direction: 0, atStation: false, nextArrivalS: cycle - t, nextDepartureS: cycle - t }
  const s = t - (2 * dwellS + runS)
  return { distanceM: Math.max(0, lengthM - s * speed), direction: -1, atStation: false, nextArrivalS: runS - s, nextDepartureS: runS - s + dwellS }
}

/** Punkt und Richtung (Bogenmaß, Osten = 0, Norden = π/2) bei `distanceM` entlang der Linie. */
export function pointAlong(line: readonly GeoPoint[], distanceM: number): { at: GeoPoint; heading: number } {
  let rest = Math.max(0, distanceM)
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], length = metresBetween(a, b)
    const heading = Math.atan2((b.lat - a.lat) * M_PER_DEG, (b.lon - a.lon) * M_PER_DEG * Math.cos(a.lat * Math.PI / 180))
    if (rest <= length || i === line.length - 1) {
      const t = length > 0 ? Math.min(1, rest / length) : 0
      return { at: { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t }, heading }
    }
    rest -= length
  }
  return { at: line[0], heading: 0 }
}
