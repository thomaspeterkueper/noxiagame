// lib/game/population/spielraum.ts
// NOXIA-OMNI-0001 — Spielraum as a measured quantity.
//
// Omnizedenz asks how many courses are really open to a person, not how the
// person feels. This module turns that into numbers the research run can plot.
// It is an evaluation only: nothing here changes what anyone decides.
//
// The operationalisation is a choice, not a derivation. Three components, each 0..1:
// - action:     how many things the person could reasonably do right now
// - relational: how many people the person can turn to
// - place:      how many other homes and workplaces are open to the person,
//               scaled by how well the settlement is supplied
// The canon's test dimensions map to: the present value, its trend over time,
// and whether it comes back after damage (`spielraumRegeneration`).

import type { PersonRelationship, PopulationAction } from './types'

export interface ScoredOption {
  action: PopulationAction
  score: number
}

export interface SpielraumComponents {
  action: number
  relational: number
  place: number
  /** Weighted combination of the three, 0..1. */
  total: number
}

/** An option counts as a real alternative if it is this close to the best one. */
export const VIABLE_MARGIN = 0.35
const ACTION_SATURATION = 5
const RELATIONAL_SATURATION = 6
const PLACE_SATURATION = 12
/** Savings horizon after which lack of current income hardly constrains movement. */
export const MATERIAL_RUNWAY_DAYS = 90
const WEIGHTS = { action: 0.4, relational: 0.35, place: 0.25 }

const clamp01 = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
const round = (value: number): number => Math.round(value * 10_000) / 10_000
/** 0 for nothing, approaching 1 as the count grows: the fifth option adds less than the second. */
const saturating = (count: number, scale: number): number => 1 - Math.exp(-Math.max(0, count) / scale)

/**
 * Real alternatives among the scored actions. A starving or exhausted person
 * has one dominant option and therefore hardly any room, although every action
 * is technically still available.
 */
export function viableOptions(options: readonly ScoredOption[], margin = VIABLE_MARGIN): number {
  const available = options.filter((option) => option.score > -1)
  if (!available.length) return 0
  const best = Math.max(...available.map((option) => option.score))
  return available.filter((option) => option.score >= best - margin).length
}

export function actionSpielraum(options: readonly ScoredOption[]): number {
  // One viable option is no choice at all.
  return round(saturating(viableOptions(options) - 1, ACTION_SATURATION / 2))
}

/**
 * People one can turn to. A close tie opens more than an acquaintance; a
 * strained relationship opens nothing and closes a little.
 */
export function relationalSpielraum(relationships: readonly Pick<PersonRelationship, 'trust' | 'affinity' | 'familiarity'>[]): number {
  let openness = 0
  for (const relation of relationships) {
    if (relation.trust < 0.4 || relation.affinity < 0.4) { openness -= 0.5; continue }
    if (relation.familiarity < 0.2) continue
    openness += relation.trust >= 0.56 && relation.affinity >= 0.58 ? 2 : 1
  }
  return round(saturating(openness, RELATIONAL_SATURATION))
}

export interface MaterialMeans {
  /** Liquid credits currently available to the person. */
  wealth: number
  /** Income that is actually being paid now; 0 while unpaid or unemployed. */
  dailyIncome: number
  /** Essential daily expenditure. */
  essentialDailyCost: number
}

/**
 * Ability to carry a transition economically, 0..1.
 *
 * Current income that covers essentials keeps material access open. Without it,
 * savings provide runway instead. The horizon is deliberately long (90 days):
 * a short emergency reserve does not make every nominal offer a durable option.
 * This is measurement only; it does not change market decisions.
 */
export function materialAccess(means: MaterialMeans): number {
  const cost = Math.max(0, means.essentialDailyCost)
  if (cost === 0) return 1
  const incomeCoverage = clamp01(Math.max(0, means.dailyIncome) / cost)
  const runwayDays = Math.max(0, means.wealth) / cost
  const runway = 1 - Math.exp(-runwayDays / MATERIAL_RUNWAY_DAYS)
  return round(Math.max(incomeCoverage, runway))
}

/** Other homes and workplaces that are both institutionally and materially reachable. */
export function placeSpielraum(openPlaces: number, supply = 1, material = 1): number {
  return round(saturating(openPlaces, PLACE_SATURATION) * (0.3 + 0.7 * clamp01(supply)) * clamp01(material))
}

export function combineSpielraum(parts: { action: number; relational: number; place: number }): SpielraumComponents {
  const total = WEIGHTS.action * parts.action + WEIGHTS.relational * parts.relational + WEIGHTS.place * parts.place
  return { action: round(parts.action), relational: round(parts.relational), place: round(parts.place), total: round(clamp01(total)) }
}

/** 0 = everyone has the same room, towards 1 = a few have nearly all of it. */
export function gini(values: readonly number[]): number {
  const sorted = [...values].filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  const sum = sorted.reduce((total, value) => total + value, 0)
  if (sorted.length < 2 || sum <= 0) return 0
  let weighted = 0
  sorted.forEach((value, index) => { weighted += (index + 1) * value })
  return round((2 * weighted) / (sorted.length * sum) - (sorted.length + 1) / sorted.length)
}

export interface RegenerationResult {
  /** Mean before the damage. */
  before: number
  /** Lowest value from the start of the damage on. */
  lowest: number
  /** Share of the earlier room lost at the lowest point, 0..1. */
  loss: number
  /** Days from the end of the damage until room is back to `threshold` of the earlier level; null if never. */
  daysToRegenerate: number | null
  /** Mean over the last `window` days of the series. */
  after: number
}

/**
 * Regenerability in the canon's sense: not whether the earlier state returns,
 * but whether room of comparable size arises again from the new situation.
 */
export function spielraumRegeneration(
  series: readonly number[],
  damage: { startDay: number; endDay: number },
  options: { window?: number; threshold?: number } = {},
): RegenerationResult {
  const window = options.window ?? 30
  const threshold = options.threshold ?? 0.95
  const mean = (values: readonly number[]): number => values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0
  const before = mean(series.slice(Math.max(0, damage.startDay - window), damage.startDay))
  const lowest = Math.min(...series.slice(damage.startDay))
  let daysToRegenerate: number | null = null
  // A week's mean, so that one good day does not count as recovery.
  for (let day = damage.endDay; day + 7 <= series.length; day += 1) {
    if (mean(series.slice(day, day + 7)) >= before * threshold) { daysToRegenerate = day - damage.endDay; break }
  }
  return {
    before: round(before),
    lowest: round(lowest),
    loss: round(before > 0 ? clamp01((before - lowest) / before) : 0),
    daysToRegenerate,
    after: round(mean(series.slice(-window))),
  }
}
