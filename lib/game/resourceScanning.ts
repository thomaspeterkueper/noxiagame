// lib/game/resourceScanning.ts
// Erstellt: 16.09.2026
// Rohstoff-Prospektion auf Basis realer Geodaten (region_resources), als
// paralleler Signalpfad zum alten Kachel-Terrain-Scanner (lib/game/scanning.ts).
// Gilt fuer Standorte mit echtem Lat/Lon-System (aktuell: Earth-Regionen).
//
// Grundprinzip (Gespraech 16.09.2026):
// - Ressourcenverteilung ist erst durch Spieler-Aktion (Scan) aufgedeckt,
//   nicht von Anfang an sichtbar
// - Ein Scan kann auch ergebnislos bleiben -- kein Fund heisst nicht "leer",
//   sondern nur "diesmal nicht gefunden"; nichts wird bei Fehlschlag persistiert,
//   ein erneuter Versuch bleibt jederzeit moeglich
// - MRDS-bestaetigte Zellen sind fast immer auffindbar (reale Evidenz);
//   rein modellierte Zellen haben eine von ihrem Tier abhaengige Fundchance
// - Ein Fund gehoert der geteilten Welt (location_id), nicht dem Finder

export type ResourceTier = 'trace' | 'viable' | 'rich' | 'exceptional'

const DISCOVERY_PROBABILITY: Record<ResourceTier, number> = {
  trace: 0.2,
  viable: 0.5,
  rich: 0.8,
  exceptional: 0.95,
}
const MRDS_CONFIRMED_PROBABILITY = 0.97

export function discoveryProbability(tier: ResourceTier, mrdsBoosted: boolean): number {
  if (mrdsBoosted) return MRDS_CONFIRMED_PROBABILITY
  return DISCOVERY_PROBABILITY[tier] ?? DISCOVERY_PROBABILITY.trace
}

export interface ResourceCandidate {
  id: string
  resourceType: string
  lat: number
  lon: number
  abundance: number
  tier: ResourceTier
  mrdsBoosted: boolean
}

export interface ResourceScanResult {
  candidate: ResourceCandidate
  found: boolean
}

// rollFn ist injizierbar (Test-Determinismus); Default ist echter Zufall --
// der Scan-*Ausgang* ist bewusst NICHT deterministisch (siehe "kann leer
// ausgehen"), nur die zugrunde liegende Ressourcenlandschaft selbst ist es.
export function rollResourceScan(
  candidates: ResourceCandidate[],
  alreadyKnownIds: Set<string>,
  rollFn: () => number = Math.random,
): ResourceScanResult[] {
  return candidates
    .filter(c => !alreadyKnownIds.has(c.id))
    .map(candidate => {
      const p = discoveryProbability(candidate.tier, candidate.mrdsBoosted)
      return { candidate, found: rollFn() < p }
    })
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lon - a.lon) * Math.PI / 180
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
