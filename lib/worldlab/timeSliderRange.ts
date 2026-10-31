// lib/worldlab/timeSliderRange.ts
// Zeitraum des Zeitreglers der Weltkarte: vom Tag vor dem ersten belegten Abriss bis jetzt.
// Ohne Abriss mit Datum gibt es nichts zurückzuspielen (null, der Regler bleibt unsichtbar).
export const SLIDER_DAY_MS = 86_400_000

export function timeSliderRange(plots: ReadonlyArray<{ clearedAt?: string }>, now = Date.now()): { min: number; max: number } | null {
  const times = plots.map(plot => (plot.clearedAt ? Date.parse(plot.clearedAt) : NaN)).filter(Number.isFinite)
  if (!times.length) return null
  return { min: Math.min(...times) - SLIDER_DAY_MS, max: now }
}
