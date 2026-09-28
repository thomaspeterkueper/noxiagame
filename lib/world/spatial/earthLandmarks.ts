export type EarthLandmarkTag =
  | 'canonical-foundation'
  | 'real-science'
  | 'spaceflight'
  | 'climate'
  | 'archaeology'
  | 'history-of-science'
  | 'culture'
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
    id: 'earth-de-frankfurt-senckenberg',
    name: 'Senckenberg · Forschungsinstitut und Naturmuseum',
    countryCode: 'DE',
    locality: 'Frankfurt am Main',
    locator: { kind: 'address', value: 'Senckenberganlage 25, 60325 Frankfurt am Main, Germany' },
    tags: ['real-science', 'history-of-science', 'cross-universe'],
    presentDayRole: 'Naturforschungs- und Sammlungsstandort in Frankfurt; die Senckenberg Gesellschaft unterhält dort Forschungsinstitut und Naturmuseum.',
    noxiaRole: 'Frankfurter Wissensanker für Naturarchive, Sammlungsprovenienz und die langfristige Entwicklung wissenschaftlicher Archive.',
    sourceProjects: [
      { project: 'YIN HUA / Senckenberg-Zyklus', relation: 'setting', note: 'Zentraler Frankfurter Schauplatz; fiktionale Handlung und reale Institution bleiben getrennte Ebenen.' },
      { project: 'NOXIA', relation: 'research-anchor', note: 'Naturarchive, Sammlungen und Wissenschaftsgeschichte.' },
    ],
    externalUrl: 'https://www.senckenberg.de/',
    externalLinkLabel: 'Senckenberg außerhalb von NOXIA öffnen',
  },
  {
    id: 'earth-de-frankfurt-camaleo-artlounge',
    name: 'Camaleo Artlounge',
    countryCode: 'DE',
    locality: 'Frankfurt am Main',
    locator: { kind: 'address', value: 'Frankfurt am Main, Germany' },
    tags: ['culture', 'cross-universe'],
    presentDayRole: 'Kanonischer Frankfurter Kulturort des KUEPER-Werkverbunds. Eine belastbare öffentliche Straßenadresse ist derzeit nicht hinterlegt; deshalb bleibt der Locator bewusst auf Stadtebene.',
    noxiaRole: 'Kleiner kultureller Begegnungsort im Frankfurter NOXIA-Slice: Ausstellungen, Künstler-NPCs, Gespräche und Werkverbindungen statt generischer Sehenswürdigkeiten.',
    sourceProjects: [
      { project: 'KUEPER-Werkverbund', relation: 'setting', note: 'Literarischer/kultureller Frankfurt-Anker; keine unbelegte reale Institutionsgeschichte wird behauptet.' },
      { project: 'NOXIA', relation: 'worldbuilding-anchor', note: 'Kultur, soziale Begegnung und Cross-Universe-Lore.' },
    ],
  },
  {
    id: 'earth-mt-hal-saflieni',
    name: 'Ħal Saflieni Hypogeum',
    countryCode: 'MT',
    locality: 'Paola, Malta',
    locator: { kind: 'address', value: 'Ħal Saflieni Hypogeum, Paola, Malta' },
    tags: ['archaeology', 'cross-universe'],
    presentDayRole: 'Prähistorischer unterirdischer Kult- und Bestattungsort auf Malta; als reale archäologische Stätte getrennt von fiktionalen Deutungen geführt.',
    noxiaRole: 'Malta-Anker für unterirdische Räume, Archäoakustik, Materialgedächtnis und langfristige Konservierung.',
    sourceProjects: [
      { project: 'KUEPER-Resonanzwelt', relation: 'setting', note: 'Malta-Schauplatz und Resonanz-/Archäoakustik-Anker.' },
      { project: 'NOXIA', relation: 'research-anchor', note: 'Archäologie, Akustik und Konservierung.' },
    ],
    externalUrl: 'https://heritagemalta.mt/explore/hal-saflieni-hypogeum/',
    externalLinkLabel: 'Heritage Malta außerhalb von NOXIA öffnen',
  },
  {
    id: 'earth-tr-istanbul-bosphorus',
    name: 'Istanbul · Bosporus',
    countryCode: 'TR',
    locality: 'Istanbul',
    locator: { kind: 'address', value: 'Istanbul, Türkiye' },
    tags: ['history-of-science', 'culture', 'cross-universe'],
    presentDayRole: 'Metropole am Bosporus und historischer Übergangsraum zwischen Schwarzem Meer und Mittelmeer.',
    noxiaRole: 'Kompakter urbaner Buchwelt-Knoten für Verkehr, kulturelle Schichten, Archive und transkontinentale Verbindungen.',
    sourceProjects: [
      { project: 'KUEPER-Werkverbund', relation: 'setting', note: 'Istanbul-Schauplatz; konkrete POIs können später unterhalb dieses Stadtknotens ergänzt werden.' },
      { project: 'NOXIA', relation: 'worldbuilding-anchor', note: 'Urbanität, Transit und historische Schichten.' },
    ],
  },
  {
    id: 'earth-ch-vuiteboeuf',
    name: 'Vuiteboeuf',
    countryCode: 'CH',
    locality: 'Jura-Nord vaudois, Waadt',
    locator: { kind: 'address', value: 'Vuiteboeuf, Vaud, Switzerland' },
    tags: ['culture', 'cross-universe'],
    presentDayRole: 'Gemeinde im waadtländischen Jura-Nord vaudois unterhalb von Sainte-Croix; Ausgangspunkt historischer Jura-Querungen und der Covatannaz-Landschaft.',
    noxiaRole: 'Kleiner ländlicher Book-World-Knoten unterhalb von Sainte-Croix für Landschaft, lokale Geschichte, Figuren- und Werkspuren sowie die Verbindung hinauf ins Jura-Hochland.',
    sourceProjects: [
      { project: 'KUEPER-Werkverbund', relation: 'setting', note: 'Kanonischer Schweizer-Jura-Schauplatz: Vuiteboeuf unterhalb von Sainte-Croix.' },
      { project: 'NOXIA', relation: 'worldbuilding-anchor', note: 'Ländliche Earth-Geographie und Cross-Universe-Lore.' },
    ],
  },
  {
    id: 'earth-de-north-sea-book-village',
    name: 'Nordsee · Buchweltdorf',
    countryCode: 'DE',
    locality: 'Deutsche Nordseeküste',
    locator: { kind: 'address', value: 'German North Sea coast, Germany' },
    tags: ['culture', 'cross-universe'],
    presentDayRole: 'Platzhalter für das kanonische Nordsee-Dorf des Werkverbunds; keine erfundene reale Gemeinde oder Straßenadresse wird daraus abgeleitet.',
    noxiaRole: 'Kleiner Küstenort für Deich-, Hafen-, Wetter- und Alltagsgeschichte; absichtlich kein urbaner Vollausbau.',
    sourceProjects: [
      { project: 'KUEPER-Werkverbund', relation: 'setting', note: 'Nordsee-Dorf; Name und präziser Locator bleiben bis zur Kanonauflösung offen.' },
      { project: 'NOXIA', relation: 'worldbuilding-anchor', note: 'Küstenleben, Klima und lokale Infrastruktur.' },
    ],
  },
  {
    id: 'earth-pe-chavin-de-huantar',
    name: 'Chavín de Huántar',
    countryCode: 'PE',
    locality: 'Áncash, Peru',
    locator: { kind: 'address', value: 'Chavín Archaeological Site, Chavín de Huántar, Áncash, Peru' },
    tags: ['archaeology', 'cross-universe'],
    presentDayRole: 'Archäologischer Hochanden-Ort und namengebender Fundplatz der Chavín-Kultur.',
    noxiaRole: 'Anden-Anker für monumentale Architektur, interne Galerien, Wasserführung, Ritualräume und langfristige Wissensüberlieferung.',
    sourceProjects: [
      { project: 'KUEPER-Werkverbund', relation: 'reference', note: 'Peruanischer Anden-/Archäologie-Anker.' },
      { project: 'NOXIA', relation: 'research-anchor', note: 'Hochgebirgsarchäologie, Bauwissen und Wissenssysteme.' },
    ],
    externalUrl: 'https://whc.unesco.org/en/list/330',
    externalLinkLabel: 'UNESCO außerhalb von NOXIA öffnen',
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
    id: 'earth-kr-seoul',
    name: 'Seoul',
    countryCode: 'KR',
    locality: 'Seoul',
    locator: { kind: 'address', value: 'Seoul, South Korea' },
    tags: ['culture', 'cross-universe'],
    presentDayRole: 'Großstadt und kultureller, wirtschaftlicher und infrastruktureller Knoten in Südkorea.',
    noxiaRole: 'Cross-Universe-Anker für urbane Mobilität, Kulturkontakte, Herkunftsbiografien und langfristige Stadtentwicklung.',
    sourceProjects: [
      { project: 'NALGAE – Zwischen den Welten', relation: 'setting', note: 'Hanas Herkunftsort und Gegenpol zu Frankfurt.' },
      { project: 'NOXIA', relation: 'worldbuilding-anchor', note: 'Urbane Kultur-, Mobilitäts- und Biografievergleiche.' },
    ],
  },
  {
    id: 'earth-de-frankfurt-sachsenhausen',
    name: 'Frankfurt · Sachsenhausen',
    countryCode: 'DE',
    locality: 'Frankfurt am Main',
    locator: { kind: 'address', value: 'Sachsenhausen, Frankfurt am Main, Germany' },
    tags: ['culture', 'cross-universe'],
    presentDayRole: 'Frankfurter Stadtteil südlich des Mains mit Wohn-, Kultur- und Ausgehfunktionen.',
    noxiaRole: 'Cross-Universe-Wohn- und Alltagsanker für Figurenbiografien, Nachbarschaft und urbane Mikroräume.',
    sourceProjects: [
      { project: 'NALGAE – Zwischen den Welten', relation: 'setting', note: 'Frankfurter WG-/Alltagsraum von Hana.' },
      { project: 'NOXIA', relation: 'worldbuilding-anchor', note: 'Wohnquartiere und urbane Alltagsräume.' },
    ],
  },
  {
    id: 'earth-de-frankfurt-staedel',
    name: 'Städel Museum',
    countryCode: 'DE',
    locality: 'Frankfurt am Main',
    locator: { kind: 'address', value: 'Schaumainkai 63, 60596 Frankfurt am Main, Germany' },
    tags: ['culture', 'cross-universe'],
    presentDayRole: 'Kunstmuseum am Frankfurter Museumsufer.',
    noxiaRole: 'Cross-Universe-Kulturanker für Kunst, Sammlungen, Rezeption und Figurenbegegnungen.',
    sourceProjects: [
      { project: 'NALGAE – Zwischen den Welten', relation: 'setting', note: 'Städel-/Margarethe-Strang.' },
      { project: 'NOXIA', relation: 'research-anchor', note: 'Kunstsammlungen und kulturelle Überlieferung.' },
    ],
    externalUrl: 'https://www.staedelmuseum.de/',
    externalLinkLabel: 'Städel außerhalb von NOXIA öffnen',
  },
  {
    id: 'earth-de-hamburg-altona',
    name: 'Hamburg · Altona',
    countryCode: 'DE',
    locality: 'Hamburg',
    locator: { kind: 'address', value: 'Altona, Hamburg, Germany' },
    tags: ['culture', 'cross-universe'],
    presentDayRole: 'Hamburger Stadtbezirk und historischer Hafen-/Bahn-/Wohnraum an der Elbe.',
    noxiaRole: 'Cross-Universe-Anker für Wohnen, Musik, Handwerk, Hafenbeziehungen und urbane Biografien.',
    sourceProjects: [
      { project: 'TRAILERS', relation: 'setting', note: 'WG- und Lebensraum von Ray, Cat und Pete.' },
      { project: 'OTJIZE', relation: 'setting', note: 'Hamburg als späterer Chemie-/Lebensort; Altona dient als erster Stadtanker, nicht als behauptete konkrete Wohnadresse.' },
      { project: 'NOXIA', relation: 'worldbuilding-anchor', note: 'Hafenstadt, Wohnen, Musik und Handwerk.' },
    ],
  },
  {
    id: 'earth-de-menden-hexenteich',
    name: 'Menden · Hexenteich',
    countryCode: 'DE',
    locality: 'Menden (Sauerland)',
    locator: { kind: 'address', value: 'Menden (Sauerland), Germany' },
    tags: ['culture', 'cross-universe'],
    presentDayRole: 'Kanonischer KUEPER-Ortsanker in Menden; bis zur belastbaren Georeferenz wird kein exakter Teich- oder Straßenpunkt behauptet.',
    noxiaRole: 'Cross-Universe-Landschafts- und Lokalgeschichtsanker für Fundorte, Erinnerung, Materialspuren und regionale Erzählungen.',
    sourceProjects: [
      { project: 'Die Kette vom Hexenteich', relation: 'setting', note: 'Schauplatz um Mia, Leon, Tim und Yara; exakte Georeferenz bleibt bewusst offen.' },
      { project: 'NOXIA', relation: 'worldbuilding-anchor', note: 'Lokale Landschaft, Fundorte und Erinnerungsschichten.' },
    ],
  },
  {
    id: 'earth-kr-seoul',
    name: 'Seoul',
    countryCode: 'KR',
    locality: 'Seoul',
    locator: { kind: 'address', value: 'Seoul, South Korea' },
    tags: ['culture', 'cross-universe'],
    presentDayRole: 'Südkoreanische Metropole und kultureller, wirtschaftlicher und technologischer Knoten.',
    noxiaRole: 'Cross-Universe-Anker für urbane Kultur, Migration, Kunst, Technologie und transnationale Biografien.',
    sourceProjects: [
      { project: 'NALGAE – Zwischen den Welten', relation: 'setting', note: 'Hanas Herkunfts- und Gegenpol zum Frankfurter Handlungsraum.' },
      { project: 'NOXIA', relation: 'worldbuilding-anchor', note: 'Ostasiatischer urbaner Kultur- und Technologieknoten.' },
    ],
  },
  {
    id: 'earth-de-frankfurt-sachsenhausen',
    name: 'Frankfurt · Sachsenhausen',
    countryCode: 'DE',
    locality: 'Frankfurt am Main',
    locator: { kind: 'address', value: 'Sachsenhausen, Frankfurt am Main, Germany' },
    tags: ['culture', 'cross-universe'],
    presentDayRole: 'Frankfurter Stadtteil südlich des Mains mit Wohn-, Kultur- und Museumsräumen.',
    noxiaRole: 'Cross-Universe-Anker für Alltag, Wohnen und kulturelle Begegnungen im Frankfurter Buchwelt-Cluster.',
    sourceProjects: [
      { project: 'NALGAE – Zwischen den Welten', relation: 'setting', note: 'Hanas WG- und Alltagsraum in Frankfurt.' },
      { project: 'NOXIA', relation: 'worldbuilding-anchor', note: 'Urbaner Wohn- und Kulturraum.' },
    ],
  },
  {
    id: 'earth-de-frankfurt-staedel',
    name: 'Städel Museum',
    countryCode: 'DE',
    locality: 'Frankfurt am Main',
    locator: { kind: 'address', value: 'Schaumainkai 63, 60596 Frankfurt am Main, Germany' },
    tags: ['culture', 'cross-universe'],
    presentDayRole: 'Kunstmuseum am Frankfurter Museumsufer.',
    noxiaRole: 'Cross-Universe-Anker für Kunstsammlungen, Bildkultur, Provenienz und kulturelle Begegnungen.',
    sourceProjects: [
      { project: 'NALGAE – Zwischen den Welten', relation: 'setting', note: 'Realer Kunstort im Frankfurter Handlungsraum.' },
      { project: 'NOXIA', relation: 'research-anchor', note: 'Kunst-, Sammlungs- und Provenienzkontext.' },
    ],
    externalUrl: 'https://www.staedelmuseum.de/',
    externalLinkLabel: 'Städel Museum',
  },
  {
    id: 'earth-de-hamburg-altona',
    name: 'Hamburg · Altona',
    countryCode: 'DE',
    locality: 'Hamburg',
    locator: { kind: 'address', value: 'Altona, Hamburg, Germany' },
    tags: ['culture', 'cross-universe'],
    presentDayRole: 'Westlicher Hamburger Stadtbezirk mit Hafen-, Wohn-, Verkehrs- und Kulturbezügen.',
    noxiaRole: 'Cross-Universe-Anker für urbane Jugendkultur, Wohnen, Arbeit, Migration und Hafenstadt-Biografien.',
    sourceProjects: [
      { project: 'TRAILERS', relation: 'setting', note: 'WG- und Lebensraum von Ray, Cat und Pete.' },
      { project: 'OTJIZE', relation: 'setting', note: 'Hamburg ist Zuvas späterer Studien- und Lebensraum.' },
      { project: 'NOXIA', relation: 'worldbuilding-anchor', note: 'Hafenstadt-, Arbeits- und Migrationskontext.' },
    ],
  },
  {
    id: 'earth-de-menden-hexenteich',
    name: 'Menden · Hexenteich',
    countryCode: 'DE',
    locality: 'Menden (Sauerland)',
    locator: { kind: 'address', value: 'Oesberner Weg, 58706 Menden, Germany' },
    tags: ['culture', 'cross-universe'],
    presentDayRole: 'Realer Teich- und Landschaftsort in Menden im Sauerland.',
    noxiaRole: 'Cross-Universe-Anker für lokale Landschaft, Alltagsgeschichte, materielle Funde und ortsgebundene Erzählungen.',
    sourceProjects: [
      { project: 'Die Kette vom Hexenteich', relation: 'setting', note: 'Realer Landschaftsanker des Romans; übernatürliche/visionäre Elemente bleiben Fiction Canon.' },
      { project: 'NOXIA', relation: 'worldbuilding-anchor', note: 'Sauerländer Mikrogeschichte und Landschaft.' },
    ],
  },
  {
    id: 'earth-eg-cairo',
    name: 'Kairo',
    countryCode: 'EG',
    locality: 'Cairo',
    locator: { kind: 'address', value: 'Cairo, Egypt' },
    tags: ['history-of-science', 'culture', 'cross-universe'],
    presentDayRole: 'Metropole am Nil mit vielschichtiger islamischer, wissenschaftlicher und handwerklicher Geschichte.',
    noxiaRole: 'Cross-Universe-Anker für Vermessung, Kartografie, Wissensüberlieferung und urbane Langzeitentwicklung.',
    sourceProjects: [
      { project: 'Bayt al-Mîrâ / al-Qiyās wa-l-Ṣabr', relation: 'setting', note: 'Herkunftsort des Kartografen und seiner Vermesser-Familienlinie.' },
      { project: 'NOXIA', relation: 'research-anchor', note: 'Kartografie, Vermessung und Wissensüberlieferung.' },
    ],
  },
  {
    id: 'earth-tn-carthage-tunis',
    name: 'Karthago / Tunis',
    countryCode: 'TN',
    locality: 'Tunis / Carthage',
    locator: { kind: 'address', value: 'Carthage, Tunis, Tunisia' },
    tags: ['archaeology', 'history-of-science', 'cross-universe'],
    presentDayRole: 'Archäologischer und urbaner Küstenraum am Golf von Tunis mit antiken und späteren historischen Schichten.',
    noxiaRole: 'Cross-Universe-Anker für Hafenräume, Schichtungen von Städten, Küstenvermessung und mediterrane Wissensnetze.',
    sourceProjects: [
      { project: 'Bayt al-Mîrâ / al-Qiyās wa-l-Ṣabr', relation: 'setting', note: 'Station I des Kartografen-Romans.' },
      { project: 'NOXIA', relation: 'research-anchor', note: 'Hafen-, Küsten- und Siedlungsgeschichte.' },
    ],
  },
  {
    id: 'earth-ly-cyrene',
    name: 'Kyrene / Cyrene',
    countryCode: 'LY',
    locality: 'Shahhat, Libya',
    locator: { kind: 'address', value: 'Archaeological Site of Cyrene, Shahhat, Libya' },
    tags: ['archaeology', 'cross-universe'],
    presentDayRole: 'Archäologischer Ruinenort der antiken Kyrenaika nahe dem heutigen Shahhat.',
    noxiaRole: 'Cross-Universe-Anker für Ruinenlandschaften, historische Routen, Vermessung und fragmentarische Überlieferung.',
    sourceProjects: [
      { project: 'Bayt al-Mîrâ / al-Qiyās wa-l-Ṣabr', relation: 'setting', note: 'Ruinen- und Händlerstation des Kartografen.' },
      { project: 'NOXIA', relation: 'research-anchor', note: 'Archäologie, Routenwissen und Landschaftsrekonstruktion.' },
    ],
  },
  {
    id: 'earth-it-pantelleria',
    name: 'Pantelleria',
    countryCode: 'IT',
    locality: 'Pantelleria, Sicily',
    locator: { kind: 'address', value: 'Pantelleria, Province of Trapani, Italy' },
    tags: ['culture', 'cross-universe'],
    presentDayRole: 'Vulkanische Mittelmeerinsel zwischen Sizilien und Nordafrika mit langer maritimer Nutzung.',
    noxiaRole: 'Cross-Universe-Anker für Inselnavigation, Zwischenstationen, Wasser-/Versorgungsfragen und maritime Routen.',
    sourceProjects: [
      { project: 'Bayt al-Mîrâ / al-Qiyās wa-l-Ṣabr', relation: 'setting', note: 'Teil des Malta/Pantelleria-Kreuzungspunktes.' },
      { project: 'NOXIA', relation: 'worldbuilding-anchor', note: 'Inselversorgung und maritime Navigation.' },
    ],
  },
  {
    id: 'earth-es-cadiz',
    name: 'Cádiz',
    countryCode: 'ES',
    locality: 'Cádiz, Andalucía',
    locator: { kind: 'address', value: 'Cádiz, Andalucía, Spain' },
    tags: ['history-of-science', 'culture', 'cross-universe'],
    presentDayRole: 'Historische Atlantik- und Hafenstadt in Andalusien mit sehr langer maritimer Siedlungsgeschichte.',
    noxiaRole: 'Cross-Universe-Anker für den Übergang Mittelmeer–Atlantik, Navigation, Hafenlogistik und Kartografie.',
    sourceProjects: [
      { project: 'Bayt al-Mîrâ / al-Qiyās wa-l-Ṣabr', relation: 'setting', note: 'Spätere westliche Station des Kartografen in Andalusien.' },
      { project: 'NOXIA', relation: 'research-anchor', note: 'Navigation, Kartografie und maritime Übergangsräume.' },
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
