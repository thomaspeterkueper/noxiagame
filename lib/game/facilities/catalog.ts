export type FacilityInteractionKind =
  | 'market'
  | 'shipyard'
  | 'navigation'
  | 'ship'
  | 'parts'
  | 'logistics'
  | 'research'
  | 'conversation'
  | 'life_support'
  | 'power'

export type FacilityZoneKind =
  | 'access'
  | 'operations'
  | 'logistics'
  | 'social'
  | 'residential'
  | 'technical'
  | 'research'
  | 'vehicle'

export interface FacilityInteractionDef {
  id: string
  label: string
  kind: FacilityInteractionKind
  description: string
  /**
   * Existing dashboard systems are marked active. Future interactions remain
   * explicit in the facility model without pretending that a backend already
   * exists for them.
   */
  availability: 'active' | 'planned'
}

export interface FacilityZoneDef {
  id: string
  label: string
  kind: FacilityZoneKind
  description: string
  interactionIds: string[]
}

export interface FacilityDefinition {
  id: string
  label: string
  description: string
  zones: FacilityZoneDef[]
  interactions: FacilityInteractionDef[]
}

const active = (
  id: string,
  label: string,
  kind: FacilityInteractionKind,
  description: string,
): FacilityInteractionDef => ({ id, label, kind, description, availability: 'active' })

const planned = (
  id: string,
  label: string,
  kind: FacilityInteractionKind,
  description: string,
): FacilityInteractionDef => ({ id, label, kind, description, availability: 'planned' })

const FACILITIES: Record<string, FacilityDefinition> = {
  landing_pad: {
    id: 'landing_pad',
    label: 'Raumhafen / Landefeld',
    description: 'Ankunft, Abflug, Navigation, Fracht und technische Abfertigung.',
    zones: [
      { id: 'arrival', label: 'Ankunft & Schleuse', kind: 'access', description: 'Übergang zwischen Oberfläche, Fahrzeugen und Druckbereich.', interactionIds: ['talk-arrival'] },
      { id: 'flight_control', label: 'Flugleitung', kind: 'operations', description: 'Flugplanung, Reichweite und Abflugfreigaben.', interactionIds: ['navigation'] },
      { id: 'cargo', label: 'Cargo-Terminal', kind: 'logistics', description: 'Frachtumschlag und Handel am Standort.', interactionIds: ['market', 'logistics'] },
      { id: 'service', label: 'Service & Wartung', kind: 'technical', description: 'Technische Arbeiten an Schiffen und Modulen.', interactionIds: ['shipyard', 'parts'] },
      { id: 'dock', label: 'Lande-/Dockbereich', kind: 'vehicle', description: 'Zugang zum aktiven Schiff und zu angedockten Fahrzeugen.', interactionIds: ['ship'] },
    ],
    interactions: [
      active('navigation', 'Navigation öffnen', 'navigation', 'Sonnensystem, Reichweite und Flugplanung öffnen.'),
      active('market', 'Fracht & Handel', 'market', 'Markt, Fracht und offene Aufträge am Standort öffnen.'),
      active('shipyard', 'Wartung / Werft', 'shipyard', 'Vorhandene Werft- und Wartungsfunktionen öffnen.'),
      active('parts', 'Ersatzteile', 'parts', 'Technischen Teile-/Werftzugang öffnen.'),
      active('ship', 'Zum Schiff', 'ship', 'Zum aktuell verfügbaren Schiff wechseln.'),
      planned('logistics', 'Oberflächenlogistik', 'logistics', 'Rover- und Cargo-Bewegungen im Gebäude abfertigen.'),
      planned('talk-arrival', 'Mit Personal sprechen', 'conversation', 'Mit Flugleitung, Technikern oder ankommenden Personen sprechen.'),
    ],
  },
  warehouse: {
    id: 'warehouse',
    label: 'Warenhaus / Logistik-Hub',
    description: 'Zentraler Knoten für Waren, Bau- und Wartungsmaterial sowie lokale Verteilung.',
    zones: [
      { id: 'receiving', label: 'Wareneingang', kind: 'logistics', description: 'Anlieferung, Prüfung und Einbuchung von Fracht.', interactionIds: ['market', 'logistics'] },
      { id: 'storage', label: 'Hauptlager', kind: 'logistics', description: 'Bestände, Reservierungen und Materialpuffer.', interactionIds: ['market'] },
      { id: 'dispatch', label: 'Warenausgang', kind: 'logistics', description: 'Kommissionierung und Weitertransport zur Basis.', interactionIds: ['logistics'] },
      { id: 'office', label: 'Disposition', kind: 'operations', description: 'Aufträge, Lieferketten und Personal.', interactionIds: ['talk-logistics'] },
    ],
    interactions: [
      active('market', 'Handel & Aufträge', 'market', 'Vorhandene Markt- und Auftragsfunktion öffnen.'),
      planned('logistics', 'Transport disponieren', 'logistics', 'Oberflächentransporte direkt vom Warenhaus aus planen.'),
      planned('talk-logistics', 'Mit Disposition sprechen', 'conversation', 'Mit Logistikpersonal über Lieferungen und Engpässe sprechen.'),
    ],
  },
  shipyard: {
    id: 'shipyard',
    label: 'Werkstatt / Werft',
    description: 'Wartung, Reparatur, Montage und technische Versorgung.',
    zones: [
      { id: 'reception', label: 'Auftragsannahme', kind: 'operations', description: 'Wartungs- und Reparaturaufträge.', interactionIds: ['shipyard'] },
      { id: 'workshop', label: 'Werkhalle', kind: 'technical', description: 'Werkzeuge, Diagnose und Reparaturplätze.', interactionIds: ['shipyard', 'parts'] },
      { id: 'parts_store', label: 'Teilelager', kind: 'logistics', description: 'Ersatzteile und technische Verbrauchsmaterialien.', interactionIds: ['parts'] },
      { id: 'crew', label: 'Technikerbereich', kind: 'social', description: 'Arbeitsplätze und Personal der Werkstatt.', interactionIds: ['talk-tech'] },
    ],
    interactions: [
      active('shipyard', 'Werkstatt / Werft öffnen', 'shipyard', 'Vorhandene technische Werftfunktion öffnen.'),
      active('parts', 'Teile & Module', 'parts', 'Technischen Teilezugang öffnen.'),
      planned('talk-tech', 'Mit Technikern sprechen', 'conversation', 'Mit Mechanikern und Ingenieuren über Zustand und Arbeiten sprechen.'),
    ],
  },
  habitat: {
    id: 'habitat',
    label: 'Habitat',
    description: 'Wohn-, Gemeinschafts- und Versorgungsraum der Basis.',
    zones: [
      { id: 'airlock', label: 'Eingangsschleuse', kind: 'access', description: 'Druckschleuse und Übergang zur Oberfläche.', interactionIds: [] },
      { id: 'common', label: 'Gemeinschaftsraum', kind: 'social', description: 'Aufenthalt, Essen, Begegnungen und Gespräche.', interactionIds: ['talk-residents'] },
      { id: 'quarters', label: 'Wohneinheiten', kind: 'residential', description: 'Private Schlaf- und Rückzugsbereiche.', interactionIds: [] },
      { id: 'support', label: 'Versorgungskern', kind: 'technical', description: 'Luft, Wasser und thermische Versorgung des Habitats.', interactionIds: ['life-support'] },
    ],
    interactions: [
      planned('talk-residents', 'Mit Bewohnern sprechen', 'conversation', 'Bewohner und Besucher als echte Gesprächspartner im Innenraum ansprechen.'),
      planned('life-support', 'Lebenserhaltung prüfen', 'life_support', 'Lokale Habitatversorgung und Kreisläufe bedienen.'),
    ],
  },
  command_center: {
    id: 'command_center',
    label: 'Kommunikation / Leitstelle',
    description: 'Kommunikation, Lagebild und Navigationszugang.',
    zones: [
      { id: 'control', label: 'Kontrollraum', kind: 'operations', description: 'Status der Basis und operative Koordination.', interactionIds: ['navigation'] },
      { id: 'comms', label: 'Kommunikation', kind: 'operations', description: 'Funk, Datenlinks und externe Kontakte.', interactionIds: ['navigation', 'talk-comms'] },
    ],
    interactions: [
      active('navigation', 'Navigation öffnen', 'navigation', 'Vorhandene Navigationsansicht öffnen.'),
      planned('talk-comms', 'Mit Leitstelle sprechen', 'conversation', 'Mit Kommunikations- und Einsatzpersonal sprechen.'),
    ],
  },
  laboratory: {
    id: 'laboratory',
    label: 'Labor',
    description: 'Probenannahme, Analyse und experimentelle Forschung.',
    zones: [
      { id: 'intake', label: 'Probenannahme', kind: 'research', description: 'Proben registrieren und vorbereiten.', interactionIds: ['research'] },
      { id: 'analysis', label: 'Analyse', kind: 'research', description: 'Instrumente und Messplätze für wissenschaftliche Untersuchungen.', interactionIds: ['research'] },
      { id: 'experiment', label: 'Experimentierbereich', kind: 'research', description: 'Kontrollierte Versuche und Hypothesentests.', interactionIds: ['research', 'talk-science'] },
    ],
    interactions: [
      planned('research', 'Experiment starten', 'research', 'Künftige wissenschaftliche Experiment- und Probenlogik.'),
      planned('talk-science', 'Mit Forschenden sprechen', 'conversation', 'Mit Wissenschaftlern über Messungen und Hypothesen sprechen.'),
    ],
  },
  medical: {
    id: 'medical',
    label: 'Medizinisches Zentrum',
    description: 'Aufnahme, Behandlung, Diagnostik und medizinische Versorgung.',
    zones: [
      { id: 'reception', label: 'Aufnahme', kind: 'access', description: 'Anmeldung, Triage und Erstkontakt.', interactionIds: ['talk-medical'] },
      { id: 'treatment', label: 'Behandlung', kind: 'technical', description: 'Versorgung, Stabilisierung und Behandlung.', interactionIds: [] },
      { id: 'diagnostics', label: 'Diagnostik', kind: 'research', description: 'Untersuchung, Scan und medizinische Analyse.', interactionIds: ['research-medical'] },
      { id: 'staff', label: 'Personalbereich', kind: 'social', description: 'Arbeits- und Übergabebereich des medizinischen Teams.', interactionIds: ['talk-medical'] },
    ],
    interactions: [
      planned('talk-medical', 'Mit medizinischem Personal sprechen', 'conversation', 'Mit dem medizinischen Team sprechen.'),
      planned('research-medical', 'Diagnostik öffnen', 'research', 'Medizinische Diagnose- und Analysefunktionen öffnen.'),
    ],
  },
  administration: {
    id: 'administration',
    label: 'Verwaltung',
    description: 'Öffentlicher Service, Planung, Akten und Besprechungen.',
    zones: [
      { id: 'entry', label: 'Foyer', kind: 'access', description: 'Öffentlicher Eingang und Orientierung.', interactionIds: [] },
      { id: 'service', label: 'Servicebereich', kind: 'operations', description: 'Anträge, Auskünfte und öffentliche Dienste.', interactionIds: ['talk-admin'] },
      { id: 'operations', label: 'Verwaltung', kind: 'operations', description: 'Planung, Koordination und Aktenführung.', interactionIds: [] },
      { id: 'meeting', label: 'Besprechung', kind: 'social', description: 'Gespräche, Sitzungen und Verhandlungen.', interactionIds: ['talk-admin'] },
    ],
    interactions: [
      planned('talk-admin', 'Mit Verwaltung sprechen', 'conversation', 'Mit Mitarbeitenden der Verwaltung sprechen.'),
    ],
  },
  academy: {
    id: 'academy',
    label: 'Schule / Akademie',
    description: 'Lernen, Lehre, Übungen und wissenschaftliche Grundausbildung.',
    zones: [
      { id: 'entry', label: 'Foyer', kind: 'access', description: 'Eingang und Orientierung.', interactionIds: [] },
      { id: 'classroom', label: 'Lernraum', kind: 'research', description: 'Unterricht und gemeinsames Lernen.', interactionIds: ['research'] },
      { id: 'lab', label: 'Übungslabor', kind: 'research', description: 'Praktische Übungen und Experimente.', interactionIds: ['research','talk-science'] },
      { id: 'office', label: 'Lehrbereich', kind: 'operations', description: 'Vorbereitung und Gespräche mit Lehrenden.', interactionIds: ['talk-science'] },
    ],
    interactions: [
      planned('research', 'Lernen / Experiment', 'research', 'Lern- und Experimentierlogik öffnen.'),
      planned('talk-science', 'Mit Lehrenden sprechen', 'conversation', 'Mit Lehrenden oder Forschenden sprechen.'),
    ],
  },
  library: {
    id: 'library',
    label: 'Archiv / Bibliothek',
    description: 'Lesen, Recherche, Magazin und Langzeitarchiv.',
    zones: [
      { id: 'entry', label: 'Eingang', kind: 'access', description: 'Öffentlicher Zugang und Orientierung.', interactionIds: [] },
      { id: 'reading', label: 'Lesesaal', kind: 'social', description: 'Lesen, Lernen und Gespräche.', interactionIds: ['talk-library'] },
      { id: 'stacks', label: 'Magazin', kind: 'logistics', description: 'Bestände, Katalogisierung und Bereitstellung.', interactionIds: [] },
      { id: 'archive', label: 'Archiv', kind: 'research', description: 'Geschützte Langzeitbestände und Quellenarbeit.', interactionIds: ['research-library'] },
    ],
    interactions: [
      planned('talk-library', 'Mit Archivpersonal sprechen', 'conversation', 'Mit Bibliotheks- und Archivpersonal sprechen.'),
      planned('research-library', 'Archiv recherchieren', 'research', 'Bestände und Quellen für Forschung erschließen.'),
    ],
  },
  sacred_place: {
    id: 'sacred_place',
    label: 'Religiöser Versammlungsort',
    description: 'Ort für Gottesdienst, Gebet, Lehre, Gespräch und Gemeinschaft.',
    zones: [
      { id: 'entry', label: 'Eingang', kind: 'access', description: 'Öffentlicher Zugang und Orientierung.', interactionIds: [] },
      { id: 'assembly', label: 'Versammlungsraum', kind: 'social', description: 'Gemeinsame Gottesdienste, Gebete, Rituale und Zusammenkünfte.', interactionIds: ['talk-spiritual'] },
      { id: 'conversation', label: 'Gespräch', kind: 'social', description: 'Seelsorge, Lehre und persönliche Gespräche.', interactionIds: ['talk-spiritual'] },
      { id: 'quiet', label: 'Rückzug', kind: 'social', description: 'Stiller Bereich für Gebet, Reflexion oder Ruhe.', interactionIds: [] },
    ],
    interactions: [
      planned('talk-spiritual', 'Mit Menschen sprechen', 'conversation', 'Mit Geistlichen, Mitarbeitenden oder Besuchern sprechen.'),
    ],
  },
  resonance_place: {
    id: 'resonance_place',
    label: 'Resonanzplatz',
    description: 'Offener Omnizedenz-Ort für Begegnung, Reflexion, Gespräch und gemeinsames Verweilen.',
    zones: [
      { id: 'threshold', label: 'Übergang', kind: 'access', description: 'Öffentlicher Zugang und Orientierung.', interactionIds: [] },
      { id: 'forum', label: 'Resonanzraum', kind: 'social', description: 'Begegnung, Gespräch und gemeinsames Wahrnehmen.', interactionIds: ['talk-resonance'] },
      { id: 'quiet-edge', label: 'Stiller Rand', kind: 'social', description: 'Rückzug, Beobachtung und Reflexion.', interactionIds: [] },
      { id: 'study', label: 'Lesen & Denken', kind: 'research', description: 'Texte lesen, nachdenken und diskutieren.', interactionIds: ['talk-resonance'] },
    ],
    interactions: [
      planned('talk-resonance', 'Gespräch suchen', 'conversation', 'Mit Anwesenden sprechen; der Ort selbst gewährt kein privilegiertes Wissen.'),
    ],
  },
  robotic_kitchen: {
    id: 'robotic_kitchen',
    label: 'Automatisierte Küche',
    description: 'Robotisierte Speisenzubereitung mit Zutatenlager, Ausgabe sowie Hygiene- und Wartungspfad.',
    zones: [
      { id: 'entry', label: 'Bestellung', kind: 'access', description: 'Bestellung, Zahlung und Zugang zur Ausgabe.', interactionIds: [] },
      { id: 'pickup', label: 'Ausgabe', kind: 'social', description: 'Abholung fertiger Mahlzeiten und kurze Aufenthalte.', interactionIds: [] },
      { id: 'kitchen-cell', label: 'Küchenzelle', kind: 'technical', description: 'Automatisiertes Kochen, Portionieren und Zusammenstellen.', interactionIds: [] },
      { id: 'cold-store', label: 'Kühl- & Zutatenlager', kind: 'logistics', description: 'Vorbereitete Zutaten, Kühlung und Nachfüllung.', interactionIds: ['robotic-kitchen-logistics'] },
      { id: 'service-bay', label: 'Service & Wartung', kind: 'technical', description: 'Technische Wartung, Nachfüllung und Facility-Inventar einschließlich Reinigungsrobotik.', interactionIds: ['robotic-kitchen-service'] },
    ],
    interactions: [
      planned('robotic-kitchen-logistics', 'Zutatenversorgung prüfen', 'logistics', 'Künftige Bestands-, Kühl- und Nachfülllogik der automatisierten Küche.'),
      planned('robotic-kitchen-service', 'Küche warten', 'conversation', 'Künftige Wartungs- und Störungsinteraktion; Reinigung und Müll bleiben Teil der normalen Facility-Unterhaltung.'),
    ],
  },
  solar: {
    id: 'solar',
    label: 'Energieanlage',
    description: 'Stromerzeugung, Regelung und Anlagenzustand.',
    zones: [
      { id: 'control', label: 'Leitstand', kind: 'operations', description: 'Leistung, Ausrichtung und Netzzustand.', interactionIds: ['power'] },
      { id: 'service', label: 'Technikzugang', kind: 'technical', description: 'Wartungszugang zu Elektrik und Leistungselektronik.', interactionIds: [] },
    ],
    interactions: [planned('power', 'Energiefluss steuern', 'power', 'Künftige lokale Energie- und Lastmanagementfunktion.')],
  },
}

const ALIASES: Record<string, string> = {
  residential_block: 'habitat',
  habitat_cluster: 'habitat',
  medical_core: 'medical',
  medical_annex: 'medical',
  factory: 'shipyard',
  workshop_clean: 'shipyard',
  workshop_heavy: 'shipyard',
  logistics_hub: 'warehouse',
  reserve_depot: 'warehouse',
  admin: 'administration',
  command_node: 'administration',
  archive_library: 'library',
  scanner: 'laboratory',
  reactor_module: 'solar',
  black_start: 'solar',
  water_recycler: 'solar',
  water_isru: 'solar',
  radiator_field: 'solar',
  eclss_hub: 'solar',
  landing_pad_moon: 'landing_pad',
  spaceport_pad_standard: 'landing_pad',
  spaceport_pad_mini: 'landing_pad',
  surface_workshop: 'shipyard',
  workshop: 'shipyard',
  surface_comms: 'command_center',
  rover_yard: 'warehouse',
  life_support_hub: 'habitat',
  battery_storage: 'solar',
  school: 'academy',
  automated_food_service: 'robotic_kitchen',
  habitat_food_cell: 'robotic_kitchen',
  church: 'sacred_place',
  mosque: 'sacred_place',
  synagogue: 'sacred_place',
  temple: 'sacred_place',
  shrine: 'sacred_place',
  omnizedenz_resonance_place: 'resonance_place',
}

const FALLBACK: FacilityDefinition = {
  id: 'generic',
  label: 'Anlage',
  description: 'Technische Anlage im persistenten NOXIA-Weltmodell.',
  zones: [{ id: 'entry', label: 'Eingangsbereich', kind: 'access', description: 'Zugang zur Anlage.', interactionIds: [] }],
  interactions: [],
}

export function facilityIdForBuilding(buildingId: string) {
  return ALIASES[buildingId] ?? buildingId
}

export function hasFacilityDefinition(buildingId: string) {
  return Boolean(FACILITIES[facilityIdForBuilding(buildingId)])
}

export function getFacilityDefinition(buildingId: string): FacilityDefinition {
  const id = facilityIdForBuilding(buildingId)
  return FACILITIES[id] ?? { ...FALLBACK, id, label: buildingId || FALLBACK.label }
}
