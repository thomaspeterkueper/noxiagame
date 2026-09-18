export type EarthLandmarkTag =
  | 'canonical-foundation'
  | 'real-science'
  | 'spaceflight'
  | 'climate'
  | 'archaeology'
  | 'history-of-science'
  | 'cross-universe'

export type EarthLandmarkProjectRelation = 'setting' | 'reference' | 'research-anchor' | 'worldbuilding-anchor'

export type EarthLandmarkProjectLink = {
  project: string
  relation: EarthLandmarkProjectRelation
  note?: string
}

export type EarthLandmark = {
  id: string
  name: string
  countryCode: string
  locality: string
  locator: {
    kind: 'address'
    value: string
  }
  tags: EarthLandmarkTag[]
  presentDayRole: string
  noxiaRole: string
  sourceProjects: EarthLandmarkProjectLink[]
  externalUrl?: string
  externalLinkLabel?: string
}

/**
 * Canonical Earth landmarks are persistent real-world anchors, not normal buildable
 * player buildings. The registry deliberately keeps real institutional landmarks and
 * cross-universe literary anchors in one place while describing their relationship
 * to other KUEPER projects explicitly.
 *
 * Addresses/place labels are used as stable geocodable locators. Precise coordinates
 * can be resolved by the Earth map layer without baking guessed coordinates into canon.
 */
export const EARTH_LANDMARKS: readonly EarthLandmark[] = [
  {
    id: 'earth-de-sundern-ssf-hq',
    name: 'Solar Science Foundation · Hauptsitz',
    countryCode: 'DE',
    locality: 'Sundern (Sauerland)',
    locator: { kind: 'address', value: 'Bogenstraße 15, Sundern (Sauerland), Germany' },
    tags: ['canonical-foundation', 'real-science'],
    presentDayRole: 'Realer Ort, der im NOXIA-Kanon als Ausgangspunkt der Solar Science Foundation genutzt wird.',
    noxiaRole: 'Einzigartiger, nicht duplizierbarer Gründungs- und Hauptsitz der Solar Science Foundation auf der Erde.',
    sourceProjects: [
      { project: 'NOXIA', relation: 'setting', note: 'Kanonischer SSF-Hauptsitz.' },
      { project: 'Solar Science Foundation', relation: 'setting', note: 'Physischer Referenzort der Stiftung.' },
    ],
    externalUrl: 'https://solarsciencefoundation.vercel.app/',
    externalLinkLabel: 'Offizielle SSF-Website öffnen',
  },
  {
    id: 'earth-de-darmstadt-esoc',
    name: 'ESA · European Space Operations Centre (ESOC)',
    countryCode: 'DE',
    locality: 'Darmstadt',
    locator: { kind: 'address', value: 'Robert-Bosch-Straße 5, 64293 Darmstadt, Germany' },
    tags: ['real-science', 'spaceflight'],
    presentDayRole: 'Europäisches Missionskontrollzentrum der ESA.',
    noxiaRole: 'Historischer und operativer Anker für europäische Missionskontrolle, Deep-Space-Kommunikation und Flugbahnbetrieb.',
    sourceProjects: [{ project: 'NOXIA', relation: 'worldbuilding-anchor' }],
    externalUrl: 'https://www.esa.int/About_Us/ESOC',
    externalLinkLabel: 'ESA/ESOC außerhalb von NOXIA öffnen',
  },
  {
    id: 'earth-de-darmstadt-eumetsat',
    name: 'EUMETSAT · Hauptsitz',
    countryCode: 'DE',
    locality: 'Darmstadt',
    locator: { kind: 'address', value: 'Eumetsat-Allee 1, 64295 Darmstadt, Germany' },
    tags: ['real-science', 'spaceflight', 'climate'],
    presentDayRole: 'Europäische Organisation für den Betrieb meteorologischer Satelliten.',
    noxiaRole: 'Anker für Erdbeobachtung, Wetter- und Klimasysteme sowie die historische Entwicklung orbitaler Umweltbeobachtung.',
    sourceProjects: [{ project: 'NOXIA', relation: 'worldbuilding-anchor' }],
    externalUrl: 'https://www.eumetsat.int/',
    externalLinkLabel: 'EUMETSAT außerhalb von NOXIA öffnen',
  },
  {
    id: 'earth-de-cologne-eac',
    name: 'ESA · European Astronaut Centre (EAC)',
    countryCode: 'DE',
    locality: 'Köln',
    locator: { kind: 'address', value: 'Linder Höhe, 51147 Köln, Germany' },
    tags: ['real-science', 'spaceflight'],
    presentDayRole: 'Europäisches Zentrum für Astronautentraining und astronautische Betriebsunterstützung.',
    noxiaRole: 'Historischer Ausbildungsknoten für bemannte Raumfahrt und Vorläufer späterer NOXIA-Trainings- und Missionssysteme.',
    sourceProjects: [{ project: 'NOXIA', relation: 'worldbuilding-anchor' }],
    externalUrl: 'https://www.esa.int/About_Us/EAC',
    externalLinkLabel: 'ESA/EAC außerhalb von NOXIA öffnen',
  },
  {
    id: 'earth-de-oberpfaffenhofen-dlr',
    name: 'DLR · Oberpfaffenhofen',
    countryCode: 'DE',
    locality: 'Weßling / Oberpfaffenhofen',
    locator: { kind: 'address', value: 'Münchener Straße 20, 82234 Weßling, Germany' },
    tags: ['real-science', 'spaceflight', 'climate'],
    presentDayRole: 'DLR-Forschungsstandort für Raumfahrtbetrieb, Erdbeobachtung, Navigation, Kommunikation und Robotik.',
    noxiaRole: 'Europäischer Übergangsknoten von heutiger Missionskontrolle zu späterem cislunarem und interplanetarem Betrieb.',
    sourceProjects: [{ project: 'NOXIA', relation: 'worldbuilding-anchor' }],
    externalUrl: 'https://www.dlr.de/de/das-dlr/standorte-und-bueros/oberpfaffenhofen',
    externalLinkLabel: 'DLR Oberpfaffenhofen außerhalb von NOXIA öffnen',
  },
  {
    id: 'earth-in-dwarka',
    name: 'Dvārakā / Dwarka',
    countryCode: 'IN',
    locality: 'Dwarka, Gujarat',
    locator: { kind: 'address', value: 'Dwarka, Gujarat, India' },
    tags: ['archaeology', 'cross-universe'],
    presentDayRole: 'Historischer und archäologischer Küstenort mit besonderer Bedeutung für die Erforschung langfristiger Siedlungs- und Küstenentwicklung.',
    noxiaRole: 'Cross-Universe-Landmark für Unterwasserarchäologie, Küstenwandel, Materialwissen und die Langzeitgeschichte menschlicher Wissenssysteme.',
    sourceProjects: [
      { project: 'Dvārakā / Baumeister-Zyklus', relation: 'setting', note: 'Zentraler Schauplatz und Weltbau-Anker.' },
      { project: 'NOXIA', relation: 'research-anchor', note: 'Archäologie, Küstenwandel und historische Technologie.' },
    ],
  },
  {
    id: 'earth-gr-phaistos',
    name: 'Phaistos',
    countryCode: 'GR',
    locality: 'Kreta',
    locator: { kind: 'address', value: 'Phaistos Archaeological Site, Crete, Greece' },
    tags: ['archaeology', 'history-of-science', 'cross-universe'],
    presentDayRole: 'Archäologischer Fundort der minoischen Kultur und Referenzort der Phaistos-Scheibe.',
    noxiaRole: 'Cross-Universe-Anker für Schrift, Informationsarchäologie, materielle Wissensspeicherung und ungelöste Zeichensysteme.',
    sourceProjects: [
      { project: 'Dvārakā / Baumeister-Zyklus', relation: 'reference', note: 'Artefakt- und Erkenntnisreferenz.' },
      { project: 'NOXIA', relation: 'research-anchor', note: 'Schrift, Zeichen und Wissensüberlieferung.' },
    ],
  },
  {
    id: 'earth-eg-alexandria',
    name: 'Alexandria',
    countryCode: 'EG',
    locality: 'Alexandria',
    locator: { kind: 'address', value: 'Alexandria, Egypt' },
    tags: ['history-of-science', 'cross-universe'],
    presentDayRole: 'Historischer Wissenschafts- und Wissensort mit besonderer Bedeutung für antike Astronomie, Mathematik und Zeitordnung.',
    noxiaRole: 'Cross-Universe-Anker für Kalender, Zeitmessung, Wissensorganisation und die langfristige Entwicklung wissenschaftlicher Standards.',
    sourceProjects: [
      { project: 'Alexandria / Kalender-Roman', relation: 'setting', note: 'Schauplatz der Auseinandersetzung um Kalender- und Zeitordnung.' },
      { project: 'NOXIA', relation: 'research-anchor', note: 'Zeitmessung, biologische Rhythmen und Standardisierung.' },
    ],
  },
] as const

export function getEarthLandmark(id: string): EarthLandmark | undefined {
  return EARTH_LANDMARKS.find(landmark => landmark.id === id)
}

export function getEarthLandmarksByTag(tag: EarthLandmarkTag): EarthLandmark[] {
  return EARTH_LANDMARKS.filter(landmark => landmark.tags.includes(tag))
}

export function getCrossUniverseEarthLandmarks(): EarthLandmark[] {
  return getEarthLandmarksByTag('cross-universe')
}
