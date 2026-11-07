/** Display-only calendar projection from the authoritative hourly Core tick.
 * Core baseline tick 1 is simulation day zero (2077-01-01).
 * This must never be used to schedule, authorize, or mutate Core state.
 */
export const NOXIA_EPOCH_UTC = '2077-01-01'
export const NOXIA_BASELINE_TICK = 1
export const NOXIA_TICKS_PER_DAY = 24

export function gameDateFromCoreTick(tick: unknown): { date: string; day: number } | null {
  if (typeof tick !== 'number' || !Number.isSafeInteger(tick) || tick < NOXIA_BASELINE_TICK) return null
  const day = Math.floor((tick - NOXIA_BASELINE_TICK) / NOXIA_TICKS_PER_DAY)
  const timestamp = Date.UTC(2077, 0, 1) + day * 86_400_000
  if (!Number.isFinite(timestamp)) return null
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return null
  return { date: new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(date), day }
}
