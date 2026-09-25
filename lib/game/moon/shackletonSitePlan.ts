// lib/game/moon/shackletonSitePlan.ts
//
// Evidence-aware operational zoning for Shackleton Base Alpha.
// This is deliberately NOT a hard-coded landing coordinate. The current starter
// settlement remains a local ENU layout until the origin is resolved against a
// validated LOLA slope + illumination product.
//
// Scientific basis used for the planning semantics:
// - Shackleton is ~21 km across and ~4.2 km deep.
// - Mean inner-wall slopes are close to 29-31 deg; the wall is not a suitable
//   general-purpose settlement surface.
// - Highly illuminated rim/high-ground points and nearby ridges are attractive
//   for power and communications, but illumination is not literally eternal.
// - Permanently shadowed terrain is operationally valuable for volatile science
//   and possible ISRU, but should be treated as a separate extreme environment.
//
// Exact site authority must ultimately come from validated planetary terrain,
// illumination and slope layers, not from this gameplay planning file.

export type ShackletonOperationalZoneId =
  | 'ridge_base'
  | 'light_edge'
  | 'descent_corridor'
  | 'psr_resource_zone'
  | 'landing_standoff'

export type ShackletonZoneConfidence = 'planning' | 'terrain-resolved' | 'validated'

export interface ShackletonOperationalZone {
  id: ShackletonOperationalZoneId
  label: string
  purpose: string
  preferredTerrain: string
  avoid: string[]
  confidence: ShackletonZoneConfidence
}

export interface ShackletonSitePlan {
  id: 'shackleton_base_alpha_site_plan'
  siteStatus: 'provisional-local-frame'
  settlementPrinciple: string
  zones: readonly ShackletonOperationalZone[]
  constraints: readonly string[]
}

export const SHACKLETON_BASE_ALPHA_SITE_PLAN: ShackletonSitePlan = {
  id: 'shackleton_base_alpha_site_plan',
  siteStatus: 'provisional-local-frame',
  settlementPrinciple:
    'Place the inhabited and logistics core on comparatively stable ridge/high-ground terrain near Shackleton, not on the steep inner wall or the sharpest illuminated crest. Use separate infrastructure zones for power, landing and PSR access.',
  zones: [
    {
      id: 'ridge_base',
      label: 'Ridge Base / Hauptsiedlung',
      purpose: 'Habitat, life support, warehouse, workshop, rover yard and protected local circulation.',
      preferredTerrain: 'comparatively broad, low-slope high ground with reliable Earth line-of-sight and short access to illuminated terrain',
      avoid: ['inner crater wall', 'knife-edge crest', 'local slope breaks', 'unverified regolith-instability zones'],
      confidence: 'planning',
    },
    {
      id: 'light_edge',
      label: 'Lichtkante / Energiezone',
      purpose: 'Solar generation, power towers, communications and horizon monitoring.',
      preferredTerrain: 'high ground with high annual illumination fraction and suitable local slope',
      avoid: ['habitat plume/dust corridors', 'single-point-of-failure power concentration'],
      confidence: 'planning',
    },
    {
      id: 'landing_standoff',
      label: 'Abgesetzte Lande- und Cargo-Zone',
      purpose: 'Arrival, departure and bulk cargo transfer away from the inhabited pressure core.',
      preferredTerrain: 'broad, locally low-slope terrain with clear approach/departure geometry',
      avoid: ['habitat core', 'solar towers', 'fragile science sites', 'PSR volatile investigation areas'],
      confidence: 'planning',
    },
    {
      id: 'descent_corridor',
      label: 'Abstiegskorridor',
      purpose: 'Anchored power/data/utility route and later cable- or rail-assisted access toward the crater interior.',
      preferredTerrain: 'surveyed route selected from LOLA slope and hazard data rather than a direct fall-line descent',
      avoid: ['uncontrolled rover descent', 'landslide-prone wall sections', 'single unsupported long span'],
      confidence: 'planning',
    },
    {
      id: 'psr_resource_zone',
      label: 'PSR Forschungs- und ISRU-Zone',
      purpose: 'Volatile prospecting, drilling, sampling and later water/ice processing in permanently shadowed terrain.',
      preferredTerrain: 'scientifically selected PSR targets with remote-sensing evidence and verified access',
      avoid: ['treating inferred ice as a guaranteed ore body', 'placing the primary settlement in the PSR'],
      confidence: 'planning',
    },
  ],
  constraints: [
    'The exact ENU origin must be resolved against validated LOLA terrain before the site becomes canonical.',
    'Use a single metric planetary surface frame for settlement, power, landing and PSR infrastructure.',
    'Illumination must be represented as time-dependent or long-term fraction, not as an "eternal light" boolean.',
    'Landing standoff distance must remain an engineering parameter; do not hard-code 1-2 km as universal truth.',
    'PSR temperatures, volatile abundance and geotechnical properties are spatially variable and must retain provenance/confidence.',
  ],
}
