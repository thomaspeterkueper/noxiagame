// Canonical development matrix for the VEX exploration-drone family.
//
// User canon: the VEX series begins with VEX-01. VEX-47 remains the first
// currently bound high-capability NOXIA survey implementation. Intermediate
// milestone numbers are provisional design anchors until OTA/Engineering
// canonicalises their exact history and physical performance.
//
// Quantitative values deliberately remain unresolved here. Range, endurance,
// payload mass, power and sensor performance belong to Engineering evidence,
// not to a lore/progression matrix.

export type VexSeriesCanonStatus = 'canonical' | 'provisional_milestone'
export type VexSeriesAvailability = 'historical' | 'planned' | 'buildable'
export type VexAutonomyBand = 'manual_assist' | 'supervised' | 'autonomous' | 'advanced_autonomous'
export type VexSurveyBand = 'visual' | 'mapping' | 'prospecting' | 'advanced_prospecting'

export type VexSeriesMilestone = {
  id: string
  model: string
  sequence: number
  canonStatus: VexSeriesCanonStatus
  availability: VexSeriesAvailability
  role: string
  autonomy: VexAutonomyBand
  surveyBand: VexSurveyBand
  supportedSurveyFunctions: readonly string[]
  gameplayMeaning: string
  explorationAssetTypeId?: string
  quantitativePerformance: {
    rangeKm: null
    enduranceMinutes: null
    payloadKg: null
    powerWh: null
  }
  notes: string
}

const unresolvedPerformance = {
  rangeKm: null,
  enduranceMinutes: null,
  payloadKg: null,
  powerWh: null,
} as const

export const VEX_SERIES_MILESTONES: readonly VexSeriesMilestone[] = [
  {
    id: 'vex_01',
    model: 'VEX-01',
    sequence: 1,
    canonStatus: 'canonical',
    availability: 'historical',
    role: 'Früher Nahbereichs-Erkunder',
    autonomy: 'manual_assist',
    surveyBand: 'visual',
    supportedSurveyFunctions: ['visual_reconnaissance', 'hazard_inspection', 'local_mapping'],
    gameplayMeaning: 'Frühe, robuste Erkundung: Gelände ansehen, Gefahren melden und unbekannte Bereiche kartieren, noch ohne vollwertige Rohstoffprospektion.',
    quantitativePerformance: unresolvedPerformance,
    notes: 'Kanonischer Ursprung der VEX-Baureihe. Exakte technische Daten und Entstehungsdatum sind noch nicht festgelegt.',
  },
  {
    id: 'vex_07',
    model: 'VEX-07',
    sequence: 7,
    canonStatus: 'provisional_milestone',
    availability: 'planned',
    role: 'Frühe Aufklärungsdrohne',
    autonomy: 'supervised',
    surveyBand: 'mapping',
    supportedSurveyFunctions: ['visual_reconnaissance', 'terrain_mapping', 'route_inspection'],
    gameplayMeaning: 'Zwischenstufe für wiederholbare Kartierungs- und Inspektionsmissionen; noch keine hochwertige wissenschaftliche Prospektion.',
    quantitativePerformance: unresolvedPerformance,
    notes: 'Provisorischer Serienmeilenstein; Nummer und Rolle bleiben bis zur OTA-Kanonisierung änderbar.',
  },
  {
    id: 'vex_18',
    model: 'VEX-18',
    sequence: 18,
    canonStatus: 'provisional_milestone',
    availability: 'planned',
    role: 'Kartierungs- und Vermessungsdrohne',
    autonomy: 'supervised',
    surveyBand: 'mapping',
    supportedSurveyFunctions: ['terrain_mapping', 'survey_grid', 'anomaly_localisation'],
    gameplayMeaning: 'Systematische Flächenaufnahme und Eingrenzung von Anomalien als Vorbereitung spezialisierter Messungen.',
    quantitativePerformance: unresolvedPerformance,
    notes: 'Provisorischer Serienmeilenstein; keine erfundenen Sensor-, Reichweiten- oder Flugleistungswerte.',
  },
  {
    id: 'vex_32',
    model: 'VEX-32',
    sequence: 32,
    canonStatus: 'provisional_milestone',
    availability: 'planned',
    role: 'Spezialisierte Survey-Drohne',
    autonomy: 'autonomous',
    surveyBand: 'prospecting',
    supportedSurveyFunctions: ['anomaly_localisation', 'targeted_remote_sensing', 'prospecting_support'],
    gameplayMeaning: 'Erste Seriengeneration, die gezielt orbitale oder bodengebundene Anomalien mit spezialisierten berührungslosen Sensoren nachuntersucht.',
    quantitativePerformance: unresolvedPerformance,
    notes: 'Provisorischer Übergang zur wissenschaftlichen VEX-Linie; konkrete Payload-Kompatibilität wird separat festgelegt.',
  },
  {
    id: 'vex_47',
    model: 'VEX-47',
    sequence: 47,
    canonStatus: 'canonical',
    availability: 'buildable',
    role: 'Fortgeschrittene Explorationsdrohne',
    autonomy: 'advanced_autonomous',
    surveyBand: 'advanced_prospecting',
    supportedSurveyFunctions: ['targeted_remote_sensing', 'prospecting_support', 'high_quality_local_survey'],
    gameplayMeaning: 'Ausgereifte mobile Prospektionsplattform zwischen großräumiger Fernerkundung und lokaler Bodenbestätigung.',
    explorationAssetTypeId: 'vex_47',
    quantitativePerformance: unresolvedPerformance,
    notes: 'Bereits an den kanonischen NOXIA-Explorationstyp und die Survey-Plattform gebunden. Individuelle VEX-Lain-Eigenschaften bleiben Instanzmerkmale.',
  },
] as const

export const VEX_SERIES_BY_ID: Readonly<Record<string, VexSeriesMilestone>> =
  Object.fromEntries(VEX_SERIES_MILESTONES.map(model => [model.id, model]))

export function getVexSeriesMilestone(id: string): VexSeriesMilestone | null {
  return VEX_SERIES_BY_ID[id] ?? null
}

export function vexSeriesProgression(): readonly VexSeriesMilestone[] {
  return [...VEX_SERIES_MILESTONES].sort((a, b) => a.sequence - b.sequence)
}

export function isCanonicalVexModel(id: string): boolean {
  return getVexSeriesMilestone(id)?.canonStatus === 'canonical'
}
