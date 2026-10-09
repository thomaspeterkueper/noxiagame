// lib/game/population/housingShadow.ts
// NOXIA-LIVING-0010, stage 4: the housing decision in shadow mode.
//
// Pure: takes one person and the dwellings that exist, runs the same rules the
// research run uses (housingOffer → decideRelocation → chooseHousing →
// landlordDecision) and says what would happen. Nothing is carried out here.

import {
  chooseHousing, housingOffer, landlordDecision, rentBurden,
  type Dwelling, type HousingCandidate, type Tenure,
} from './housing'
import { decideRelocation } from './relocation'
import type { NeedCode } from './types'

export interface ShadowDwelling {
  dwelling: Dwelling
  residents: string[]
  /** 0..1 supply of the settlement the dwelling is in. */
  supply: number
}

export interface ShadowPerson {
  id: string
  locationId: string
  dwellingId: string | null
  tenure: Tenure
  wealth: number
  dailyWage: number
  needs: Partial<Record<NeedCode, number>>
  /** Faded affinity 0..1 towards other people by id. */
  affinity: Record<string, number>
  /** Ids of close ties. */
  closeTies: string[]
  lastMoveTick: number | null
  ticksSinceEviction: number | null
}

export type ShadowOutcome = 'stay' | 'no_offer' | 'granted' | 'refused'

export interface ShadowDecision {
  personId: string
  tick: number
  outcome: ShadowOutcome
  reason: string
  targetDwellingId: string | null
  gatekeeperId: string | null
  mustMove: boolean
  wantsToMove: boolean
  /** Dwellings with a free place the person could pay for. */
  affordablePlaces: number
  /** Of those, the ones the owner would also grant. */
  accessiblePlaces: number
  /** Only a granted move into a private rental could be handed to move_person_to_market_rental. */
  executable: boolean
}

const mean = (values: number[]): number => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0.5)

export function shadowHousingDecision(person: ShadowPerson, inventory: readonly ShadowDwelling[], tick: number): ShadowDecision {
  const company = (residents: string[]) => {
    const others = residents.filter((id) => id !== person.id)
    return { affinity: mean(others.map((id) => person.affinity[id] ?? 0.5)), close: others.filter((id) => person.closeTies.includes(id)).length }
  }
  const means = { wealth: person.wealth, dailyWage: person.dailyWage }
  const current = inventory.find((entry) => entry.dwelling.id === person.dwellingId) ?? null
  const here = company(current?.residents ?? [])
  const hereSupply = current?.supply ?? inventory.find((entry) => entry.dwelling.locationId === person.locationId)?.supply ?? 1

  const offered = inventory
    .filter((entry) => entry.dwelling.id !== person.dwellingId)
    .map((entry) => ({ entry, offer: housingOffer(entry.dwelling, means, entry.dwelling.capacity - entry.residents.length) }))
    .filter((item): item is { entry: ShadowDwelling; offer: NonNullable<ReturnType<typeof housingOffer>> } => item.offer !== null)
  const owner = (entry: ShadowDwelling) => landlordDecision({
    dwelling: entry.dwelling, freePlaces: entry.dwelling.capacity - entry.residents.length,
    applicant: { ...means, ticksSinceEviction: person.ticksSinceEviction },
    ownerAffinity: undefined,
  })
  const accessible = offered.filter((item) => owner(item.entry).granted)

  const candidates: HousingCandidate[] = offered.map(({ entry, offer }) => {
    const there = company(entry.residents)
    // There is no live job market yet: work is only reachable where the person already is.
    return { offer, supply: entry.supply, affinityToResidents: there.affinity, closeTies: there.close, workReachable: entry.dwelling.locationId === person.locationId }
  })
  const mustMove = person.tenure === 'none' || person.tenure === 'hotel'
  const wish = decideRelocation({
    personId: person.id, tick, kind: 'home', needs: person.needs,
    current: { locationId: person.locationId, tileEntityId: current?.dwelling.tileEntityId ?? '', supply: hereSupply, affinityToResidents: here.affinity, closeTies: here.close },
    lastMoveTick: person.lastMoveTick,
    options: candidates.filter((candidate) => candidate.workReachable && candidate.offer.tenure !== 'hotel').map((candidate) => {
      const entry = inventory.find((item) => item.dwelling.id === candidate.offer.dwelling.id)!
      return {
        locationId: entry.dwelling.locationId, tileEntityId: entry.dwelling.tileEntityId ?? entry.dwelling.id,
        freePlaces: entry.dwelling.capacity - entry.residents.length, supply: entry.supply,
        affinityToResidents: candidate.affinityToResidents, closeTies: candidate.closeTies,
      }
    }),
  })
  const base = {
    personId: person.id, tick, mustMove, wantsToMove: wish.move,
    affordablePlaces: offered.length, accessiblePlaces: accessible.length,
  }
  const rent = current?.dwelling.kind === 'rental' ? current.dwelling.rent ?? 0 : 0
  const pick = chooseHousing({
    current: { tenure: person.tenure, dwellingId: person.dwellingId, locationId: person.locationId, burden: Math.min(1, rentBurden(rent, person.dailyWage)), supply: hereSupply, affinityToResidents: here.affinity, closeTies: here.close },
    mustMove, wantsToMove: wish.move, candidates,
  })
  if (!pick) {
    const stuck = mustMove || wish.move
    return { ...base, outcome: stuck ? 'no_offer' : 'stay', reason: stuck ? (mustMove ? 'no_home' : wish.reason) : 'content', targetDwellingId: null, gatekeeperId: null, executable: false }
  }
  const target = inventory.find((entry) => entry.dwelling.id === pick.offer.dwelling.id)!
  const decision = owner(target)
  return {
    ...base,
    outcome: decision.granted ? 'granted' : 'refused',
    reason: decision.granted ? (mustMove ? 'no_home' : wish.move ? wish.reason : 'better_home') : decision.reason,
    targetDwellingId: target.dwelling.id, gatekeeperId: target.dwelling.ownerId,
    executable: decision.granted && pick.offer.tenure === 'rented' && target.dwelling.ownerKind !== 'state' && (target.dwelling.rent ?? 0) > 0,
  }
}
