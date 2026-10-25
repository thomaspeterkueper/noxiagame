// lib/worldlab/placeName.ts
// Ortsname aus der Bezeichnung einer Erdregion: „Sundern, Hochsauerlandkreis, …“ → „Sundern“.
// Ortsdetail-Zellen und Sammelregionen („Earth · Deutschland · Sauerland“) haben keinen Ortsnamen.

export function placeNameFromLabel(label: string): string | null {
  const text = label.trim()
  if (!text || /^Lokaldetail\b/.test(text) || /^Earth\b/i.test(text) || text.includes('·')) return null
  const first = text.split(',')[0].trim()
  return first ? first.slice(0, 60) : null
}
