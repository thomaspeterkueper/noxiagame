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
  instrument: InstrumentDef | null
}

export function scannerCapability(hardwareLevel: number, knowledgePoints: number, instrumentId?: string | null): ScannerCapability {
  const level = Math.max(0, Math.floor(Number.isFinite(hardwareLevel) ? hardwareLevel : 0))
  const knowledge = Math.max(0, Math.floor(Number.isFinite(knowledgePoints) ? knowledgePoints : 0))
  let interpretationLevel: 0 | 1 | 2 | 3 = knowledge >= 5000 ? 3 : knowledge >= 2000 ? 2 : knowledge >= 500 ? 1 : 0
  const channels: SensorChannel[] = ['spectral', 'mineral']
  if (level >= 1) channels.push('radiometric')
  if (level >= 2) channels.push('subsurface')

  const candidate = instrumentId && instrumentId in INSTRUMENTS ? INSTRUMENTS[instrumentId as InstrumentId] : null
  // Zielgebundene Instrumente (aktuell Bohrkern) duerfen niemals ueber den
  // normalen Radius-Scanner aktiviert werden. Sie besitzen einen eigenen Jobpfad.
  const instrument = candidate?.targetedOnly ? null : candidate
  if (instrument?.interpretationLevelCap !== undefined) {
    interpretationLevel = Math.min(interpretationLevel, instrument.interpretationLevelCap) as 0 | 1 | 2 | 3
  }

  return {
    hardwareLevel: level,
    knowledgePoints: knowledge,
    interpretationLevel,
    radiusKm: instrument?.radiusKm ?? (level >= 3 ? 0.75 : level === 2 ? 0.55 : level === 1 ? 0.4 : 0.3),
    detectionMultiplier: instrument?.detectionMultiplier ?? (level >= 3 ? 1.15 : level === 2 ? 1 : level === 1 ? 0.82 : 0.65),
    channels,
    instrument,
  }
}

export type SensorMethod = 'density' | 'spectral' | 'subsurface' | 'any'
export type InstrumentId = 'gravimetry' | 'magnetometry' | 'hyperspectral' | 'seismic' | 'core_sample' | 'orbital'

const RESOURCE_METHOD: Partial<Record<string, SensorMethod>> = {
  iron_ore: 'density', copper_ore: 'density', nickel: 'density', cobalt: 'density',
  zinc: 'density', lead: 'density', titanium: 'density', zirconium: 'density', gold: 'density',
  rare_earth: 'spectral', silica_quartz: 'spectral', sand_gravel: 'spectral', limestone: 'spectral',
  salt: 'spectral', bauxite: 'spectral', lithium: 'spectral', gypsum: 'spectral', phosphate: 'spectral',
  groundwater: 'subsurface',
}

export interface InstrumentDef {
  id: InstrumentId
  name: string
  method: SensorMethod
  radiusKm: number
  detectionMultiplier: number
  bypassesChannelGate?: boolean
  interpretationLevelCap?: 0 | 1 | 2 | 3
  targetedOnly?: boolean
}

export const INSTRUMENTS: Record<InstrumentId, InstrumentDef> = {
  gravimetry: { id: 'gravimetry', name: 'Gravimetrie', method: 'density', radiusKm: 0.5, detectionMultiplier: 1.2 },
  magnetometry: { id: 'magnetometry', name: 'Magnetometrie', method: 'density', radiusKm: 0.4, detectionMultiplier: 1.3 },
  hyperspectral: { id: 'hyperspectral', name: 'Hyperspektralanalyse', method: 'spectral', radiusKm: 0.5, detectionMultiplier: 1.3 },
  seismic: { id: 'seismic', name: 'Seismik', method: 'subsurface', radiusKm: 0.45, detectionMultiplier: 1.25 },
  core_sample: { id: 'core_sample', name: 'Bohrkernanalyse', method: 'any', radiusKm: 0.005, detectionMultiplier: 5, bypassesChannelGate: true, targetedOnly: true },
  orbital: { id: 'orbital', name: 'Orbitales Remote Sensing', method: 'any', radiusKm: 5, detectionMultiplier: 0.5, interpretationLevelCap: 0 },
}

export function resourceMethod(resourceType: string): SensorMethod | undefined {
  return RESOURCE_METHOD[resourceType]
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
  const bypassed = Boolean(capability.instrument?.bypassesChannelGate)
  if (!bypassed && !capability.channels.includes(requiredChannel(candidate.resourceType))) return 0
  const base = candidate.mrdsBoosted ? MRDS_CONFIRMED_PROBABILITY : (DISCOVERY_PROBABILITY[candidate.tier] ?? DISCOVERY_PROBABILITY.trace)
  const methodMatches = capability.instrument
    ? capability.instrument.method === 'any' || capability.instrument.method === resourceMethod(candidate.resourceType)
    : false
  const multiplier = methodMatches ? capability.detectionMultiplier : (capability.instrument ? 1 : capability.detectionMultiplier)
  return Math.min(0.99, base * multiplier)
}

export function rollResourceScan(
  candidates: ResourceCandidate[],
  alreadyKnownIds: Set<string>,
  capability: ScannerCapability,
  rollFn: () => number = Math.random,
): ResourceScanResult[] {
  const bypassed = Boolean(capability.instrument?.bypassesChannelGate)
  return candidates
    .filter(c => !alreadyKnownIds.has(c.id))
    .map(candidate => {
      const required = requiredChannel(candidate.resourceType)
      const measurable = bypassed || capability.channels.includes(required)
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
