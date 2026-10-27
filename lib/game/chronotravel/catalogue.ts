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
