import type { GeoPoint } from './earthSpatial'

export type EarthReferenceSite = {
  id: string
  label: string
  point: GeoPoint
}

/** Canonical NOXIA planning anchor for the Selmecke Earth location. */
export const SELMECKE_REFERENCE_SITE: EarthReferenceSite = {
  id: 'noxia:site:selmecke-reference',
  label: 'Selmecke · NOXIA-Referenzstandort',
  point: { lat: 51.33745, lon: 7.97975 },
}
