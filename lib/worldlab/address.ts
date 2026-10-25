// lib/worldlab/address.ts
// Zieleingabe der Erdkarte: „Hauptstraße 102“, „Bogenstraße“ oder „51.34, 8.00“.

export type AddressQuery =
  | { kind: 'coordinates'; lat: number; lon: number }
  | { kind: 'address'; street: string; number: string | null }

export function parseAddressQuery(raw: string): AddressQuery | null {
  const text = raw.trim().replace(/\s+/g, ' ').slice(0, 100)
  if (!text) return null
  const coordinates = text.match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/)
  if (coordinates) {
    const lat = Number(coordinates[1].replace(',', '.')), lon = Number(coordinates[2].replace(',', '.'))
    if (Math.abs(lat) <= 85 && Math.abs(lon) <= 180) return { kind: 'coordinates', lat, lon }
  }
  // Hausnummer am Ende: „102“, „25a“, „12-14“
  const withNumber = text.match(/^(.+?)\s+(\d+[a-zA-Z]?(?:\s*-\s*\d+[a-zA-Z]?)?)$/)
  const street = (withNumber ? withNumber[1] : text).replace(/[,;]+$/, '').replace(/str\.?$/i, 'straße').trim()
  if (street.length < 2 || /[%_\\]/.test(street)) return null
  return { kind: 'address', street, number: withNumber ? withNumber[2].replace(/\s+/g, '') : null }
}
