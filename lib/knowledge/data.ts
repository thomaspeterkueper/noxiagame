// data.ts
// Aktualisiert: 19.07.2026 — NOX-0001 bis NOX-0008: SSF Unlock-Keys Registry
// Version:      0.3.0
import type { KnowledgeBuilding, KnowledgeLearningModule, KnowledgeUnlock } from './types';

export const learningModules: KnowledgeLearningModule[] = [
  {
    id: 'LRN:SSF:MAT-1001',
    name: 'Zahlen und Größen',
    domain: 'MAT',
    requires: [],
    teaches: ['CON:L1:zahlen', 'CON:L1:einheiten'],
    unlocks: ['UNL:SSF:basic-physics-ready'],
  },
  {
    id: 'LRN:SSF:MAT-1002',
    name: 'Vektoren und Richtung',
    domain: 'MAT',
    requires: ['LRN:SSF:MAT-1001'],
    teaches: ['CON:L1:vektoren'],
    unlocks: ['UNL:SSF:motion-ready'],
  },
  {
    id: 'LRN:SSF:PHY-1201',
    name: 'Bewegung und Geschwindigkeit',
    domain: 'PHY',
    requires: ['LRN:SSF:MAT-1002'],
    teaches: ['CON:L1:bewegung', 'CON:L1:geschwindigkeit'],
    unlocks: ['UNL:SSF:orbital-ready'],
  },
  {
    id: 'LRN:SSF:PHY-1101',
    name: 'Was ist Gravitation?',
    domain: 'PHY',
    requires: ['LRN:SSF:MAT-1001'],
    teaches: ['CON:L1:gravitation'],
    unlocks: ['UNL:NOX:orbital-navigation'],
  },
  {
    id: 'LRN:SSF:AST-2101',
    name: 'Orbitalmechanik Grundlagen',
    domain: 'AST',
    requires: ['LRN:SSF:PHY-1101', 'LRN:SSF:PHY-1201'],
    teaches: ['CON:L1:orbitalmechanik'],
    unlocks: ['UNL:NOX:transfer-routes'],
  },
  {
    id: 'LRN:SSF:PHY-1301',
    name: 'Was ist Energie?',
    domain: 'PHY',
    requires: ['LRN:SSF:MAT-1001'],
    teaches: ['CON:L1:energie'],
    unlocks: ['UNL:NOX:power-generation'],
  },
  {
    id: 'LRN:SSF:PHY-1302',
    name: 'Strom und Energiespeicher',
    domain: 'PHY',
    requires: ['LRN:SSF:PHY-1301'],
    teaches: ['CON:L1:elektrizitaet', 'CON:L1:energiespeicher'],
    unlocks: ['UNL:NOX:solar-grid'],
  },
  {
    id: 'LRN:SSF:CHE-1101',
    name: 'Wasser im Sonnensystem',
    domain: 'CHE',
    requires: ['LRN:SSF:PHY-1301'],
    teaches: ['CON:L1:wasser'],
    unlocks: ['UNL:NOX:water-processing'],
  },
  {
    id: 'LRN:SSF:AST-1201',
    name: 'Mars ist nicht die Erde',
    domain: 'AST',
    requires: ['LRN:SSF:CHE-1101'],
    teaches: ['CON:L1:atmosphaerenphysik', 'CON:L1:habitabilitaet'],
    unlocks: ['UNL:NOX:mars-habitat'],
  },
  {
    id: 'LRN:SSF:BIO-1101',
    name: 'Was ist Leben?',
    domain: 'BIO',
    requires: ['LRN:SSF:CHE-1101'],
    teaches: ['CON:L1:leben'],
    unlocks: ['UNL:NOX:controlled-biology'],
  },
  {
    id: 'LRN:SSF:BIO-1201',
    name: 'Photosynthese Grundlagen',
    domain: 'BIO',
    requires: ['LRN:SSF:BIO-1101'],
    teaches: ['CON:L1:photosynthese'],
    unlocks: ['UNL:NOX:greenhouse-systems'],
  },
  {
    id: 'LRN:SSF:MAT-1201',
    name: 'Stoffe und Materialien',
    domain: 'MAT',
    requires: ['LRN:SSF:MAT-1001'],
    teaches: ['CON:L1:materialien'],
    unlocks: ['UNL:NOX:resource-extraction'],
  },
  {
    id: 'LRN:SSF:CHE-1301',
    name: 'Metalle und Rohstoffe',
    domain: 'CHE',
    requires: ['LRN:SSF:MAT-1201'],
    teaches: ['CON:L1:metalle', 'CON:L1:rohstoffe'],
    unlocks: ['UNL:NOX:smelting'],
  },
  {
    id: 'LRN:SSF:TEC-1101',
    name: 'Werkzeuge und Maschinen',
    domain: 'TEC',
    requires: ['LRN:SSF:CHE-1301'],
    teaches: ['CON:L1:werkzeuge'],
    unlocks: ['UNL:NOX:industrial-tools'],
  },
  {
    id: 'LRN:SSF:TEC-1201',
    name: 'Fertigung Grundlagen',
    domain: 'TEC',
    requires: ['LRN:SSF:TEC-1101'],
    teaches: ['CON:L1:fertigung'],
    unlocks: ['UNL:NOX:industrial-production'],
  },

  // ── Wirtschaft — KG-0012 konform: ECO-L{LEVEL}-{NNNN} ───────────────────
  // L0 = kein Vorwissen, Zieldauer 2–4 Minuten, eine Frage pro Modul
  {
    id: 'LRN:SSF:ECO-L0-0001',
    name: 'Was ist Kredit?',
    domain: 'ECO',
    requires: [],
    teaches: ['CON:L0:kredit', 'CON:L0:schulden', 'CON:L0:zinsen'],
    unlocks: ['UNL:NOX:bank-credit'],
  },
  {
    id: 'LRN:SSF:ECO-L0-0002',
    name: 'Was ist Zinseszins?',
    domain: 'ECO',
    requires: ['LRN:SSF:ECO-L0-0001'],
    teaches: ['CON:L0:zinseszins', 'CON:L0:wachstum-exponentiell'],
    unlocks: ['UNL:NOX:bank-compound'],
  },
  {
    id: 'LRN:SSF:ECO-L0-0003',
    name: 'Was ist ein Sicherheitenwert?',
    domain: 'ECO',
    requires: ['LRN:SSF:ECO-L0-0001'],
    teaches: ['CON:L0:sicherheiten', 'CON:L0:beleihungswert'],
    unlocks: ['UNL:NOX:bank-collateral'],
  },
  {
    id: 'LRN:SSF:ECO-L1-0001',
    name: 'Was ist Arbitrage?',
    domain: 'ECO',
    requires: ['LRN:SSF:ECO-L0-0001'],
    teaches: ['CON:L1:arbitrage', 'CON:L1:preisdifferenz'],
    unlocks: ['UNL:NOX:advanced-trading'],
  },
  {
    id: 'LRN:SSF:ECO-L1-0002',
    name: 'Was ist Bodenwert?',
    domain: 'ECO',
    requires: ['LRN:SSF:ECO-L0-0001'],
    teaches: ['CON:L1:bodenwert', 'CON:L1:grundsteuer'],
    unlocks: ['UNL:NOX:land-value'],
  },
];

export const knowledgeUnlocks: KnowledgeUnlock[] = [
  { id: 'UNL:NOX:orbital-navigation', name: 'Orbitale Navigation', requires: ['LRN:SSF:PHY-1101'], unlocks: ['BLD:NOX:raumhafen-1'] },
  { id: 'UNL:NOX:transfer-routes', name: 'Transferrouten', requires: ['LRN:SSF:AST-2101'], unlocks: ['BLD:NOX:frachtkontrolle-1'] },
  { id: 'UNL:NOX:power-generation', name: 'Energieerzeugung', requires: ['LRN:SSF:PHY-1301'], unlocks: ['BLD:NOX:solarfeld-1'] },
  { id: 'UNL:NOX:solar-grid', name: 'Solarnetz', requires: ['LRN:SSF:PHY-1302'], unlocks: ['BLD:NOX:batteriespeicher-1'] },
  { id: 'UNL:NOX:water-processing', name: 'Wasseraufbereitung', requires: ['LRN:SSF:CHE-1101'], unlocks: ['BLD:NOX:wasseraufbereitung-1'] },
  { id: 'UNL:NOX:mars-habitat', name: 'Mars Habitat', requires: ['LRN:SSF:AST-1201'], unlocks: ['BLD:NOX:mars-habitat-1'] },
  { id: 'UNL:NOX:controlled-biology', name: 'Kontrollierte Biologie', requires: ['LRN:SSF:BIO-1101'], unlocks: ['BLD:NOX:biolabor-1'] },
  { id: 'UNL:NOX:greenhouse-systems', name: 'Gewächshaussysteme', requires: ['LRN:SSF:BIO-1201'], unlocks: ['BLD:NOX:gewaechshaus-1', 'BLD:NOX:nahrungsproduktion-1'] },
  { id: 'UNL:NOX:resource-extraction', name: 'Rohstoffgewinnung', requires: ['LRN:SSF:MAT-1201'], unlocks: ['BLD:NOX:mine-1'] },
  { id: 'UNL:NOX:smelting', name: 'Schmelztechnik', requires: ['LRN:SSF:CHE-1301'], unlocks: ['BLD:NOX:schmelze-1'] },
  { id: 'UNL:NOX:bank-credit',    name: 'Kredit aufnehmen',    requires: ['LRN:SSF:ECO-L0-0001'], unlocks: ['BLD:NOX:bank-credit-1'] },
  { id: 'UNL:NOX:bank-compound',  name: 'Zinseszins verstehen', requires: ['LRN:SSF:ECO-L0-0002'], unlocks: ['BLD:NOX:bank-compound-1'] },
  { id: 'UNL:NOX:bank-collateral',name: 'Sicherheiten hinterlegen', requires: ['LRN:SSF:ECO-L0-0003'], unlocks: ['BLD:NOX:bank-collateral-1'] },
  { id: 'UNL:NOX:advanced-trading',name: 'Erweiterter Handel', requires: ['LRN:SSF:ECO-L1-0001'], unlocks: ['BLD:NOX:markt-1'] },
  { id: 'UNL:NOX:land-value',     name: 'Bodenwert',           requires: ['LRN:SSF:ECO-L1-0002'], unlocks: ['BLD:NOX:verwaltung-1'] },
];

export const knowledgeBuildings: KnowledgeBuilding[] = [
  { id: 'BLD:NOX:raumhafen-1', name: 'Raumhafen I', category: 'transport', requires: ['UNL:NOX:orbital-navigation'], effects: ['local_trade', 'ship_operations'] },
  { id: 'BLD:NOX:frachtkontrolle-1', name: 'Frachtkontrolle I', category: 'logistics', requires: ['UNL:NOX:transfer-routes'], effects: ['route_planning', 'cargo_management'] },
  { id: 'BLD:NOX:solarfeld-1', name: 'Solarfeld I', category: 'energy', requires: ['UNL:NOX:power-generation'], effects: ['energy_production'] },
  { id: 'BLD:NOX:batteriespeicher-1', name: 'Batteriespeicher I', category: 'energy', requires: ['UNL:NOX:solar-grid'], effects: ['energy_storage'] },
  { id: 'BLD:NOX:wasseraufbereitung-1', name: 'Wasseraufbereitung I', category: 'life_support', requires: ['UNL:NOX:water-processing'], effects: ['water_supply'] },
  { id: 'BLD:NOX:mars-habitat-1', name: 'Mars Habitat I', category: 'colony', requires: ['UNL:NOX:mars-habitat'], effects: ['population_capacity', 'life_support'] },
  { id: 'BLD:NOX:biolabor-1', name: 'Biolabor I', category: 'science', requires: ['UNL:NOX:controlled-biology'], effects: ['biological_research'] },
  { id: 'BLD:NOX:gewaechshaus-1', name: 'Gewächshaus I', category: 'food', requires: ['UNL:NOX:greenhouse-systems'], effects: ['food_production'] },
  { id: 'BLD:NOX:nahrungsproduktion-1', name: 'Nahrungsproduktion I', category: 'food', requires: ['UNL:NOX:greenhouse-systems'], effects: ['colony_food_supply'] },
  { id: 'BLD:NOX:mine-1', name: 'Mine I', category: 'extraction', requires: ['UNL:NOX:resource-extraction'], effects: ['ore_production'] },
  { id: 'BLD:NOX:schmelze-1',       name: 'Schmelze I',            category: 'industry',  requires: ['UNL:NOX:smelting'],         effects: ['metal_production'] },
  { id: 'BLD:NOX:bank-credit-1',    name: 'Bank — Kredit',         category: 'finance',   requires: ['UNL:NOX:bank-credit'],      effects: ['loan_access'] },
  { id: 'BLD:NOX:bank-compound-1',  name: 'Bank — Zinseszins',     category: 'finance',   requires: ['UNL:NOX:bank-compound'],    effects: ['compound_interest'] },
  { id: 'BLD:NOX:bank-collateral-1',name: 'Bank — Sicherheiten',   category: 'finance',   requires: ['UNL:NOX:bank-collateral'],  effects: ['collateral_limit'] },
  { id: 'BLD:NOX:markt-1',          name: 'Markt I',               category: 'trade',     requires: ['UNL:NOX:advanced-trading'], effects: ['arbitrage_routes'] },
  { id: 'BLD:NOX:verwaltung-1',     name: 'Verwaltung I',          category: 'governance',requires: ['UNL:NOX:land-value'],      effects: ['land_tax'] },
];

// ── NOX-0001 bis NOX-0008: SSF-Lernpfad-Unlocks ─────────────────────────────
// Implementiert: 19.07.2026
// Source: solarsciencefoundation/external-tasks/open/NOX-0001..0008.md
// Diese Keys werden durch SSF-Lernpfade freigeschaltet und schalten
// zukünftige NOXIA-Features frei (Scanner, Labore, Missionen, Sensoren).

// ── NOX-0001: Sensor-Paket ────────────────────────────────────────────────
export const SENSOR_UNLOCKS = [
  'UNL:NOX:SENSOR:SPECTRAL',      // Spektralanalyse — PHY-WAVE-SPECTRUM
  'UNL:NOX:SENSOR:ATMOSPHERE',    // Atmosphärenmessung — PHY-SKY
  'UNL:NOX:SENSOR:MAGNETIC',      // Magnetfeldsensor — PHY-MAGNETISMUS
  'UNL:NOX:SENSOR:WAVE',          // Wellenanalyse — PHY-WAVE-SPECTRUM
  'UNL:NOX:SENSOR:PIEZO',         // Piezoelektrischer Sensor — PHY-PIEZO
  'UNL:NOX:SENSOR:STRAIN',        // Dehnungsmessung — PHY-PIEZO
  'UNL:NOX:SENSOR:STRESS',        // Spannungsanalyse — PHY-PIEZO
  'UNL:NOX:SENSOR:CURRENT',       // Stromsensor — PHY-ELEKTROLYSE
  'UNL:NOX:SENSOR:GEODESIC',      // Geodätische Messung — MAT-DIFFGEO
  'UNL:NOX:SENSOR:PRECISION',     // Präzisionsmessung — ENG-EDM
] as const

// ── NOX-0002: Werkzeug-Paket ──────────────────────────────────────────────
export const TOOL_UNLOCKS = [
  'UNL:NOX:TOOL:DESCALER',         // Entkalkung — CHE-REINIGUNG-KALK
  'UNL:NOX:TOOL:SURFACE-ANALYSIS', // Oberflächenanalyse — PHY-REINIGUNG
  'UNL:NOX:TOOL:FLOOR-CLEANING',   // Bodenreinigung — CHE-REINIGUNG
  'UNL:NOX:TOOL:STREAK-FREE',      // Streifenfreie Reinigung
  'UNL:NOX:TOOL:STAIN-REMOVAL',    // Fleckenentfernung
  'UNL:NOX:TOOL:EMULSIFICATION',   // Emulgierung — CHE-KUEHE-EMULSION
  'UNL:NOX:TOOL:KITCHEN-CHEMISTRY',// Küchenchemie
  'UNL:NOX:TOOL:THERMAL-DESIGN',   // Thermisches Design — PHY-WAERME
  'UNL:NOX:TOOL:WIRE-EDM',         // Drahterodieren — ENG-EDM
  'UNL:NOX:TOOL:SINK-EDM',         // Senkerodieren — ENG-EDM
  'UNL:NOX:TOOL:PUMP',             // Pumpensysteme — PHY-WASSER
  'UNL:NOX:TOOL:ALTITUDE-COOKING', // Hochaltitudekochen — PHY-WASSER
  'UNL:NOX:TOOL:FOOD-PRESERVATION',// Lebensmittelkonservierung
  'UNL:NOX:PRECISION:MIKRON',      // Mikrobearbeitung — ENG-EDM
  'UNL:NOX:SAFETY:CHEMICAL-MIXING',// Chemische Sicherheit
] as const

// ── NOX-0003: Fahrzeug- & Antriebspaket ──────────────────────────────────
export const VEHICLE_UNLOCKS = [
  'UNL:NOX:TOOL:ENGINE',          // Verbrennungsmotor — PHY-AUTO-MOTOR
  'UNL:NOX:TOOL:PISTON',          // Kolbenmechanik — PHY-AUTO-KOLBEN
  'UNL:NOX:TOOL:COMBUSTION',      // Verbrennung — CHE-AUTO-VERBRENNUNG
  'UNL:NOX:TOOL:BRAKES',          // Bremssysteme — PHY-AUTO-BREMSE
  'UNL:NOX:TOOL:DIFFERENTIAL',    // Differential — PHY-AUTO-DIFF
  'UNL:NOX:TOOL:BATTERY',         // Batteriesystem — PHY-AUTO-BATTERIE
  'UNL:NOX:TOOL:ACCELERATION',    // Beschleunigung — PHY-AUTO-MOTOR
  'UNL:NOX:SENSE:MECHANICAL',     // Mechanische Wahrnehmung
  'UNL:NOX:SENSE:THERMAL',        // Thermische Wahrnehmung
  'UNL:NOX:SENSE:FRICTION',       // Reibungsanalyse
  'UNL:NOX:SENSE:GRIP',           // Griffigkeitsanalyse
  'UNL:NOX:SENSE:HYDRAULICS',     // Hydrauliksysteme
  'UNL:NOX:SENSE:STEERING',       // Lenkungssysteme
  'UNL:NOX:SENSE:EXHAUST',        // Abgasanalyse
  'UNL:NOX:SENSE:ENERGY',         // Energieverbrauchsanalyse
] as const

// ── NOX-0004: Chemie- & Biologie-Paket ───────────────────────────────────
export const CHEM_BIO_UNLOCKS = [
  'UNL:NOX:CHEM:WATER-MOLECULE',      // Wasserchemie — PHY-WASSER-MOLEKUEL
  'UNL:NOX:CHEM:HYDROGEN-BOND',       // Wasserstoffbrücken
  'UNL:NOX:CHEM:DIPOLE',              // Dipolmoleküle
  'UNL:NOX:CHEM:HYDRATION',           // Hydratation
  'UNL:NOX:CHEM:ION-DISSOLUTION',     // Ionenlösung
  'UNL:NOX:CHEM:ACID-BASE',           // Säure-Base
  'UNL:NOX:CHEM:PH-SCALE',            // pH-Skala
  'UNL:NOX:CHEM:OXIDATION',           // Oxidation
  'UNL:NOX:CHEM:SURFACTANT',          // Tenside — CHE-REINIGUNG
  'UNL:NOX:CHEM:MICELLE',             // Mizellen
  'UNL:NOX:CHEM:EMULSION',            // Emulsionen
  'UNL:NOX:CHEM:SOLUBILITY',          // Löslichkeit
  'UNL:NOX:CHEM:OSMOSIS',             // Osmose
  'UNL:NOX:CHEM:DISINFECTION',        // Desinfektion
  'UNL:NOX:CHEM:MONOSACCHARIDE',      // Monosaccharide
  'UNL:NOX:CHEM:RIBOSE',              // Ribose
  'UNL:NOX:CHEM:THERMAL-DECOMP',      // Thermische Zersetzung
  'UNL:NOX:CHEM:PROTEIN-DENATURATION',// Proteindenaturierung
  'UNL:NOX:CHEM:ASTROCHEMISTRY',      // Astrochemie
  'UNL:NOX:CHEM:PREBIOTIC-CHEMISTRY', // Präbiotische Chemie
  'UNL:NOX:BIO:CELL-MEMBRANE',        // Zellmembran
  'UNL:NOX:BIO:DNA-BACKBONE',         // DNA-Backbone
  'UNL:NOX:BIO:ORIGIN-OF-LIFE',       // Ursprung des Lebens
] as const

// ── NOX-0005: Energie & Rohstoffe ────────────────────────────────────────
export const ENERGY_UNLOCKS = [
  'UNL:NOX:PHY:PEM',               // PEM-Elektrolyseur — PHY-ELEKTROLYSE
  'UNL:NOX:CHEM:ELECTROLYSIS',     // Elektrolyse
  'UNL:NOX:ENV:GREEN-HYDROGEN',    // Grüner Wasserstoff
  'UNL:NOX:CHEM:IRIDIUM',          // Iridium-Katalysatoren
  'UNL:NOX:CHEM:PLATINUM-GROUP',   // Platingruppenmetalle
  'UNL:NOX:CHEM:ELECTRON-SPIN',    // Elektronenspin
  'UNL:NOX:PHY:DIPOLE-MOMENT',     // Dipolmoment
  'UNL:NOX:TOOL:ELECTROMAGNET',    // Elektromagnet
  'UNL:NOX:TOOL:ENERGY-HARVESTING',// Energiegewinnung
  'UNL:NOX:ENV:CRITICAL-MATERIALS',// Kritische Rohstoffe
  'UNL:NOX:ENV:CIRCULAR-ECONOMY',  // Kreislaufwirtschaft
  'UNL:NOX:KNOW:ENERGY-TRANSITION',// Energiewende-Wissen
] as const

// ── NOX-0006: Physik & Navigation ────────────────────────────────────────
export const PHYSICS_NAV_UNLOCKS = [
  'UNL:NOX:NAV:ORBITAL',           // Umlaufbahnberechnung — PHY-SKY
  'UNL:NOX:NAV:CURVATURE',         // Geodätische Kurven — MAT-DIFFGEO
  'UNL:NOX:MATH:LGS',              // Lineare Gleichungssysteme
  'UNL:NOX:ANALYSIS:MATRIX',       // Matrizenanalyse
  'UNL:NOX:ANALYSIS:ERROR',        // Fehlerrechnung
  'UNL:NOX:SIGNAL:FOURIER',        // Fourier-Analyse
  'UNL:NOX:CIRCUIT:DIODE',         // Diodenschaltkreise
  'UNL:NOX:CIRCUIT:WHEATSTONE',    // Wheatstone-Brücke
  'UNL:NOX:CIRCUIT:MOMENT',        // Momentenanalyse
  'UNL:NOX:MECH:TORQUE',           // Drehmoment
  'UNL:NOX:MECH:WORK',             // Mechanische Arbeit
  'UNL:NOX:PHY:SURFACE-TENSION',   // Oberflächenspannung
  'UNL:NOX:PHY:CAPILLARY-ACTION',  // Kapillareffekt
  'UNL:NOX:PHY:DENSITY-ANOMALY',   // Dichteanomalie (Eis/Wasser)
  'UNL:NOX:PHY:ICE-STRUCTURE',     // Eisstruktur
  'UNL:NOX:PHY:BOILING-POINT',     // Siedepunkt
  'UNL:NOX:PHY:DEW-POINT',         // Taupunkt
  'UNL:NOX:PHY:VAPOR-PRESSURE',    // Dampfdruck
  'UNL:NOX:PHY:LATENT-HEAT',       // Latente Wärme
  'UNL:NOX:PHY:HEAT-CAPACITY',     // Wärmekapazität
  'UNL:NOX:PHY:HEAT-TRANSFER',     // Wärmeübertragung
  'UNL:NOX:PHY:THERMAL-MASS',      // Thermische Masse
  'UNL:NOX:PHY:PHASE-DIAGRAM',     // Phasendiagramm
  'UNL:NOX:PHY:TRIPLE-POINT',      // Tripelpunkt
  'UNL:NOX:PHY:SUBLIMATION',       // Sublimation
  'UNL:NOX:PHY:SURFACE-AREA',      // Oberfläche/Volumen
  'UNL:NOX:MAT:HARDNESS-SCALE',    // Härteskala
  'UNL:NOX:MAT:WOOD-CARE',         // Holzpflege
  'UNL:NOX:MAT:TILE-CARE',         // Fliesenpflege
  'UNL:NOX:ENV:OCEAN-CLIMATE',     // Meeresklima
] as const

// ── NOX-0007: Missionen ───────────────────────────────────────────────────
export const MISSION_UNLOCKS = [
  'UNL:NOX:MISSION:LAB-ALPHA',          // Biologie-Labor — BIO-LEBEN-URSPRUNG
  'UNL:NOX:MISSION:OBSERVATION-DECK',   // Spektroskopie-Station — PHY-WAVE-SPECTRUM
  'UNL:NOX:MISSION:DEEP-SCAN',          // Tiefenscan (requires NOX-0001)
  'UNL:NOX:MISSION:ORE-SCAN',           // Erzscan (requires NOX-0001)
  'UNL:NOX:MISSION:BIOSIGNATURE-SCAN',  // Biosignatur-Scan (requires NOX-0001+0004)
  'UNL:NOX:MISSION:HYDROGEN-DEPOT',     // Wasserstoffdepot (requires NOX-0005)
  'UNL:NOX:MISSION:PREBIOTIC-LAB',      // Präbiotisches Labor (requires NOX-0004)
  'UNL:NOX:MISSION:WATER-PLANT',        // Wasseraufbereitung (requires NOX-0004)
  'UNL:NOX:MISSION:RESOURCE-LOOP',      // Ressourcenkreislauf (requires NOX-0005)
] as const

// ── NOX-0008: Wissen-Keys ─────────────────────────────────────────────────
export const KNOWLEDGE_UNLOCKS = [
  'UNL:NOX:KNOW:LIFE-ON-EARTH',         // Warum Eis schwimmt — PHY-WASSER-ANOMALIE
  'UNL:NOX:KNOW:INTERSTELLAR-MEDIUM',   // Interstellare Moleküle — CHE-ZUCKER-WELTALL
  'UNL:NOX:KNOW:ENERGY-TRANSITION',     // Energiewende — ENV-ROHSTOFFE
] as const

// Vollständige Liste aller SSF-Unlock-Keys (NOX-0001 bis NOX-0008)
export const ALL_SSF_UNLOCK_KEYS = [
  ...SENSOR_UNLOCKS,
  ...TOOL_UNLOCKS,
  ...VEHICLE_UNLOCKS,
  ...CHEM_BIO_UNLOCKS,
  ...ENERGY_UNLOCKS,
  ...PHYSICS_NAV_UNLOCKS,
  ...MISSION_UNLOCKS,
  ...KNOWLEDGE_UNLOCKS,
] as const

export type SsfUnlockKey = typeof ALL_SSF_UNLOCK_KEYS[number]
