// lib/game/resourceScanning.ts
// Rohstoff-Prospektion auf Basis realer Geodaten (region_resources).
// Technik bestimmt, welche Signale messbar sind; Wissen bestimmt spaeter,
// wie weit ein gemessenes Signal interpretiert werden kann.

export type ResourceTier = 'trace' | 'viable' | 'rich' | 'exceptional'
export type SensorChannel = 'spectral' | 'mineral' | 'radiometric' | 'subsurface'

const DISCOVERY_PROBABILITY: Record<ResourceTier, number> = {
  trace: 0.2,
  viable: 0.5,
  rich: 0.8,
  exceptional: 0.95,
}
const MRDS_CONFIRMED_PROBABILITY = 0.97

const RESOURCE_CHANNEL: Record<string, SensorChannel> = {
  uranium: 'radiometric',
  groundwater: 'subsurface',
  gold: 'mineral',
  copper_ore: 'mineral',
  iron_ore: 'mineral',
  titanium: 'mineral',
  zirconium: 'mineral',
  zinc: 'mineral',
  lead: 'mineral',
  nickel: 'mineral',
  cobalt: 'mineral',
  rare_earth: 'spectral',
  silica_quartz: 'spectral',
  sand_gravel: 'spectral',
  limestone: 'spectral',
  salt: 'spectral',
  bauxite: 'spectral',
  lithium: 'spectral',
  gypsum: 'spectral',
  phosphate: 'spectral',
}

export interface ScannerCapability {
  hardwareLevel: number
  knowledgePoints: number
  interpretationLevel: 0 | 1 | 2 | 3
  radiusKm: number
  detectionMultiplier: number
  channels: SensorChannel[]
}

export function scannerCapability(hardwareLevel: number, knowledgePoints: number): ScannerCapability {
  const level = Math.max(0, Math.floor(Number.isFinite(hardwareLevel) ? hardwareLevel : 0))
  const knowledge = Math.max(0, Math.floor(Number.isFinite(knowledgePoints) ? knowledgePoints : 0))
  const interpretationLevel: 0 | 1 | 2 | 3 = knowledge >= 5000 ? 3 : knowledge >= 2000 ? 2 : knowledge >= 500 ? 1 : 0
  const channels: SensorChannel[] = ['spectral', 'mineral']
  if (level >= 1) channels.push('radiometric')
  if (level >= 2) channels.push('subsurface')

  return {
    hardwareLevel: level,
    knowledgePoints: knowledge,
    interpretationLevel,
    radiusKm: level >= 3 ? 0.75 : level === 2 ? 0.55 : level === 1 ? 0.4 : 0.3,
    detectionMultiplier: level >= 3 ? 1.15 : level === 2 ? 1 : level === 1 ? 0.82 : 0.65,
    channels,
  }
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
  measurable: boolean
  probability: number
  requiredChannel: SensorChannel
}

export function requiredChannel(resourceType: string): SensorChannel {
  return RESOURCE_CHANNEL[resourceType] ?? 'spectral'
}

export function discoveryProbability(candidate: ResourceCandidate, capability: ScannerCapability): number {
  if (!capability.channels.includes(requiredChannel(candidate.resourceType))) return 0
  const base = candidate.mrdsBoosted ? MRDS_CONFIRMED_PROBABILITY : (DISCOVERY_PROBABILITY[candidate.tier] ?? DISCOVERY_PROBABILITY.trace)
  return Math.min(0.99, base * capability.detectionMultiplier)
}

// Ein Fehlschlag wird nicht persistiert. Eine spaetere Messung mit besserer
// Technik oder einfach ein weiterer Versuch kann denselben Fund aufdecken.
export function rollResourceScan(
  candidates: ResourceCandidate[],
  alreadyKnownIds: Set<string>,
  capability: ScannerCapability,
  rollFn: () => number = Math.random,
): ResourceScanResult[] {
  return candidates
    .filter(c => !alreadyKnownIds.has(c.id))
    .map(candidate => {
      const required = requiredChannel(candidate.resourceType)
      const measurable = capability.channels.includes(required)
      const probability = discoveryProbability(candidate, capability)
      return { candidate, measurable, probability, requiredChannel: required, found: measurable && rollFn() < probability }
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
