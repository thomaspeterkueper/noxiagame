// lib/game/journeys/journeyCatalog.ts
// Aktualisiert: 09.10.2026 — Händlerweg neu: erst Handel über fremde Schiffe (Spediteur),
//               dann Erfahrung oder kaufmännische Grundausbildung, zuletzt das eigene Schiff
// Vorher:       09.10.2026 — Mondweg ohne Schiffspflicht (neue Profile starten schifflos)
// Version:      1.2.0

export type JourneyKey = 'moon_colony' | 'merchant' | 'research' | 'industry'

export type JourneyGuideDef = {
  key: JourneyKey
  icon: string
  title: string
  subtitle: string
  goal: string
  firstStep: string
}

export type JourneyStepTrigger =
  | { type: 'ship_count'; min: number }
  | { type: 'current_location'; value: string }
  | { type: 'entity_at_location'; location: string; entityIds: string[] }
  | { type: 'entity_owned_any'; entityIds: string[] }
  | { type: 'entity_owned_count'; entityIds: string[]; min: number }
  | { type: 'trade_count'; min: number }
  | { type: 'purchase_count'; min: number }
  | { type: 'sales_elsewhere'; min: number }
  | { type: 'merchant_qualified' }
  | { type: 'knowledge_points'; min: number }

export type JourneyCatalogStep = {
  id: string
  journey_key: JourneyKey
  step_order: number
  title: string
  description: string
  optional: boolean
  trigger?: JourneyStepTrigger
}

export const JOURNEY_DEFS: JourneyGuideDef[] = [
  {
    key: 'moon_colony',
    icon: '🚀',
    title: 'Von der Erde nach Shackleton',
    subtitle: 'Zum Mond fliegen und die erste Versorgung aufbauen',
    goal: 'Fliegen Sie von der Erde zum Shackleton-Gebiet und errichten Sie dort die ersten dauerhaft nutzbaren Versorgungsstrukturen.',
    firstStep: 'Fliegen Sie nach Shackleton – per Linienflug oder mit dem eigenen Schiff.',
  },
  {
    key: 'merchant',
    icon: '📦',
    title: 'Handel & Logistik',
    subtitle: 'Erst mit dem Spediteur handeln, später mit eigenem Schiff',
    goal: 'Verdienen Sie am Preisunterschied zwischen den Welten – zunächst über fremde Schiffe, dann mit dem eigenen.',
    firstStep: 'Kaufen Sie Ware am aktuellen Standort und verkaufen Sie sie dort, wo sie mehr wert ist.',
  },
  {
    key: 'research',
    icon: '🔬',
    title: 'Forschung aufbauen',
    subtitle: 'Wissen, Akademie und Technologien erschließen',
    goal: 'Entwickeln Sie wissenschaftliche Kompetenz als Motor des Fortschritts.',
    firstStep: 'Suchen Sie eine Akademie oder bauen Sie Forschungskapazität auf.',
  },
  {
    key: 'industry',
    icon: '🏭',
    title: 'Industrie errichten',
    subtitle: 'Energie, Rohstoffe und Produktion sichern',
    goal: 'Versorgen Sie Kolonien mit Energie, Metall und Infrastruktur.',
    firstStep: 'Errichten Sie Energie- oder Rohstoffproduktion an einem passenden Standort.',
  },
]

export const JOURNEY_TITLES: Record<JourneyKey, string> = JOURNEY_DEFS.reduce(
  (acc, journey) => ({ ...acc, [journey.key]: journey.title }),
  {} as Record<JourneyKey, string>
)

export const DEFAULT_JOURNEY_STEPS: Record<JourneyKey, JourneyCatalogStep[]> = {
  moon_colony: [
    {
      id: 'moon-2',
      journey_key: 'moon_colony',
      step_order: 1,
      title: 'Von der Erde nach Shackleton fliegen',
      description: 'Buchen Sie einen Linienflug zum Mond oder fliegen Sie mit dem eigenen Schiff. Der Flug dauert nur wenige Sekunden; nach der Landung sind Sie in Shackleton.',
      optional: false,
      trigger: { type: 'current_location', value: 'moon' },
    },
    {
      id: 'moon-3',
      journey_key: 'moon_colony',
      step_order: 2,
      title: 'Energieversorgung in Shackleton sichern',
      description: 'Wählen Sie auf der Mondkarte einen freien Bauplatz und errichten Sie ein Solarfeld oder eine andere Energieanlage.',
      optional: false,
      trigger: { type: 'entity_at_location', location: 'moon', entityIds: ['solar', 'solar_field', 'power_plant'] },
    },
    {
      id: 'moon-4',
      journey_key: 'moon_colony',
      step_order: 3,
      title: 'Wasser oder Eis erschließen',
      description: 'Bauen Sie anschließend einen Eisbohrer oder Wasserextraktor. Mit Energie und Wasser steht Ihre erste Versorgung.',
      optional: false,
      trigger: { type: 'entity_at_location', location: 'moon', entityIds: ['ice_drill', 'water_extractor'] },
    },
  ],
  merchant: [
    {
      id: 'merchant-1',
      journey_key: 'merchant',
      step_order: 1,
      title: 'Ware einkaufen',
      description: 'Kaufen Sie im Warenhaus Ware, die hier günstig ist. Ohne eigenes Schiff reist sie mit dem Spediteur: bis zu 40 t Fracht.',
      optional: false,
      trigger: { type: 'purchase_count', min: 1 },
    },
    {
      id: 'merchant-2',
      journey_key: 'merchant',
      step_order: 2,
      title: 'An einem anderen Standort verkaufen',
      description: 'Nehmen Sie den Linienflug zu einem Markt mit höherem Preis und verkaufen Sie dort. Der Spediteur behält 12 % des Erlöses.',
      optional: false,
      trigger: { type: 'sales_elsewhere', min: 1 },
    },
    {
      id: 'merchant-3',
      journey_key: 'merchant',
      step_order: 3,
      title: 'Kaufmännisch qualifizieren',
      description: 'Sammeln Sie Handelserfahrung mit fünf Verkäufen an einem anderen Standort als dem Einkaufsort – oder schließen Sie in der Akademie die kaufmännische Grundausbildung ab (drei Wirtschafts-Grundmodule).',
      optional: false,
      trigger: { type: 'merchant_qualified' },
    },
    {
      id: 'merchant-4',
      journey_key: 'merchant',
      step_order: 4,
      title: 'Eigenes Handelsschiff führen',
      description: 'Mit Qualifikation und genug Guthaben können Sie in der Werft auf dem Mond ein eigenes Schiff erwerben: mehr Laderaum, keine Spediteurgebühr.',
      optional: false,
      trigger: { type: 'ship_count', min: 1 },
    },
  ],
  research: [
    {
      id: 'research-1',
      journey_key: 'research',
      step_order: 1,
      title: 'Akademie finden',
      description: 'Suchen Sie einen Standort mit Akademie oder Forschungseinrichtung.',
      optional: false,
      trigger: { type: 'entity_owned_any', entityIds: ['school', 'academy', 'research_lab'] },
    },
    {
      id: 'research-2',
      journey_key: 'research',
      step_order: 2,
      title: 'Erste Wissenspunkte sammeln',
      description: 'Nutzen Sie Akademie-Aufgaben, um Wissen zu gewinnen.',
      optional: false,
      trigger: { type: 'knowledge_points', min: 1 },
    },
    {
      id: 'research-3',
      journey_key: 'research',
      step_order: 3,
      title: 'Forschungsinfrastruktur aufbauen',
      description: 'Bereiten Sie eigene Forschungsgebäude oder Forschungskapazität vor.',
      optional: false,
      trigger: { type: 'entity_owned_any', entityIds: ['school', 'academy', 'research_lab'] },
    },
  ],
  industry: [
    {
      id: 'industry-1',
      journey_key: 'industry',
      step_order: 1,
      title: 'Produktionsstandort wählen',
      description: 'Suchen Sie einen Standort mit freier Fläche und passenden Ressourcen.',
      optional: false,
      trigger: { type: 'entity_owned_count', entityIds: ['solar', 'solar_field', 'mine', 'ice_drill', 'water_extractor'], min: 1 },
    },
    {
      id: 'industry-2',
      journey_key: 'industry',
      step_order: 2,
      title: 'Erstes Produktionsgebäude bauen',
      description: 'Bauen Sie Energie- oder Rohstoffproduktion.',
      optional: false,
      trigger: { type: 'entity_owned_count', entityIds: ['solar', 'solar_field', 'mine', 'ice_drill', 'water_extractor'], min: 1 },
    },
    {
      id: 'industry-3',
      journey_key: 'industry',
      step_order: 3,
      title: 'Überschuss erzeugen',
      description: 'Produzieren Sie mehr, als der Standort verbraucht.',
      optional: false,
      trigger: { type: 'entity_owned_count', entityIds: ['solar', 'solar_field', 'mine', 'ice_drill', 'water_extractor'], min: 2 },
    },
  ],
}

export function isJourneyKey(value: string): value is JourneyKey {
  return value in DEFAULT_JOURNEY_STEPS
}

export function getJourneyTitle(key: string) {
  return isJourneyKey(key) ? JOURNEY_TITLES[key] : undefined
}
