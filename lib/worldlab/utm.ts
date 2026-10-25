// lib/worldlab/utm.ts
// UTM Zone 32/33 (ETRS89, EPSG:25832/25833) ↔ WGS84. ETRS89 und WGS84 weichen in Europa
// um weniger als einen Meter voneinander ab – für die Karte gleich.
// Formeln: Krüger-Reihen (Transverse Mercator, GRS80).

const A = 6378137
const F = 1 / 298.257222101
const K0 = 0.9996
const E0 = 500000
/** Mittelmeridian einer UTM-Zone (32 → 9°, 33 → 15°). */
const lon0 = (zone: number) => (zone * 6 - 183) * Math.PI / 180
const N = F / (2 - F)
const A_HAT = A / (1 + N) * (1 + N * N / 4 + N ** 4 / 64)
const ALPHA = [N / 2 - 2 * N * N / 3 + 5 * N ** 3 / 16, 13 * N * N / 48 - 3 * N ** 3 / 5, 61 * N ** 3 / 240]
const BETA = [N / 2 - 2 * N * N / 3 + 37 * N ** 3 / 96, N * N / 48 + N ** 3 / 15, 17 * N ** 3 / 480]
const DELTA = [2 * N - 2 * N * N / 3 - 2 * N ** 3, 7 * N * N / 3 - 8 * N ** 3 / 5, 56 * N ** 3 / 15]
const E2 = F * (2 - F), E = Math.sqrt(E2)

export function toUtm(lat: number, lon: number, zone = 32): { e: number; n: number } {
  const phi = lat * Math.PI / 180, lambda = lon * Math.PI / 180 - lon0(zone)
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - E * Math.atanh(E * Math.sin(phi)))
  const xi = Math.atan2(t, Math.cos(lambda)), eta = Math.atanh(Math.sin(lambda) / Math.sqrt(1 + t * t))
  let x = eta, y = xi
  for (let j = 1; j <= 3; j++) { x += ALPHA[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta); y += ALPHA[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta) }
  return { e: E0 + K0 * A_HAT * x, n: K0 * A_HAT * y }
}

export function fromUtm(e: number, n: number, zone = 32): { lat: number; lon: number } {
  const xi = n / (K0 * A_HAT), eta = (e - E0) / (K0 * A_HAT)
  let xp = xi, ep = eta
  for (let j = 1; j <= 3; j++) { xp -= BETA[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta); ep -= BETA[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta) }
  const chi = Math.asin(Math.sin(xp) / Math.cosh(ep))
  let phi = chi
  for (let j = 1; j <= 3; j++) phi += DELTA[j - 1] * Math.sin(2 * j * chi)
  const lambda = lon0(zone) + Math.atan2(Math.sinh(ep), Math.cos(xp))
  return { lat: phi * 180 / Math.PI, lon: lambda * 180 / Math.PI }
}

export const toUtm32 = (lat: number, lon: number) => toUtm(lat, lon, 32)
export const fromUtm32 = (e: number, n: number) => fromUtm(e, n, 32)
