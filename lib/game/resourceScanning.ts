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
  instrument: InstrumentDef | null
}

export function scannerCapability(hardwareLevel: number, knowledgePoints: number, instrumentId?: string | null): ScannerCapability {
  const level = Math.max(0, Math.floor(Number.isFinite(hardwareLevel) ? hardwareLevel : 0))
  const knowledge = Math.max(0, Math.floor(Number.isFinite(knowledgePoints) ? knowledgePoints : 0))
  let interpretationLevel: 0 | 1 | 2 | 3 = knowledge >= 5000 ? 3 : knowledge >= 2000 ? 2 : knowledge >= 500 ? 1 : 0
  const channels: SensorChannel[] = ['spectral', 'mineral']
  if (level >= 1) channels.push('radiometric')
  if (level >= 2) channels.push('subsurface')

  const instrument = instrumentId && instrumentId in INSTRUMENTS ? INSTRUMENTS[instrumentId as InstrumentId] : null
  if (instrument?.interpretationLevelCap !== undefined) {
    interpretationLevel = Math.min(interpretationLevel, instrument.interpretationLevelCap) as 0 | 1 | 2 | 3
  }

  return {
    hardwareLevel: level,
    knowledgePoints: knowledge,
    interpretationLevel,
    // Ein gewaehltes Instrument bestimmt Reichweite/Empfindlichkeit fuer
    // DIESEN Messvorgang (repraesentiert das eingesetzte Geraet); ohne
    // Instrument gilt weiterhin die Basis-Hardware-Kurve wie bisher.
    radiusKm: instrument?.radiusKm ?? (level >= 3 ? 0.75 : level === 2 ? 0.55 : level === 1 ? 0.4 : 0.3),
    detectionMultiplier: instrument?.detectionMultiplier ?? (level >= 3 ? 1.15 : level === 2 ? 1 : level === 1 ? 0.82 : 0.65),
    channels,
    instrument,
  }
}

// 16.09.2026 ergaenzt: spezialisierte Instrumente statt nur linearer
// Scanner-Level. Ein Instrument ersetzt NICHT die Hardware-Kanal-Freischaltung
// (radiometrisch/Untergrund bleiben an hardwareLevel gebunden), sondern gibt
// fuer seine physikalische Messmethode einen Empfindlichkeits-/Reichweiten-
// bonus. Ausnahme Bohrkernanalyse: echte physische Probe, umgeht den
// Kanal-Gate komplett, dafuer nur ein einzelner Punkt statt eines Radius.
// Orbitales Remote Sensing: sehr groszer Radius, aber die Interpretation
// bleibt grob gedeckelt (Tier-Andeutung ohne Rohstofftyp), unabhaengig vom
// Wissensstand -- man muss vor Ort nachmessen, um Genaueres zu erfahren.

export type SensorMethod = 'density' | 'spectral' | 'subsurface' | 'any'
export type InstrumentId = 'gravimetry' | 'magnetometry' | 'hyperspectral' | 'seismic' | 'core_sample' | 'orbital'

// Physikalische Methode, mit der ein Rohstofftyp am ehesten erkennbar ist.
// Nicht abschlieszend fuer alle Typen -- fehlende Zuordnung heisst: kein
// spezialisierter Bonus verfuegbar, Basis-Hardware-Kanal bleibt maszgeblich.
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
}

export const INSTRUMENTS: Record<InstrumentId, InstrumentDef> = {
  gravimetry: { id: 'gravimetry', name: 'Gravimetrie', method: 'density', radiusKm: 0.5, detectionMultiplier: 1.2 },
  magnetometry: { id: 'magnetometry', name: 'Magnetometrie', method: 'density', radiusKm: 0.4, detectionMultiplier: 1.3 },
  hyperspectral: { id: 'hyperspectral', name: 'Hyperspektralanalyse', method: 'spectral', radiusKm: 0.5, detectionMultiplier: 1.3 },
  seismic: { id: 'seismic', name: 'Seismik', method: 'subsurface', radiusKm: 0.45, detectionMultiplier: 1.25 },
  core_sample: { id: 'core_sample', name: 'Bohrkernanalyse', method: 'any', radiusKm: 0.005, detectionMultiplier: 5, bypassesChannelGate: true },
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
  // Methodenbonus nur, wenn das gewaehlte Instrument physikalisch zu diesem
  // Rohstofftyp passt (z.B. Magnetometrie fuer dichte Metallvorkommen). Ohne
  // Uebereinstimmung bleibt es bei der normalen Empfindlichkeit -- ein
  // "falsches" Spezialgeraet hilft nicht, schadet aber auch nicht.
  const methodMatches = capability.instrument
    ? capability.instrument.method === 'any' || capability.instrument.method === resourceMethod(candidate.resourceType)
    : false
  const multiplier = methodMatches ? capability.detectionMultiplier : (capability.instrument ? 1 : capability.detectionMultiplier)
  return Math.min(0.99, base * multiplier)
}

// Ein Fehlschlag wird nicht persistiert. Eine spaetere Messung mit besserer
// Technik oder einfach ein weiterer Versuch kann denselben Fund aufdecken.
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
