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
    id: 'earth-microregion-frankfurt-book-world',
    name: 'Frankfurt · Buchwelt',
    anchorLandmarkId: 'earth-de-frankfurt-senckenberg',
    sourceProjects: ['YIN HUA / Senckenberg-Zyklus', 'NALGAE – Zwischen den Welten', 'KUEPER-Werkverbund', 'NOXIA'],
    nodes: [
      {
        id: 'frankfurt-hbf',
        name: 'Frankfurt (Main) Hauptbahnhof',
        kind: 'arrival',
        locality: 'Frankfurt am Main',
        locator: 'Frankfurt (Main) Hauptbahnhof, Im Hauptbahnhof, 60329 Frankfurt am Main, Germany',
        role: 'Neutraler überregionaler Arrival Node; verbindet die Buchwelt-Orte, ohne selbst zum literarischen Hauptschauplatz zu werden.',
      },
      {
        id: 'senckenberg',
        name: 'Senckenberg',
        kind: 'research',
        locality: 'Frankfurt am Main',
        locator: 'Senckenberganlage 25, 60325 Frankfurt am Main, Germany',
        role: 'Wissenschafts-, Archiv- und YIN-HUA-Knoten der Mikroregion.',
      },
      {
        id: 'camaleo-artlounge',
        name: 'Camaleo Artlounge',
        kind: 'culture',
        locality: 'Frankfurt am Main',
        locator: 'Frankfurt am Main, Germany',
        role: 'Kultureller Begegnungs- und Werkverbund-Knoten; die Straßenadresse bleibt bis zur kanonischen Auflösung bewusst offen.',
      },
      {
        id: 'sachsenhausen',
        name: 'Sachsenhausen',
        kind: 'settlement',
        locality: 'Frankfurt am Main',
        locator: 'Sachsenhausen, Frankfurt am Main, Germany',
        role: 'NALGAE-Wohn- und Alltagsraum; die fiktionale WG erhält bewusst keine erfundene Straßenadresse.',
      },
      {
        id: 'staedel',
        name: 'Städel Museum',
        kind: 'culture',
        locality: 'Frankfurt am Main',
        locator: 'Schaumainkai 63, 60596 Frankfurt am Main, Germany',
        role: 'Realer Kunst- und Sammlungsknoten des NALGAE-Strangs.',
      },
      {
        id: 'bornheim',
        name: 'Bornheim',
        kind: 'settlement',
        locality: 'Frankfurt am Main',
        locator: 'Bornheim, Frankfurt am Main, Germany',
        role: 'YIN-HUA-Wohnraum; konkrete private Wohnadresse bleibt fiktional und wird nicht georeferenziert.',
      },
      {
        id: 'paulskirche',
        name: 'Paulskirche',
        kind: 'culture',
        locality: 'Frankfurt am Main',
        locator: 'Paulsplatz 11, 60311 Frankfurt am Main, Germany',
        role: 'Realer Erinnerungsort und kanonischer Endpunkt des YIN-HUA-Schlüsselbogens; Schlüsselreaktionen bleiben Fiction Canon.',
      },
      {
        id: 'roemerberg',
        name: 'Römerberg',
        kind: 'culture',
        locality: 'Frankfurt am Main',
        locator: 'Römerberg, 60311 Frankfurt am Main, Germany',
        role: 'Historischer Stadtraum und Nachszene des Paulskirchen-Kapitels.',
      },
      {
        id: 'schwanheimer-duene',
        name: 'Schwanheimer Düne',
        kind: 'landscape',
        locality: 'Frankfurt am Main',
        locator: 'Schwanheimer Düne, Frankfurt am Main, Germany',
        role: 'Stadtnahe Landschaft und kanonischer NALGAE-Schauplatz.',
      },
    ],
    links: [
      { from: 'frankfurt-hbf', to: 'senckenberg', relation: 'rail', note: 'Semantische ÖPNV-/Stadtverbindung; kein Fahrplan wird hier kanonisiert.' },
      { from: 'frankfurt-hbf', to: 'camaleo-artlounge', relation: 'road', note: 'Städtische Erreichbarkeit; konkrete Route bleibt Earth/World-owned.' },
      { from: 'senckenberg', to: 'camaleo-artlounge', relation: 'road', note: 'Narrative Stadtbeziehung zwischen Wissenschafts- und Kulturknoten.' },
      { from: 'frankfurt-hbf', to: 'sachsenhausen', relation: 'rail', note: 'Semantische innerstädtische Verbindung; konkrete Linie und Fahrzeit bleiben Earth/World-owned.' },
      { from: 'sachsenhausen', to: 'staedel', relation: 'road', note: 'NALGAE-Alltagsraum → realer Kunstknoten.' },
      { from: 'senckenberg', to: 'bornheim', relation: 'road', note: 'YIN-HUA-Beziehung zwischen Archiv-/Forschungsknoten und privatem Stadtteilkontext.' },
      { from: 'senckenberg', to: 'paulskirche', relation: 'road', note: 'Narrative Beziehung des YIN-HUA-Ortsbogens; keine Schlüsselwirkung als reale Eigenschaft.' },
      { from: 'paulskirche', to: 'roemerberg', relation: 'road', note: 'Unmittelbare narrative Stadtraumbeziehung.' },
      { from: 'sachsenhausen', to: 'schwanheimer-duene', relation: 'road', note: 'NALGAE-Beziehung zwischen Wohnraum und städtischem Landschaftsknoten; Route bleibt nicht-kanonisch.' },
    ],
  },
  {
    id: 'earth-microregion-sauerland-hexenteich',
    name: 'Sauerland · Hexenteich-Ortsnetz',
    anchorLandmarkId: 'earth-de-menden-hexenteich',
    sourceProjects: ['Die Kette vom Hexenteich', 'NOXIA'],
    nodes: [
      {
        id: 'hexenteich',
        name: 'Hexenteich',
        kind: 'landscape',
        locality: 'Menden (Sauerland)',
        locator: 'Oesberner Weg, 58706 Menden, Germany',
        role: 'Realer Landschaftsanker und Ausgangspunkt des Roman-Ortsnetzes; Kette, Visionen und Kondenskreis sind Fiction Canon.',
      },
      {
        id: 'felsenmeer-hemer',
        name: 'Felsenmeer Hemer',
        kind: 'landscape',
        locality: 'Hemer',
        locator: 'Deilinghofer Straße 71, 58675 Hemer, Germany',
        role: 'Realer Geologie- und Bergbaugeschichtsknoten; seine Rolle im Sieben-Orte-System ist fiktional.',
      },
      {
        id: 'reckenhoehle',
        name: 'Reckenhöhle',
        kind: 'research',
        locality: 'Balve',
        locator: 'Binolen 1, 58802 Balve, Germany',
        role: 'Realer Karst-/Höhlenknoten; Hör-Stein und Resonanzfunktion sind Fiction Canon.',
      },
      {
        id: 'ebberg',
        name: 'Aussichtsturm Ebberg',
        kind: 'landscape',
        locality: 'Balve-Eisborn',
        locator: 'Zum Ebberg, 58802 Balve, Germany',
        role: 'Realer Sicht- und Orientierungsknoten sowie Roman-Treffpunkt.',
      },
      {
        id: 'bilsteinhoehle',
        name: 'Bilsteinhöhle',
        kind: 'research',
        locality: 'Warstein',
        locator: 'Im Bodmen 54, 59581 Warstein, Germany',
        role: 'Realer Höhlen-/Archäologieknoten; Antons Eingriffe und Resonanzfunktion bleiben fiktional.',
      },
    ],
    links: [
      { from: 'hexenteich', to: 'felsenmeer-hemer', relation: 'road', note: 'Roman-Ortsbeziehung; konkrete Fahrroute und Fahrzeit bleiben Earth/World-owned.' },
      { from: 'hexenteich', to: 'reckenhoehle', relation: 'road', note: 'Roman-Ortsbeziehung zwischen Menden und Hönnetal.' },
      { from: 'reckenhoehle', to: 'ebberg', relation: 'landscape-transition', note: 'Balver Höhlen-/Landschaftsraum; keine behauptete physische Direktverbindung.' },
      { from: 'reckenhoehle', to: 'bilsteinhoehle', relation: 'road', note: 'Vergleichende Höhlen-/Romanbeziehung; keine reale Resonanzverbindung.' },
    ],
  },
  {
    id: 'earth-microregion-malta-hypogeum',
    name: 'Malta · Paola / Valletta',
    anchorLandmarkId: 'earth-mt-hal-saflieni',
    sourceProjects: ['KUEPER-Resonanzwelt', 'NOXIA'],
    nodes: [
      {
        id: 'paola',
        name: 'Paola / Raħal Ġdid',
        kind: 'arrival',
        locality: 'Malta',
        locator: 'Paola, Malta',
        role: 'Lokaler Arrival- und Siedlungsknoten für den Hypogeum-Slice.',
      },
      {
        id: 'hal-saflieni',
        name: 'Ħal Saflieni Hypogeum',
        kind: 'research',
        locality: 'Paola, Malta',
        locator: 'Triq iċ-Ċimiterju, Paola, Malta',
        role: 'Archäologie-, Konservierungs- und Resonanzknoten; reale Stätte und fiktionale Interpretation bleiben getrennt.',
      },
      {
        id: 'national-museum-archaeology',
        name: 'National Museum of Archaeology',
        kind: 'research',
        locality: 'Valletta, Malta',
        locator: 'Auberge de Provence, Republic Street, Valletta, Malta',
        role: 'Sammlungs- und Provenienzknoten für Artefakte aus Maltas Vor- und Frühgeschichte.',
      },
    ],
    links: [
      { from: 'paola', to: 'hal-saflieni', relation: 'road', note: 'Lokale Erreichbarkeit innerhalb Paolas; operative Route bleibt Earth/World-owned.' },
      { from: 'paola', to: 'national-museum-archaeology', relation: 'road', note: 'Paola–Valletta als semantische regionale Verbindung; keine Fahrzeit wird kanonisiert.' },
      { from: 'hal-saflieni', to: 'national-museum-archaeology', relation: 'road', note: 'Archäologische Provenienzbeziehung zwischen Fundort und Sammlung, nicht nur Verkehrsrelation.' },
    ],
  },
  {
    id: 'earth-microregion-dwarka-coast',
    name: 'Dwarka · Küste / Unterwasserarchäologie',
    anchorLandmarkId: 'earth-in-dwarka',
    sourceProjects: ['Dvārakā / Baumeister-Zyklus', 'NOXIA'],
    nodes: [
      {
        id: 'dwarka',
        name: 'Dwarka',
        kind: 'arrival',
        locality: 'Dwarka, Gujarat',
        locator: 'Dwarka, Gujarat, India',
        role: 'Heutiger Küstenort und Arrival Node. Der moderne Ort wird nicht mit dem literarischen Dvārakā gleichgesetzt.',
      },
      {
        id: 'dwarka-offshore-archaeology',
        name: 'Dwarka Offshore Archaeology',
        kind: 'research',
        locality: 'Arabian Sea off Dwarka, Gujarat',
        locator: 'Dwarka coast, Gujarat, India',
        role: 'Evidenzknoten für dokumentierte marine archäologische Untersuchungen, Steinstrukturen und Anker; keine pauschale Identifikation mit dem Romanort.',
      },
      {
        id: 'bet-dwarka',
        name: 'Bet Dwarka',
        kind: 'research',
        locality: 'Okhamandal, Gujarat',
        locator: 'Bet Dwarka, Gujarat, India',
        role: 'Separater Küsten-/Inselknoten mit eigener archäologischer Sequenz und maritimer Nutzung; dient dem Vergleich statt einer Verschmelzung mit Dwarka.',
      },
    ],
    links: [
      { from: 'dwarka', to: 'dwarka-offshore-archaeology', relation: 'landscape-transition', note: 'Land–Meer-Evidenzrelation; operative Tauch-/Bootsroute bleibt außerhalb der Mikroregion.' },
      { from: 'dwarka', to: 'bet-dwarka', relation: 'road', note: 'Regionale Okhamandal-Beziehung; konkrete multimodale Route und Fahrzeit bleiben Earth/World-owned.' },
      { from: 'bet-dwarka', to: 'dwarka-offshore-archaeology', relation: 'landscape-transition', note: 'Vergleichende marine Archäologie; Befunde beider Orte bleiben provenienzseitig getrennt.' },
    ],
  },
  {
    id: 'earth-microregion-crete-phaistos',
    name: 'Kreta · Heraklion / Phaistos',
    anchorLandmarkId: 'earth-gr-phaistos',
    sourceProjects: ['MISHKENAZ', 'KUEPER-Werkverbund', 'NOXIA'],
    nodes: [
      {
        id: 'heraklion',
        name: 'Heraklion',
        kind: 'arrival',
        locality: 'Heraklion, Crete',
        locator: 'Heraklion, Crete, Greece',
        role: 'Primärer Arrival Node der Mikroregion und urbaner Übergang zur Messara-/Phaistos-Landschaft.',
      },
      {
        id: 'heraklion-archaeological-museum',
        name: 'Heraklion Archaeological Museum',
        kind: 'research',
        locality: 'Heraklion, Crete',
        locator: 'Xanthoudidou & Hatzidaki 1, 712 02 Heraklion, Crete, Greece',
        role: 'Sammlungs-, Provenienz- und Forschungsknoten; reale museale Überlieferung der Phaistos-Scheibe bleibt von MISHKENAZ-Deutungen getrennt.',
      },
      {
        id: 'phaistos',
        name: 'Phaistos',
        kind: 'research',
        locality: 'Heraklion regional unit, Crete',
        locator: 'Archaeological Site of Phaistos, Crete, Greece',
        role: 'Archäologischer Fund-/Landschaftsknoten und zentraler MISHKENAZ-Anker der Mikroregion.',
      },
    ],
    links: [
      { from: 'heraklion', to: 'heraklion-archaeological-museum', relation: 'road', note: 'Lokale Stadtbeziehung; operative Route bleibt Earth/World-owned.' },
      { from: 'heraklion', to: 'phaistos', relation: 'road', note: 'Regionale Arrival-Beziehung Richtung Phaistos; keine Fahrzeit wird hier kanonisiert.' },
      { from: 'phaistos', to: 'heraklion-archaeological-museum', relation: 'road', note: 'Zusätzlich semantische Fundort–Sammlung-/Provenienzbeziehung; nicht als reine Verkehrsrelation zu lesen.' },
    ],
  },
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
