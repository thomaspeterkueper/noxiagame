export type EarthMicroregionNodeKind = 'arrival' | 'settlement' | 'landscape' | 'passage' | 'culture' | 'research'

export type EarthMicroregionNode = {
  id: string
  name: string
  kind: EarthMicroregionNodeKind
  locality: string
  locator: string
  role: string
}

export type EarthMicroregionLink = {
  from: string
  to: string
  relation: 'road' | 'rail' | 'trail' | 'landscape-transition'
  note?: string
}

export type EarthMicroregion = {
  id: string
  name: string
  anchorLandmarkId: string
  sourceProjects: string[]
  nodes: readonly EarthMicroregionNode[]
  links: readonly EarthMicroregionLink[]
}

/**
 * Small playable/readable Earth slices around canonical landmarks.
 * These are deliberately not full city/region simulations. A microregion records
 * only the few places and connections that matter for gameplay and book-world lore.
 */
export const EARTH_MICROREGIONS: readonly EarthMicroregion[] = [
  {
    id: 'earth-microregion-vuiteboeuf-sainte-croix',
    name: 'Vuiteboeuf · Covatannaz · Sainte-Croix',
    anchorLandmarkId: 'earth-ch-vuiteboeuf',
    sourceProjects: ['KUEPER-Werkverbund', 'NOXIA'],
    nodes: [
      {
        id: 'vuiteboeuf',
        name: 'Vuiteboeuf',
        kind: 'arrival',
        locality: 'Jura-Nord vaudois, Waadt',
        locator: 'Vuiteboeuf, Vaud, Switzerland',
        role: 'Talort und primärer Arrival Node der Mikroregion.',
      },
      {
        id: 'covatannaz',
        name: 'Covatannaz',
        kind: 'passage',
        locality: 'zwischen Vuiteboeuf und Sainte-Croix',
        locator: 'Gorges de Covatannaz, Vaud, Switzerland',
        role: 'Landschafts- und Passage-Knoten des Aufstiegs; kein Settlement.',
      },
      {
        id: 'sainte-croix',
        name: 'Sainte-Croix',
        kind: 'settlement',
        locality: 'Jura-Nord vaudois, Waadt',
        locator: 'Sainte-Croix, Vaud, Switzerland',
        role: 'Hochort der Mikroregion und Gegenpol zum Talort Vuiteboeuf.',
      },
    ],
    links: [
      {
        from: 'vuiteboeuf',
        to: 'covatannaz',
        relation: 'landscape-transition',
        note: 'Tal → Jura-Aufstieg; die konkrete Routing-Geometrie bleibt Earth/World-owned.',
      },
      {
        from: 'covatannaz',
        to: 'sainte-croix',
        relation: 'landscape-transition',
        note: 'Schlucht-/Passagebereich → Hochort.',
      },
      {
        from: 'vuiteboeuf',
        to: 'sainte-croix',
        relation: 'rail',
        note: 'Verkehrsrelation als Mikroregionsstruktur; keine simulierte Fahrzeit wird hier kanonisiert.',
      },
    ],
  },
] as const

export function getEarthMicroregion(id: string): EarthMicroregion | undefined {
  return EARTH_MICROREGIONS.find(region => region.id === id)
}

export function getEarthMicroregionByLandmark(anchorLandmarkId: string): EarthMicroregion | undefined {
  return EARTH_MICROREGIONS.find(region => region.anchorLandmarkId === anchorLandmarkId)
}
