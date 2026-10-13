// lib/game/population/relocation.ts
// NOXIA-LIVING-0009 — when a person wants to move home or change workplace.
//
// A pure, day-level decision. It only says that someone wants to go and where
// to; carrying it out belongs to whoever owns housing and jobs.

import type { NeedCode } from './types'

export type RelocationKind = 'home' | 'work'

export interface RelocationOption {
  locationId: string
  tileEntityId: string
  /** Free places. Options without room are ignored. */
  freePlaces: number
  /** 0..1 supply of that settlement. */
  supply: number
  /** Mean faded affinity (0..1, 0.5 = strangers) towards the people already there. */
  affinityToResidents: number
  /** How many of the person's close ties are there. */
  closeTies: number
}

export interface RelocationInput {
  personId: string
  tick: number
  kind: RelocationKind
  needs: Partial<Record<NeedCode, number>>
  current: {
    locationId: string
    tileEntityId: string | null
    supply: number
    /** Mean faded affinity towards the people sharing the current place; 0.5 if alone. */
    affinityToResidents: number
    closeTies: number
    /** Current rent burden, 0..1+ of one billing period income. Home decisions only. */
    rentBurden?: number
    /** Current occupied places / capacity, 0..1. Home decisions only. */
    occupancyRatio?: number
    /** Security of current tenure, 0..1. Home decisions only. */
    tenureSecurity?: number
    /** Normalized commute burden, 0..1. Keep 0 until a grounded route is available. */
    commuteBurden?: number
  }
  /** Tick of the last move of this kind, or null. */
  lastMoveTick: number | null
  options: RelocationOption[]
}

export interface RelocationDecision {
  move: boolean
  discontent: number
  /** Strongest reason for the discontent. */
  reason: 'monotony' | 'bad_company' | 'scarcity' | 'rent_strain' | 'crowding' | 'insecurity' | 'commute' | 'none'
  target: RelocationOption | null
  cooldownBlocked: boolean
  components: {
    monotony: number
    badCompany: number
    scarcity: number
    rentStrain: number
    crowding: number
    insecurity: number
    commute: number
    roots: number
  }
}

/** People do not move again right away. */
export const RELOCATION_COOLDOWN_TICKS = 24 * 360
export const RELOCATION_THRESHOLD = 0.5

const clamp01 = (value: number | undefined, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
const round = (value: number): number => Math.round(value * 1_000_000) / 1_000_000

function attraction(option: RelocationOption): number {
  return 0.45 * clamp01(option.supply, 1) + 0.35 * clamp01(option.affinityToResidents, 0.5) + 0.2 * Math.min(1, option.closeTies / 2)
}

export function decideRelocation(input: RelocationInput): RelocationDecision {
  const monotony = 1 - clamp01(input.needs.variety, 1)
  const badCompany = clamp01((0.5 - clamp01(input.current.affinityToResidents, 0.5)) * 2)
  const scarcity = 1 - clamp01(input.current.supply, 1)
  // Having close friends here holds people.
  const roots = Math.min(1, input.current.closeTies / 2)

  const rawBurden = Number(input.current.rentBurden ?? 0)
  const rentBurden = Number.isFinite(rawBurden) ? Math.max(0, rawBurden) : 1
  // Below 25% of billing-period income rent is not a relocation pressure;
  // 50% or more is full strain.
  const rentStrain = input.kind === 'home' ? clamp01((rentBurden - 0.25) / 0.25) : 0
  // Crowding begins only above 65% occupancy and reaches full pressure at capacity.
  const crowding = input.kind === 'home' ? clamp01((clamp01(input.current.occupancyRatio, 0) - 0.65) / 0.35) : 0
  const insecurity = input.kind === 'home' ? 1 - clamp01(input.current.tenureSecurity, 1) : 0
  const commute = input.kind === 'home' ? clamp01(input.current.commuteBurden, 0) : 0

  const components = {
    monotony: round(monotony),
    badCompany: round(badCompany),
    scarcity: round(scarcity),
    rentStrain: round(rentStrain),
    crowding: round(crowding),
    insecurity: round(insecurity),
    commute: round(commute),
    roots: round(roots),
  }

  // Work relocation keeps the established rule. Housing uses a broader set of
  // pressures and deliberately gives monotony a smaller role.
  const weighted = input.kind === 'home'
    ? 0.35 * monotony + 0.85 * badCompany + 0.7 * scarcity
      + 0.65 * rentStrain + 0.55 * crowding + 0.35 * insecurity
      + 0.45 * commute - 0.15 * roots
    : 0.75 * monotony + 0.9 * badCompany + 0.7 * scarcity - 0.1 * roots
  const discontent = round(clamp01(weighted))

  const reasons: [RelocationDecision['reason'], number][] = input.kind === 'home'
    ? [
        ['bad_company', 0.85 * badCompany],
        ['scarcity', 0.7 * scarcity],
        ['rent_strain', 0.65 * rentStrain],
        ['crowding', 0.55 * crowding],
        ['commute', 0.45 * commute],
        ['insecurity', 0.35 * insecurity],
        ['monotony', 0.35 * monotony],
      ]
    : [['monotony', 0.75 * monotony], ['bad_company', 0.9 * badCompany], ['scarcity', 0.7 * scarcity]]
  const reason = discontent > 0 ? reasons.sort((a, b) => b[1] - a[1])[0][0] : 'none'
  const base = { move: false, discontent, reason, target: null, cooldownBlocked: false, components } satisfies RelocationDecision

  if (discontent < RELOCATION_THRESHOLD) return base
  // A serious shortage overrides the wish to stay put for a while.
  const fleeing = reason === 'scarcity' && scarcity >= 0.5
  if (!fleeing && input.lastMoveTick != null && input.tick - input.lastMoveTick < RELOCATION_COOLDOWN_TICKS) {
    return { ...base, cooldownBlocked: true }
  }

  const here = 0.45 * clamp01(input.current.supply, 1) + 0.35 * clamp01(input.current.affinityToResidents, 0.5) + 0.2 * roots
  const candidates = input.options
    .filter((option) => option.freePlaces > 0 && !(option.locationId === input.current.locationId && option.tileEntityId === input.current.tileEntityId))
    .map((option) => ({ option, score: attraction(option) }))
    // Monotony alone is satisfied by any change; otherwise the new place must be better.
    .filter((entry) => reason === 'monotony' || entry.score > here)
    .sort((a, b) => (b.score - a.score) || a.option.locationId.localeCompare(b.option.locationId) || a.option.tileEntityId.localeCompare(b.option.tileEntityId))
  const target = candidates[0]?.option ?? null
  return target ? { ...base, move: true, target } : base
}
