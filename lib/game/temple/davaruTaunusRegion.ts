/** Canonical story-region intent. Not a geocoded position or a building permit. */
export const DAVARU_TAUNUS_HOME_REGION = {
  key: 'davaru-taunus-schmitten',
  world: 'earth',
  locality: 'Schmitten im Taunus',
  broaderArea: 'Großer Feldberg / Hochtaunus',
  narrativePrecision: 'approximate',
  // Observed Schmitten settlement centre, not the temple plot (Wikidata Q622207).
  placeCenter: { lat: 50.26972, lon: 8.44431 },
  placeRadiusKm: 2.2,
  templeLocationStatus: 'unplaced',
  canonicalCharacterKeys: ['daniel-van-runen-davaru', 'aristeas-lux'],
  geography: {
    desiredLandscape: ['wooded-slope', 'stream-nearby', 'quiet-retreat', 'accessible-settlement'],
    verificationRequired: ['wgs84-geocode', 'observed-terrain', 'existing-trails', 'watercourse', 'protected-areas', 'buildable-tile'],
  },
  danielCycling: {
    preferredArea: 'Großer Feldberg und Schmitten',
    terrainPreference: 'steep-ascents',
    distancePreference: 'variable-short-or-long',
    simulationStatus: 'character-preference-only',
  },
} as const
