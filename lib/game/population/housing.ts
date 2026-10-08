// lib/game/population/housing.ts
// NOXIA-LIVING-0010 — how a person comes by a place to live.
//
// Pure rules for the housing market: renting, owner-occupied property, hotels
// and having nowhere to live. They mirror the live data model
// (person_tenancies, tile_entities.asking_price, role_wage_rates): rent is
// billed every 720 ticks, a buyer keeps a reserve of seven days' wages.
//
// This is where unequal Spielraum comes from: what is open to a person depends
// on wage and savings, and whoever owns the dwellings sets the price.

export type Tenure = 'provided' | 'rented' | 'owned' | 'hotel' | 'none'
export type DwellingKind = 'rental' | 'house' | 'hotel'
export type OwnerKind = 'state' | 'landlord' | 'person'

export interface Dwelling {
  id: string
  locationId: string
  tileEntityId: string | null
  kind: DwellingKind
  /** Places for residents or guests. */
  capacity: number
  ownerKind: OwnerKind
  /** Landlord actor or owning person. */
  ownerId: string
  /** Rent per place and billing interval (rentals). */
  rent: number | null
  /** The rent this dwelling started with; public housing never leaves it. */
  baseRent: number | null
  /** Price of the whole dwelling while it is for sale (houses). */
  askingPrice: number | null
  /** Price per place and night (hotels). */
  nightlyRate: number | null
}

/** Same interval as person_tenancies.billing_interval_ticks. */
export const BILLING_INTERVAL_TICKS = 720
const BILLING_DAYS = BILLING_INTERVAL_TICKS / 24
/** A rent above this share of the wage is not taken on. */
export const MAX_RENT_BURDEN = 0.4
/** A tenant paying more than this share looks for something cheaper. */
export const STRAINED_RENT_BURDEN = 0.5
/** Same reserve as run_npc_property_market: seven days' wages stay untouched. */
export const PURCHASE_RESERVE_DAYS = 7
/** Unpaid billing periods after which a tenant loses the dwelling. */
export const EVICTION_ARREARS = 2
/** A hotel is only taken with money for at least this many nights. */
export const HOTEL_MIN_NIGHTS = 3

const clamp01 = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
const round = (value: number): number => Math.round(value * 10_000) / 10_000

/** Share of the wage of one billing interval that the rent takes. */
export function rentBurden(rent: number, dailyWage: number): number {
  if (rent <= 0) return 0
  return dailyWage > 0 ? round(rent / (dailyWage * BILLING_DAYS)) : Number.POSITIVE_INFINITY
}

export interface Means {
  wealth: number
  dailyWage: number
}

export type HousingOffer =
  | { tenure: 'rented'; dwelling: Dwelling; cost: number; burden: number }
  | { tenure: 'owned'; dwelling: Dwelling; cost: number; burden: 0 }
  | { tenure: 'hotel'; dwelling: Dwelling; cost: number; burden: number }

/** What this dwelling would be for this person, or null if they cannot have it. */
export function housingOffer(dwelling: Dwelling, means: Means, freePlaces: number): HousingOffer | null {
  if (freePlaces <= 0) return null
  if (dwelling.kind === 'rental' && dwelling.rent != null) {
    const burden = rentBurden(dwelling.rent, means.dailyWage)
    return burden <= MAX_RENT_BURDEN ? { tenure: 'rented', dwelling, cost: dwelling.rent, burden } : null
  }
  if (dwelling.kind === 'house' && dwelling.askingPrice != null) {
    const reserve = means.dailyWage * PURCHASE_RESERVE_DAYS
    return means.wealth >= dwelling.askingPrice + reserve ? { tenure: 'owned', dwelling, cost: dwelling.askingPrice, burden: 0 } : null
  }
  if (dwelling.kind === 'hotel' && dwelling.nightlyRate != null) {
    if (means.wealth < dwelling.nightlyRate * HOTEL_MIN_NIGHTS) return null
    return { tenure: 'hotel', dwelling, cost: dwelling.nightlyRate, burden: means.dailyWage > 0 ? round(dwelling.nightlyRate / means.dailyWage) : Number.POSITIVE_INFINITY }
  }
  return null
}

export interface HousingCandidate {
  offer: HousingOffer
  /** 0..1 supply of the settlement. */
  supply: number
  /** Mean faded affinity towards the people living there; 0.5 for strangers or an empty place. */
  affinityToResidents: number
  closeTies: number
  /** Whether the person could work in that settlement (has or can get a job there). */
  workReachable: boolean
}

export interface HousingChoiceInput {
  current: { tenure: Tenure; dwellingId: string | null; locationId: string; burden: number; supply: number; affinityToResidents: number; closeTies: number }
  /** The person must leave: no home, a hotel, or an eviction. */
  mustMove: boolean
  /** The person wants to move for a reason of their own (see relocation.decideRelocation). */
  wantsToMove: boolean
  candidates: HousingCandidate[]
}

const TENURE_SECURITY: Record<Tenure, number> = { owned: 1, provided: 0.8, rented: 0.7, hotel: 0.25, none: 0 }

/** How good a housing situation is: the place, the company, what it costs and how secure it is. */
function housingValue(parts: { supply: number; affinity: number; closeTies: number; burden: number; tenure: Tenure }): number {
  return 0.3 * clamp01(parts.supply) + 0.2 * clamp01(parts.affinity) + 0.1 * Math.min(1, parts.closeTies / 2)
    + 0.25 * TENURE_SECURITY[parts.tenure] - 0.3 * clamp01(parts.burden)
}

/**
 * Picks where to live next, or null to stay. Someone who must move takes the
 * best of what is on offer, a hotel if need be. Everyone else only moves to
 * something clearly better, and never into a hotel by choice.
 */
export function chooseHousing(input: HousingChoiceInput): HousingCandidate | null {
  const here = housingValue({ supply: input.current.supply, affinity: input.current.affinityToResidents, closeTies: input.current.closeTies, burden: input.current.burden, tenure: input.current.tenure })
  const ranked = input.candidates
    .filter((candidate) => candidate.workReachable && candidate.offer.dwelling.id !== input.current.dwellingId)
    .filter((candidate) => input.mustMove || candidate.offer.tenure !== 'hotel')
    .map((candidate) => ({
      candidate,
      value: housingValue({ supply: candidate.supply, affinity: candidate.affinityToResidents, closeTies: candidate.closeTies, burden: candidate.offer.burden, tenure: candidate.offer.tenure }),
    }))
    .sort((a, b) => (b.value - a.value) || a.candidate.offer.dwelling.id.localeCompare(b.candidate.offer.dwelling.id))
  const best = ranked[0]
  if (!best) return null
  if (input.mustMove) return best.candidate
  // A wish to leave lowers the bar; without one the new place has to be clearly better.
  const margin = input.wantsToMove ? 0 : 0.12
  return best.value > here + margin ? best.candidate : null
}

export interface BillingResult {
  paid: boolean
  wealth: number
  arrears: number
  evicted: boolean
}

/** One rent bill. Those who cannot pay fall behind and eventually lose the dwelling. */
export function settleRent(rent: number, wealth: number, arrears: number): BillingResult {
  if (wealth >= rent) return { paid: true, wealth: wealth - rent, arrears: 0, evicted: false }
  const next = arrears + 1
  return { paid: false, wealth, arrears: next, evicted: next >= EVICTION_ARREARS }
}

export const RENT_STEP = 0.05
const MIN_RENT_FACTOR = 0.5
const MAX_RENT_FACTOR = 3

/**
 * The landlord's side: rent follows demand. In a nearly full settlement a
 * private landlord raises it, an empty dwelling gets cheaper. Public housing
 * keeps its rent. This is power in the canon's sense: it changes what is open
 * to others.
 */
export function adjustRent(dwelling: Dwelling, market: { settlementOccupancy: number; vacantPlaces: number }): number | null {
  if (dwelling.kind !== 'rental' || dwelling.rent == null || dwelling.baseRent == null) return dwelling.rent
  if (dwelling.ownerKind === 'state') return dwelling.baseRent
  let rent = dwelling.rent
  if (market.vacantPlaces >= dwelling.capacity) rent *= 1 - RENT_STEP
  else if (market.settlementOccupancy >= 0.9 && market.vacantPlaces === 0) rent *= 1 + RENT_STEP
  return Math.round(Math.max(dwelling.baseRent * MIN_RENT_FACTOR, Math.min(dwelling.baseRent * MAX_RENT_FACTOR, rent)))
}

/** How well the person is sheltered, 0..1: scales rest and how safe life feels. */
export function shelterQuality(tenure: Tenure): number {
  return tenure === 'none' ? 0.3 : tenure === 'hotel' ? 0.9 : 1
}

/** How secure the person's hold on their place is, 0..1: part of their Spielraum. */
export function tenureSecurity(tenure: Tenure, arrears = 0): number {
  return round(TENURE_SECURITY[tenure] * (arrears > 0 ? 0.6 : 1))
}

// ── The landlord decides ────────────────────────────────────────────────────

export type HousingRefusal = 'no_room' | 'income_too_low' | 'past_arrears' | 'owner_dislikes'

export interface HousingApplication {
  dwelling: Dwelling
  freePlaces: number
  applicant: Means & {
    /** Ticks since the applicant was last evicted, or null if never. */
    ticksSinceEviction: number | null
  }
  /** Faded affinity of an owning person towards the applicant; ignored for institutions. */
  ownerAffinity?: number
}

export interface HousingDecision {
  granted: boolean
  reason: 'granted' | HousingRefusal
}

/** How long an eviction counts against an applicant with a private landlord. */
export const EVICTION_MEMORY_TICKS = 24 * 360
/** A deposit of this many rents outweighs a past eviction. */
const DEPOSIT_RENTS = 3
/** An owner who lives in or personally lets the dwelling will not take someone they dislike. */
const OWNER_MIN_AFFINITY = 0.35

/**
 * Whether the owner lets this person in. A dwelling that exists but is not
 * given to you is not part of your Spielraum.
 *
 * Public housing only checks for room. A private landlord also looks at income
 * and at a recent eviction; an owner who is a person may simply not want you.
 * Hotels take anyone who can pay.
 */
export function landlordDecision(application: HousingApplication): HousingDecision {
  const { dwelling, applicant } = application
  if (application.freePlaces <= 0) return { granted: false, reason: 'no_room' }
  if (dwelling.kind !== 'rental' || dwelling.rent == null) return { granted: true, reason: 'granted' }
  if (dwelling.ownerKind === 'state') return { granted: true, reason: 'granted' }
  if (rentBurden(dwelling.rent, applicant.dailyWage) > MAX_RENT_BURDEN) return { granted: false, reason: 'income_too_low' }
  const recentEviction = applicant.ticksSinceEviction != null && applicant.ticksSinceEviction < EVICTION_MEMORY_TICKS
  if (recentEviction && applicant.wealth < dwelling.rent * DEPOSIT_RENTS) return { granted: false, reason: 'past_arrears' }
  if (dwelling.ownerKind === 'person' && application.ownerAffinity != null && application.ownerAffinity < OWNER_MIN_AFFINITY) {
    return { granted: false, reason: 'owner_dislikes' }
  }
  return { granted: true, reason: 'granted' }
}
