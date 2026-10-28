// lib/game/gameCalendar.ts
// Erstellt:     28.10.2026
// Aktualisiert: 28.10.2026 — Gemeinsame Quelle für das Spieljahr und das Alter von Personen (Request R-11)
// Version:      1.0.1
//
// Rein, ohne DB. Ein Tick ist eine Stunde Koloniezeit (circadian.ts). Das Spiel
// beginnt im Jahr, das die Kopfzeile zeigt (DashboardCockpit: „NOXIA 2086“).
// Entschieden (Thomas, 28.10.2026): Spielbeginn 2086.

export const GAME_START_YEAR = 2086
export const TICKS_PER_DAY = 24
export const TICKS_PER_YEAR = 365 * TICKS_PER_DAY

/** Spieljahr zu einem Tick. */
export function gameYearForTick(tick: number | null | undefined): number {
  const t = Number(tick)
  if (!Number.isFinite(t) || t < 0) return GAME_START_YEAR
  return GAME_START_YEAR + Math.floor(t / TICKS_PER_YEAR)
}

/** Alter in vollen Jahren im Spieljahr (Geburtstag nicht bekannt: Jahr minus Geburtsjahr). */
export function ageInGameYear(birthYear: number | null | undefined, gameYear: number): number | null {
  const born = Number(birthYear)
  if (!Number.isFinite(born) || born <= 0) return null
  const age = gameYear - Math.trunc(born)
  return age >= 0 && age <= 140 ? age : null
}

/** Alter einer Person zu einem Tick. */
export function ageAtTick(birthYear: number | null | undefined, tick: number | null | undefined): number | null {
  return ageInGameYear(birthYear, gameYearForTick(tick))
}
