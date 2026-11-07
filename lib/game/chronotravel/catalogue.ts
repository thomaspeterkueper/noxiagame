import type { HistoricalScene, Offer } from './domain'

/** Pilotstand: Ortskoordinaten und Epochen, nicht als validierte 3D-Rekonstruktion ausgeben. */
const anchor = { lat: 41.0065, lon: 28.9757 }
export const HISTORICAL_SCENES: HistoricalScene[] = [
  { id: 'hippodrome-550', placeId: 'earth-istanbul-hippodrome', label: 'Konstantinopel – Hippodrom, 550', yearCE: 550, anchor,
    reconstructionVersion: 'pilot-manifest-v1', evidence: [{ sourceRef: 'research-required:hippodrome-550', confidence: 'speculative', note: 'Historische Rekonstruktion und Primärquellen noch zu kuratieren' }] },
  { id: 'hippodrome-1200', placeId: 'earth-istanbul-hippodrome', label: 'Konstantinopel – Hippodrom, 1200', yearCE: 1200, anchor,
    reconstructionVersion: 'pilot-manifest-v1', evidence: [{ sourceRef: 'research-required:hippodrome-1200', confidence: 'speculative', note: 'Historische Rekonstruktion und Primärquellen noch zu kuratieren' }] },
  { id: 'hippodrome-1700', placeId: 'earth-istanbul-hippodrome', label: 'Istanbul – Hippodrom/Atmeydanı, 1700', yearCE: 1700, anchor,
    reconstructionVersion: 'pilot-manifest-v1', evidence: [{ sourceRef: 'research-required:hippodrome-1700', confidence: 'speculative', note: 'Historische Rekonstruktion und Primärquellen noch zu kuratieren' }] },
  { id: 'hagia-sophia-550', placeId: 'earth-istanbul-hagia-sophia', label: 'Hagia Sophia – byzantinische Kirche, 550', yearCE: 550, anchor: {lat:41.0086,lon:28.9802},
    reconstructionVersion: 'massing-study-v1', evidence: [{sourceRef:'https://www.ktb.gov.tr/EN-113776/ayasofya-hagia-sophia.html',confidence:'documented',note:'Neubau 532–537 und Eröffnung 537; Baukörper in dieser Demo nicht geometrisch verifiziert' }] },
  { id: 'hagia-sophia-1200', placeId: 'earth-istanbul-hagia-sophia', label: 'Hagia Sophia – byzantinische Kirche, 1200', yearCE: 1200, anchor: {lat:41.0086,lon:28.9802},
    reconstructionVersion: 'massing-study-v1', evidence: [{sourceRef:'https://www.metmuseum.org/de/essays/hagia-sophia-532-37',confidence:'documented',note:'Byzantinischer Bau; konkrete Raumdekoration für 1200 noch zu prüfen' }] },
  { id: 'hagia-sophia-1700', placeId: 'earth-istanbul-hagia-sophia', label: 'Ayasofya – osmanische Moschee, 1700', yearCE: 1700, anchor: {lat:41.0086,lon:28.9802},
    reconstructionVersion: 'massing-study-v1', evidence: [{sourceRef:'https://www.fatih.bel.tr/en/main/pages/the-hagia-sophia-grand-mosque-ayasofya-i-kebi/578',confidence:'documented',note:'Umnutzung ab 1453 und osmanische Erweiterungen; die Anordnung der 3D-Objekte bleibt schematisch'}] },
]
/** Vorläufige Designpreise: keine Belastung von Wallets durch dieses Modul. */
export const TRAVEL_OFFERS: Offer[] = HISTORICAL_SCENES.map(scene => ({
  id: 'explorer-' + scene.id,
  sceneId: scene.id,
  mode: 'historical_explorer',
  durationMinutes: 60,
  priceCredits: 25,
  capacity: 8,
}))
