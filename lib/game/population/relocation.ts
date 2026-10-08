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
  }
  /** Tick of the last move of this kind, or null. */
  lastMoveTick: number | null
  options: RelocationOption[]
}

export interface RelocationDecision {
  move: boolean
  discontent: number
  /** Strongest reason for the discontent. */
  reason: 'monotony' | 'bad_company' | 'scarcity' | 'none'
  target: RelocationOption | null
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
  const discontent = round(clamp01(0.75 * monotony + 0.9 * badCompany + 0.7 * scarcity - 0.1 * roots))
  const reasons: [RelocationDecision['reason'], number][] = [['monotony', 0.75 * monotony], ['bad_company', 0.9 * badCompany], ['scarcity', 0.7 * scarcity]]
  const reason = discontent > 0 ? reasons.sort((a, b) => b[1] - a[1])[0][0] : 'none'
  const stay: RelocationDecision = { move: false, discontent, reason, target: null }

  if (discontent < RELOCATION_THRESHOLD) return stay
  // A serious shortage overrides the wish to stay put for a while.
  const fleeing = reason === 'scarcity' && scarcity >= 0.5
  if (!fleeing && input.lastMoveTick != null && input.tick - input.lastMoveTick < RELOCATION_COOLDOWN_TICKS) return stay

  const here = 0.45 * clamp01(input.current.supply, 1) + 0.35 * clamp01(input.current.affinityToResidents, 0.5) + 0.2 * roots
  const candidates = input.options
    .filter((option) => option.freePlaces > 0 && !(option.locationId === input.current.locationId && option.tileEntityId === input.current.tileEntityId))
    .map((option) => ({ option, score: attraction(option) }))
    // Monotony alone is satisfied by any change; otherwise the new place must be better.
    .filter((entry) => reason === 'monotony' || entry.score > here)
    .sort((a, b) => (b.score - a.score) || a.option.locationId.localeCompare(b.option.locationId) || a.option.tileEntityId.localeCompare(b.option.tileEntityId))
  const target = candidates[0]?.option ?? null
  return target ? { move: true, discontent, reason, target } : stay
}
