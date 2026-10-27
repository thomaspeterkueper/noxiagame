// lib/game/spatial/connectionKinds.ts
// Welche Verbindungen zwischen Modulen begehbare Durchgänge mit Luft sind
// (Thomas, 27.10.2026): Module werden durch Durchgänge verbunden; Halteleinen
// außen gibt es aus Sicherheitsgründen trotzdem, sie werden aber erst in einer
// echten 3D-Ansicht gebraucht und hier nicht als Weg geführt. Versorgungs-
// leitungen und Ankerleinen sind Kabel, keine Gänge.

/** Verbindungsarten, durch die man ohne Anzug geht. */
const PASSAGES = new Set(['pressurized-corridor', 'cargo-transfer-link', 'surface-tube', 'tether-corridor', 'anchor-tether'])

export function isPassageConnection(kind: string | null | undefined): boolean {
  return PASSAGES.has(String(kind ?? ''))
}
