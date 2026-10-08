// lib/game/population/circadian.ts
// NOXIA-LIVING-0007 — deterministic day rhythm for persons.
//
// One tick is one hour. Without a day rhythm people rested in single scattered
// ticks, never slept through a night and re-entered co-location with the same
// colleagues several times a day. This module gives every person a stable
// sleep window and a work shift. It is pure: same tick + same person = same state.

export const DAY_TICKS = 24

export interface CircadianProfile {
  /** Local hour (0..23) at which the sleep window opens. */
  sleepStartHour: number
  /** Length of the sleep window in hours. */
  sleepHours: number
}

export interface CircadianState {
  localHour: number
  inSleepWindow: boolean
  /** 0..1. 1 inside the sleep window, a lower value in the hour before it. */
  sleepDrive: number
  /** Hours since the end of the last sleep window, 0..(24 - sleepHours). */
  hoursAwake: number
  /** 0..1 work obligation for a person with a job at this hour. */
  workObligation: number
}

const WIND_DOWN_DRIVE = 0.35
const SHIFT_START_AFTER_WAKE = 1
const SHIFT_HOURS = 8

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const mod = (value: number, base: number): number => ((value % base) + base) % base

/**
 * Chronotype spreads bedtimes over 21:00..01:00 so a settlement does not fall
 * asleep in one tick. Optional traits:
 * - `chronotype` 0 (early) .. 1 (late) overrides the id-derived value
 * - `sleep_need_hours` 6..9 (default 8)
 * - `work_shift: 'night'` moves the whole rhythm by twelve hours
 */
export function circadianProfile(personId: string, traits?: Record<string, unknown> | null): CircadianProfile {
  const chronotype = typeof traits?.chronotype === 'number' && Number.isFinite(traits.chronotype)
    ? Math.max(0, Math.min(1, Number(traits.chronotype)))
    : (hash(`chronotype:${personId}`) % 5) / 4
  const need = typeof traits?.sleep_need_hours === 'number' && Number.isFinite(traits.sleep_need_hours)
    ? Math.max(6, Math.min(9, Math.round(Number(traits.sleep_need_hours))))
    : 8
  const nightShift = traits?.work_shift === 'night' ? 12 : 0
  return { sleepStartHour: mod(21 + Math.round(chronotype * 4) + nightShift, DAY_TICKS), sleepHours: need }
}

/** `hourOffset` is reserved for per-location local time; settlements currently share colony time. */
export function circadianState(tick: number, profile: CircadianProfile, hourOffset = 0): CircadianState {
  const localHour = mod(Math.trunc(tick) + hourOffset, DAY_TICKS)
  const sinceSleepStart = mod(localHour - profile.sleepStartHour, DAY_TICKS)
  const inSleepWindow = sinceSleepStart < profile.sleepHours
  const hoursAwake = inSleepWindow ? 0 : sinceSleepStart - profile.sleepHours
  const windingDown = !inSleepWindow && sinceSleepStart === DAY_TICKS - 1
  const onShift = !inSleepWindow && hoursAwake >= SHIFT_START_AFTER_WAKE && hoursAwake < SHIFT_START_AFTER_WAKE + SHIFT_HOURS
  return {
    localHour,
    inSleepWindow,
    sleepDrive: inSleepWindow ? 1 : windingDown ? WIND_DOWN_DRIVE : 0,
    hoursAwake,
    workObligation: inSleepWindow ? 0 : onShift ? 0.85 : hoursAwake < SHIFT_START_AFTER_WAKE ? 0.35 : 0.2,
  }
}

/** Action codes that mean "asleep": no encounters, no conversation, no perception. */
export const SLEEP_ACTION_CODES: readonly string[] = ['sleep', 'sleep_and_consolidate']

export function isAsleepAction(lastAction: string | null | undefined): boolean {
  return typeof lastAction === 'string' && SLEEP_ACTION_CODES.includes(lastAction)
}
