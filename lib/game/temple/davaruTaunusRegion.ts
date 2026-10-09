/** Canonical story-region intent. Not a geocoded position or a building permit. */
export const DAVARU_TAUNUS_HOME_REGION = {
  key: 'davaru-taunus-schmitten',
  world: 'earth',
  locality: 'Schmitten im Taunus',
  broaderArea: 'Großer Feldberg / Hochtaunus',
  narrativePrecision: 'approximate',
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
