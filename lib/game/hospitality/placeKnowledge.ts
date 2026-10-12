// lib/game/hospitality/placeKnowledge.ts
// Ortswissen: was jemand über die Gegend weiß, in der er lebt – auch ohne es
// gerade zu sehen. Reine Regeln; die Daten lädt placeKnowledge.server.ts.
//
// Zwei Quellen, nichts Erfundenes:
//   - reale Geographie aus den importierten Kartendaten (Orte, Gewässer, Wald,
//     benannte Betriebe und Straßen),
//   - NOXIA: Gebäude am Ort und kanonische Landmarken.
//
// Das ist Wissen über den Ort, nicht über Personen. Wer dort wohnt, was jemand
// besitzt oder vorhat, gehört nicht hierher.

export const MAX_PLACE_FACTS = 10
export const MAX_PLACE_FACT_CHARS = 140

export interface PlaceFeatureInput {
  name: string
  /** Klasse aus den Kartendaten: settlement, water, waterway, forest, road, … */
  featureType: string
  /** Bei Siedlungen: town, village, hamlet, … */
  placeKind?: string | null
  distanceM: number
}

export interface PlaceBuildingInput {
  typeId: string
  name: string
  distanceM: number
  /** Kompassrichtung vom Lokal aus in Grad (0 = Norden, 90 = Osten). */
  bearingDeg: number
}

export interface PlaceLandmarkInput {
  name: string
  locality: string
  noxiaRole: string
  distanceM: number
}

export interface PlaceKnowledgeInput {
  /** Bezeichnung des Ortes, z. B. „Sundern, Hochsauerlandkreis, Nordrhein-Westfalen, 59846, Deutschland“. */
  placeLabel?: string | null
  features: readonly PlaceFeatureInput[]
  buildings: readonly PlaceBuildingInput[]
  landmarks: readonly PlaceLandmarkInput[]
}

/** Gebäude, über die niemand als Besonderheit des Ortes spricht. */
const UNREMARKABLE_BUILDINGS = new Set([
  'road', 'solar', 'habitat', 'residential_block', 'battery_storage', 'water_recycler', 'oxygen_recycler',
  'radiator_field', 'warehouse_storage', 'spaceport_storage', 'spaceport_service',
])

const DIRECTIONS = ['nördlich', 'nordöstlich', 'östlich', 'südöstlich', 'südlich', 'südwestlich', 'westlich', 'nordwestlich']

export function compassDirection(bearingDeg: number): string {
  const normalized = ((bearingDeg % 360) + 360) % 360
  return DIRECTIONS[Math.round(normalized / 45) % 8]
}

export function roughDistance(distanceM: number): string {
  if (distanceM < 75) return 'gleich nebenan'
  if (distanceM < 950) return `ca. ${Math.max(100, Math.round(distanceM / 100) * 100)} m`
  return `ca. ${(Math.round(distanceM / 100) / 10).toLocaleString('de-DE')} km`
}

function clean(value: unknown): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** „Sundern, Hochsauerlandkreis, Nordrhein-Westfalen, 59846, Deutschland“ → Ort und Einordnung ohne Postleitzahl. */
export function splitPlaceLabel(label: string | null | undefined): { town: string; within: string } | null {
  const parts = clean(label).split(',').map(part => part.trim()).filter(part => part && !/^\d[\d\s-]*$/.test(part))
  if (parts.length === 0 || /^lokaldetail\b/i.test(parts[0])) return null
  return { town: parts[0], within: parts.slice(1).join(', ') }
}

/** Namen der Reihe nach anhängen, solange der Satz in die Grenze passt. */
function listFact(prefix: string, names: readonly string[]): string | null {
  let list = ''
  for (const name of names) {
    const next = list ? `${list}, ${name}` : name
    if ((prefix + next).length > MAX_PLACE_FACT_CHARS) break
    list = next
  }
  return list ? prefix + list : null
}

function nearestNames(features: readonly PlaceFeatureInput[], types: readonly string[], limit: number, skip: ReadonlySet<string> = new Set()): string[] {
  const seen = new Set<string>(skip)
  const names: string[] = []
  for (const feature of [...features].filter(f => types.includes(f.featureType)).sort((a, b) => a.distanceM - b.distanceM)) {
    const name = clean(feature.name)
    const key = name.toLocaleLowerCase('de-DE')
    if (!name || name.length > 60 || seen.has(key)) continue
    seen.add(key)
    names.push(name)
    if (names.length >= limit) break
  }
  return names
}

function fit(text: string): string {
  return text.length <= MAX_PLACE_FACT_CHARS ? text : text.slice(0, MAX_PLACE_FACT_CHARS - 1).trimEnd() + '…'
}

/**
 * Ortswissen als kurze Sätze für die Gesprächspipeline. Reihenfolge nach
 * Nutzen im Gespräch: erst wo man ist, dann NOXIA am Ort, dann die Gegend.
 * Liegt nichts vor, bleibt die Liste leer – dann weiß die Figur eben nichts.
 */
export function placeKnowledgeFacts(input: PlaceKnowledgeInput): string[] {
  const facts: string[] = []
  const place = splitPlaceLabel(input.placeLabel)
  const settlements = [...input.features].filter(f => f.featureType === 'settlement' && f.placeKind !== 'noxia_reference_site')
  const town = place?.town ?? nearestNames(settlements.filter(s => s.placeKind === 'town' || s.placeKind === 'city'), ['settlement'], 1)[0] ?? null

  if (town) facts.push(place?.within ? `Dieser Ort gehört zu ${town} (${place.within})` : `Dieser Ort gehört zu ${town}`)
  const reference = input.features.find(f => f.placeKind === 'noxia_reference_site')
  if (reference) facts.push(`${clean(reference.name).split('·')[0].trim()} ist ein NOXIA-Referenzstandort, ${roughDistance(reference.distanceM)} von hier`)

  // NOXIA am Ort: je Gebäudeart das nächste, mit Entfernung und Richtung.
  const byType = new Map<string, PlaceBuildingInput>()
  for (const building of [...input.buildings].sort((a, b) => a.distanceM - b.distanceM)) {
    if (UNREMARKABLE_BUILDINGS.has(building.typeId) || byType.has(building.typeId)) continue
    byType.set(building.typeId, building)
  }
  const noxia = [...byType.values()].map(b => b.distanceM < 75
    ? `${clean(b.name)} (gleich nebenan)`
    : `${clean(b.name)} (${roughDistance(b.distanceM)} ${compassDirection(b.bearingDeg)})`)
  const first = listFact('NOXIA am Ort: ', noxia)
  if (first) {
    facts.push(first)
    const used = first.slice('NOXIA am Ort: '.length).split('), ').length
    const more = listFact('Außerdem am Ort: ', noxia.slice(used))
    if (more) facts.push(more)
  }

  for (const landmark of [...input.landmarks].sort((a, b) => a.distanceM - b.distanceM).slice(0, 2)) {
    facts.push(fit(`${clean(landmark.name)} (${clean(landmark.locality)}): ${clean(landmark.noxiaRole)}`))
  }

  const townKey = new Set(town ? [town.toLocaleLowerCase('de-DE')] : [])
  const lists: Array<[string, string[]]> = [
    ['Orte in der Umgebung: ', nearestNames(settlements, ['settlement'], 6, townKey)],
    ['Gewässer in der Gegend: ', nearestNames(input.features, ['water', 'waterway'], 5)],
    ['Wald und Landschaft: ', nearestNames(input.features, ['forest'], 4)],
    ['Bekannte Plätze und Betriebe: ', nearestNames(input.features, ['public', 'industrial', 'farmland', 'building', 'urban'], 6)],
    ['Straßen in der Nähe: ', nearestNames(input.features, ['road'], 6)],
  ]
  for (const [prefix, names] of lists) {
    const fact = listFact(prefix, names)
    if (fact) facts.push(fact)
  }
  return facts.slice(0, MAX_PLACE_FACTS)
}
