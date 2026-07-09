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
    title: 'Mondbasis gründen',
    subtitle: 'Raumfahrt, Landung und Versorgung lernen',
    goal: 'Errichten Sie eine dauerhafte Basis auf dem Mond.',
    firstStep: 'Kaufen Sie ein geeignetes Schiff und fliegen Sie zum Mond.',
  },
  {
    key: 'merchant',
    icon: '📦',
    title: 'Handel & Logistik',
    subtitle: 'Waren bewegen, Märkte nutzen, Aufträge erfüllen',
    goal: 'Bauen Sie ein Handelsnetz zwischen den Welten auf.',
    firstStep: 'Kaufen Sie Ware am aktuellen Standort und suchen Sie einen besseren Verkaufspreis.',
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
      id: 'moon-1',
      journey_key: 'moon_colony',
      step_order: 1,
      title: 'Ein geeignetes Schiff besitzen',
      description: 'Ihr Frachter Mk.I wartet bereits im Dock der Erde. Klicken Sie auf die Werft im Grid — dort können Sie es aktivieren oder aufrüsten.',
      optional: false,
      trigger: { type: 'ship_count', min: 1 },
    },
    {
      id: 'moon-2',
      journey_key: 'moon_colony',
      step_order: 2,
      title: 'Zum Mond reisen',
      description: 'Erde → Mond: 30 Sekunden Flug, 20t Energie (Subvention bereits an Bord). Öffnen Sie den Reisedialog oben und wählen Sie Shackleton.',
      optional: false,
      trigger: { type: 'current_location', value: 'moon' },
    },
    {
      id: 'moon-3',
      journey_key: 'moon_colony',
      step_order: 3,
      title: 'Energieversorgung sichern',
      description: 'Ohne Energie läuft auf dem Mond nichts. Klicken Sie auf eine freie Kachel und bauen Sie ein Solarfeld (1.200 Cr, 1 Tick). Die Mondpole erhalten fast konstante Sonneneinstrahlung.',
      optional: false,
      trigger: { type: 'entity_at_location', location: 'moon', entityIds: ['solar', 'solar_field', 'power_plant'] },
    },
    {
      id: 'moon-4',
      journey_key: 'moon_colony',
      step_order: 4,
      title: 'Wasser oder Eis erschließen',
      description: 'In den Schattenkratern der Mondpole liegt gefrorenes Wasser — seit Milliarden Jahren. Eine Eisbohrung (2.500 Cr) erschließt es. Wasser ist die Grundlage jeder dauerhaften Basis.',
      optional: false,
      trigger: { type: 'entity_at_location', location: 'moon', entityIds: ['ice_drill', 'water_extractor'] },
    },
  ],
  merchant: [
    {
      id: 'merchant-1',
      journey_key: 'merchant',
      step_order: 1,
      title: 'Laderaum prüfen',
      description: 'Prüfen Sie Ihr aktives Schiff und den freien Laderaum.',
      optional: false,
      trigger: { type: 'ship_count', min: 1 },
    },
    {
      id: 'merchant-2',
      journey_key: 'merchant',
      step_order: 2,
      title: 'Ware kaufen',
      description: 'Kaufen Sie Wasser, Energie oder Metall an einem Standort mit gutem Preis.',
      optional: false,
      trigger: { type: 'ship_count', min: 1 },
    },
    {
      id: 'merchant-3',
      journey_key: 'merchant',
      step_order: 3,
      title: 'Zu einem anderen Markt reisen',
      description: 'Transportieren Sie die Ware zu einem Standort mit besserem Verkaufspreis.',
      optional: false,
      trigger: { type: 'trade_count', min: 1 },
    },
    {
      id: 'merchant-4',
      journey_key: 'merchant',
      step_order: 4,
      title: 'Ware verkaufen oder Auftrag erfüllen',
      description: 'Verkaufen Sie profitabel oder erfüllen Sie einen offenen Auftrag.',
      optional: false,
      trigger: { type: 'trade_count', min: 1 },
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
