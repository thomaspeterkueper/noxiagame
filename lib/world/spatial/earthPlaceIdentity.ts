export type EarthPlacePoint = { lat: number; lon: number }

function coordinateToken(value: number) {
  return value.toFixed(5).replace('-', 'm').replace('.', 'p')
}

/**
 * Stable identity for an Earth place selected by geographic centre.
 * Five decimals keep the identity metre-scale without depending on a
 * provider-specific Nominatim/OSM id.
 */
export function earthPlaceSlug(point: EarthPlacePoint) {
  return `earth-place-${coordinateToken(point.lat)}-${coordinateToken(point.lon)}`
}

export function isEarthPlaceSlug(value: string | null | undefined) {
  return Boolean(value && value.startsWith('earth-place-'))
}
