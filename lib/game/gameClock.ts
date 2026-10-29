// lib/game/gameClock.ts
// Spieluhr = deutsche Zeit (Thomas, 29.10.2026: Spieluhr angleichen).
//
// Die Simulation zählt weiter Ticks (einer je echter Stunde, beansprucht zur
// vollen UTC-Stunde, siehe claim_due_ticks). Bisher galt Spielstunde = tick % 24;
// das lag rund 10 Stunden vor der Zeit in Deutschland – um 11 Uhr bei uns war im
// Spiel 21 Uhr. Jetzt gilt für Uhrzeit und Wochentag die Zeit in Europe/Berlin,
// mit Sommerzeit. Ein „Uhr-Tick“ (clockTick) zählt Stunden so, dass
//   clockTick % 24          = Stunde in Deutschland
//   floor(clockTick/24) % 7 = Wochentag (0 = Montag)
// Alle Regeln, die bisher mit tick % 24 rechneten, rechnen mit clockTick.
// Die Ticknummern selbst ändern sich nicht.

/** Bezugspunkt: Tick 2598 wurde am 28.10.2026 um 19:00 UTC beansprucht. */
export const CLOCK_ANCHOR = { tick: 2598, utcMs: Date.UTC(2026, 9, 28, 19) } as const
export const CLOCK_TIME_ZONE = 'Europe/Berlin'
const HOUR_MS = 3_600_000

/** Echter Zeitpunkt (UTC, ms) zum Beginn eines Ticks. */
export function tickUtcMs(tick: number) {
  return CLOCK_ANCHOR.utcMs + (Math.trunc(tick) - CLOCK_ANCHOR.tick) * HOUR_MS
}

const berlinHour = new Intl.DateTimeFormat('en-GB', { timeZone: CLOCK_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' })
const offsetCache = new Map<number, number>()
/** Abstand Deutschland – UTC in Stunden zu einem Zeitpunkt (1 im Winter, 2 im Sommer). */
export function berlinOffsetHours(utcMs: number) {
  const key = Math.floor(utcMs / HOUR_MS)
  const cached = offsetCache.get(key)
  if (cached !== undefined) return cached
  const local = Number(berlinHour.format(new Date(key * HOUR_MS)))
  const utc = new Date(key * HOUR_MS).getUTCHours()
  const offset = ((local - utc) % 24 + 24 + 12) % 24 - 12
  if (offsetCache.size > 5000) offsetCache.clear()
  offsetCache.set(key, offset)
  return offset
}

/**
 * Verschiebung zwischen Tick und Uhr-Tick. Bisher war tick % 24 = UTC + 11 Stunden;
 * die deutsche Zeit liegt UTC + 1 (Winter) bzw. + 2 (Sommer): Verschiebung −10 bzw. −9.
 */
export function clockOffset(tick: number) {
  return berlinOffsetHours(tickUtcMs(tick)) - 11
}

/** Uhr-Tick zu einem Tick (Stunde und Wochentag in Deutschland). */
export function clockTick(tick: number) {
  return Math.trunc(tick) + clockOffset(tick)
}

/** Tick zu einem Uhr-Tick (Umkehrung; an der Sommerzeit-Grenze die erste passende Stunde). */
export function tickOfClock(clock: number) {
  const guess = Math.trunc(clock) + 10
  for (const tick of [guess, guess - 1, guess + 1]) if (clockTick(tick) === clock) return tick
  return guess
}

const mod = (value: number, base: number) => ((value % base) + base) % base
/** Stunde (0–23) in Deutschland zu einem Tick. */
export function clockHour(tick: number) { return mod(clockTick(tick), 24) }
/** Wochentag (0 = Montag) in Deutschland zu einem Tick. */
export function clockWeekday(tick: number) { return mod(Math.floor(clockTick(tick) / 24), 7) }
