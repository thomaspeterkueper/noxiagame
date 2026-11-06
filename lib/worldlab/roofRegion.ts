/**
 * Dachform nach Weltgegend (Weltkarte). Liefert, wie steil Dächer gezeichnet werden:
 * Faktor auf die Dachhöhe des Gebäudetyps; 0 = Flachdach.
 */
export type RoofRegion = 'flat' | 'low' | 'normal' | 'steep'

export function roofRegion(lat: number, lon: number): RoofRegion {
  const a = Math.abs(lat)
  // Mittelmeerraum nördlich des Wüstengürtels (Spanien bis Türkei): flach geneigte Ziegeldächer.
  if (lat >= 35.5 && lat <= 46 && lon >= -10 && lon <= 45) return 'low'
  if (a < 36) return 'flat'
  if (a >= 58) return 'steep'
  return 'normal'
}

export const ROOF_FACTOR: Record<RoofRegion, number> = { flat: 0, low: 0.45, normal: 1, steep: 1.2 }

/** Warme Breiten ohne Mittelmeer-Ziegeldach: Kirchen/Moscheen/Tempel ohne Turm. */
export function hasSpires(region: RoofRegion): boolean { return region !== 'flat' }
