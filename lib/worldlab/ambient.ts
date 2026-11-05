// lib/worldlab/ambient.ts
// Kleine Bewegung und Stimmung auf der Weltkarte (Thomas, 05.11.2026, nach Forge of Empires):
// Solaranlagen auf einem Teil der Dächer, glitzerndes Wasser, Licht in den Fenstern
// am Abend, sehr sparsam Rauch aus Schornsteinen in der Heizzeit.
// Alles hier ist rein rechnerisch (keine Grafik), damit es testbar bleibt.

/** Stabile Zahl 0…1 aus einem Schlüssel (OSM-Kennung oder Lage). */
export function seeded(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

export type RoofKind = 'house' | 'row' | 'hall' | 'factory' | 'church' | 'shed'

/**
 * Hat dieses Dach eine Solaranlage? Etwa jedes dritte Wohnhaus, jede zweite Halle;
 * Kirchen, Schuppen und sehr kleine Häuser nicht.
 */
export function hasSolar(kind: RoofKind, key: string, areaM2: number): boolean {
  if (kind === 'church' || kind === 'shed' || areaM2 < 45) return false
  const share = kind === 'hall' || kind === 'factory' ? 0.5 : kind === 'row' ? 0.25 : 0.33
  return seeded('solar:' + key) < share
}

/** Schornstein mit Rauch: nur wenige Wohnhäuser (nicht übertreiben). */
export function hasChimney(kind: RoofKind, key: string): boolean {
  if (kind !== 'house' && kind !== 'row') return false
  return seeded('chimney:' + key) < 0.06
}

/** Sonnenhöhe in Grad (Näherung, genau auf rund ein Grad). */
export function sunElevationDeg(lat: number, lon: number, utcMs: number): number {
  const day = utcMs / 86_400_000 + 2440587.5 - 2451545.0          // Tage seit J2000
  const g = (357.529 + 0.98560028 * day) * Math.PI / 180            // mittlere Anomalie
  const q = 280.459 + 0.98564736 * day                              // mittlere Länge
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180
  const e = (23.439 - 0.00000036 * day) * Math.PI / 180
  const decl = Math.asin(Math.sin(e) * Math.sin(L))
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L))
  const gmst = (18.697374558 + 24.06570982441908 * day) % 24        // Sternzeit Greenwich in Stunden
  const hourAngle = ((gmst * 15 + lon) * Math.PI / 180) - ra
  const phi = lat * Math.PI / 180
  const sinAlt = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(hourAngle)
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI
}

/** Wie hell die Welt ist: 1 am Tag, 0 in der Nacht, dazwischen die Dämmerung (+6° bis −6°). */
export function daylight(elevationDeg: number): number {
  return Math.max(0, Math.min(1, (elevationDeg + 6) / 12))
}

/** Farbe, mit der Boden, Häuser und Bäume getönt werden: am Tag weiß, nachts gedämpft bläulich. */
export function dayTint(elevationDeg: number): number {
  const t = daylight(elevationDeg)
  const night = [0x9a, 0xa4, 0xbe], dusk = [0xe6, 0xd2, 0xc4]
  // Erst etwas wärmer (Abendrot), dann blau – nie ganz dunkel, die Karte muss lesbar bleiben.
  const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k))
  const rgb = t >= 0.5 ? mix(dusk, [0xff, 0xff, 0xff], (t - 0.5) * 2) : mix(night, dusk, t * 2)
  return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
}

/** Ortszeit nach Sonnenstand (Stunden 0…24), für „spät in der Nacht sind die Fenster dunkel“. */
export function solarHour(lon: number, utcMs: number): number {
  const utcHours = (utcMs / 3_600_000) % 24
  return ((utcHours + lon / 15) % 24 + 24) % 24
}

/**
 * Brennt in diesem Fenster Licht? Ab der Dämmerung bis etwa Mitternacht und
 * früh am Morgen; je Fenster etwas versetzt, damit nicht alle auf einmal angehen.
 */
export function windowLit(elevationDeg: number, lon: number, utcMs: number, key: string): boolean {
  const r = seeded('lit:' + key)
  if (elevationDeg > 2 - r * 4) return false
  const hour = solarHour(lon, utcMs)
  const off = 22.5 + r * 2.5, on = 5.5 + r * 1.2        // Schlafenszeit je Fenster verschieden
  if (hour >= off || hour < on) return r < 0.08            // wenige Nachteulen
  return r < 0.7
}

/** Heizzeit: Oktober bis April auf der Nordhalbkugel, umgekehrt im Süden; in warmen Breiten nie. */
export function heatingSeason(lat: number, utcMs: number): boolean {
  if (Math.abs(lat) < 36) return false
  const month = new Date(utcMs).getUTCMonth()  // 0 = Januar
  const northWinter = month >= 9 || month <= 3
  return lat > 0 ? northWinter : !northWinter
}
