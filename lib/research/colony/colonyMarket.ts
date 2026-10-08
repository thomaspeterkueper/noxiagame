// lib/research/colony/colonyMarket.ts
// Housing and job market for the research run (NOXIA-LIVING-0010, stage 2).
//
// Carries the pure rules of population/housing, employment and access through
// game years: wages, living costs, rent, purchase, hotels, arrears, eviction,
// landlords and employers who grant or refuse. Every grant, refusal and turned
// down offer is logged as an AccessRecord, so power shows up as an asymmetry in
// that log or not at all. Deterministic: no randomness, no wall clock.

import {
  BILLING_INTERVAL_TICKS, adjustRent, chooseHousing, housingOffer, landlordDecision, rentBurden, settleRent, shelterQuality,
  type Dwelling, type HousingCandidate, type HousingOffer, type Tenure,
} from '../../game/population/housing'
import { considerJobOffer, employerDecision, type Vacancy } from '../../game/population/employment'
import { gatekeeperPower, summarizeAccess, type AccessRecord, type AccessSummary, type GatekeeperPower } from '../../game/population/access'
import { decideRelocation, type RelocationKind } from '../../game/population/relocation'
import { gini } from '../../game/population/spielraum'
import type { NeedCode } from '../../game/population/types'

export interface MarketJob extends Vacancy {
  /** How many people this workplace employs at most. */
  positions: number
}

export interface MarketEmployer {
  balance: number
  /** Credits the employer takes in per day, from whatever it sells or is funded with. */
  dailyIncome: number
}

export interface MarketSetup {
  /** Each dwelling needs a unique tileEntityId; it is the home place people are assigned to. */
  dwellings: Dwelling[]
  /** Each job needs a unique tileEntityId; it is the workplace people are assigned to. */
  jobs: MarketJob[]
  people?: Record<string, { wealth?: number; skills?: Record<string, number>; jobId?: string | null; dwellingId?: string | null }>
  /** Employers missing here can always pay (e.g. a funded public service). */
  employers?: Record<string, MarketEmployer>
  /** Credits a person spends per day on living. Default 25. */
  livingCost?: number
}

/** What the market needs from the colony run. */
export interface MarketHost {
  personIds: string[]
  location(personId: string): string
  home(personId: string): string | null
  work(personId: string): string | null
  setHome(personId: string, place: { locationId: string; tileEntityId: string } | null): void
  setWork(personId: string, place: { locationId: string; tileEntityId: string } | null): void
  moveTo(personId: string, locationId: string): void
  needs(personId: string): Partial<Record<NeedCode, number>>
  adjustNeed(personId: string, code: NeedCode, delta: number): void
  /** Mean faded affinity towards `others` and how many of them are close ties. */
  company(personId: string, others: string[], tick: number): { affinity: number; close: number }
  /** Faded affinity of one person towards another, if they know each other. */
  affinity(fromId: string, toId: string, tick: number): number | undefined
  supply(locationId: string): number
  lastMove(personId: string): number | null
}

export interface MarketDayRow {
  day: number
  wealthAvg: number
  wealthGini: number
  wageAvg: number
  unemployed: number
  /** Employed people whose employer could not pay today. */
  unpaid: number
  homeless: number
  hotelGuests: number
  owners: number
  renters: number
  /** Mean rent of occupied private rental places. */
  rentAvg: number
  evictions: number
  quits: number
  applications: number
  refusals: number
  declined: number
  housingMoves: number
  jobChanges: number
  /** Mean number of dwellings and jobs really open to a person. */
  openPlacesAvg: number
  /** People with nothing open to them at all. */
  noOpenPlaces: number
}

export interface MarketResult {
  days: MarketDayRow[]
  records: AccessRecord[]
  summary: AccessSummary
  power: GatekeeperPower[]
  money: {
    initial: number
    final: number
    employerIncomeEmission: number
    livingCostSink: number
    propertyBuybackEmission: number
    expectedDelta: number
    actualDelta: number
    unexplainedDelta: number
  }
  final: {
    wealth: Record<string, number>
    tenure: Record<string, Tenure>
    dailyWage: Record<string, number>
    rents: Record<string, number>
    /** Rent, sale and hotel income of owners who are not people of the colony. */
    ownerIncome: Record<string, number>
    employerBalance: Record<string, number>
  }
}

export interface MarketChange {
  kind: RelocationKind
  reason: string
  fromLocationId: string
  toLocationId: string
}

interface MarketPerson {
  id: string
  wealth: number
  skills: Record<string, number>
  jobId: string | null
  dwellingId: string | null
  tenure: Tenure
  arrears: number
  lastEvictionTick: number | null
  unpaidDays: number
  /** Dwellings and jobs that said no or were turned down, and until when that is remembered. */
  closedUntil: Map<string, number>
  lookDay: number
}

const DAY = 24
const BILLING_DAYS = BILLING_INTERVAL_TICKS / DAY
/** After this many days without pay a person looks for other work, after QUIT_DAYS they leave. */
const UNPAID_SEARCH_DAYS = 7
const UNPAID_QUIT_DAYS = 21
/** A refusal or a turned down offer is not tried again for this long. */
const CLOSED_TICKS = DAY * 30
/** Without a pressing reason people look at the market once a month and not right after a move. */
const SETTLE_TICKS = DAY * 90
const round = (value: number): number => Math.round(value * 100) / 100
const mean = (values: number[]): number => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0)

export function createMarket(setup: MarketSetup, host: MarketHost) {
  const dwellings = setup.dwellings.map((dwelling) => ({ ...dwelling }))
  const jobs = setup.jobs.map((job) => ({ ...job }))
  const dwellingByTile = new Map(dwellings.map((dwelling) => [dwelling.tileEntityId ?? dwelling.id, dwelling]))
  const dwellingById = new Map(dwellings.map((dwelling) => [dwelling.id, dwelling]))
  const jobByTile = new Map(jobs.map((job) => [job.tileEntityId ?? job.id, job]))
  const jobById = new Map(jobs.map((job) => [job.id, job]))
  const employers = new Map(Object.entries(setup.employers ?? {}).map(([id, employer]) => [id, { ...employer }]))
  const livingCost = setup.livingCost ?? 25
  const ownerIncome = new Map<string, number>()
  const records: AccessRecord[] = []
  const days: MarketDayRow[] = []
  let evictions = 0, quits = 0, applications = 0, refusals = 0, declined = 0, housingMoves = 0, jobChanges = 0, unpaidToday = 0
  let employerIncomeEmission = 0
  let livingCostSink = 0
  let propertyBuybackEmission = 0

  const tenureIn = (dwelling: Dwelling, personId: string): Tenure =>
    dwelling.kind === 'hotel' ? 'hotel'
      : dwelling.kind === 'house' ? (dwelling.ownerId === personId ? 'owned' : 'provided')
        : dwelling.ownerKind === 'state' && !dwelling.rent ? 'provided' : 'rented'

  const persons = host.personIds.map((id, index): MarketPerson => {
    const homeTile = host.home(id), workTile = host.work(id)
    const explicitDwellingId = setup.people?.[id]?.dwellingId
    const explicitJobId = setup.people?.[id]?.jobId
    const dwelling = explicitDwellingId !== undefined
      ? (explicitDwellingId ? dwellingById.get(explicitDwellingId) : undefined)
      : homeTile ? dwellingByTile.get(homeTile) : undefined
    const job = explicitJobId !== undefined
      ? (explicitJobId ? jobById.get(explicitJobId) : undefined)
      : workTile ? jobByTile.get(workTile) : undefined
    return {
      id,
      wealth: setup.people?.[id]?.wealth ?? (job?.dailyWage ?? 0) * 14,
      skills: setup.people?.[id]?.skills ?? {},
      jobId: job?.id ?? null,
      dwellingId: dwelling?.id ?? null,
      // A home the market does not know stays what it was: assigned, not traded.
      tenure: dwelling ? tenureIn(dwelling, id) : homeTile ? 'provided' : 'none',
      arrears: 0, lastEvictionTick: null, unpaidDays: 0, closedUntil: new Map(), lookDay: index % BILLING_DAYS,
    }
  })
  const personById = new Map(persons.map((person) => [person.id, person]))
  const initialMoney = persons.reduce((sum, person) => sum + person.wealth, 0)
    + [...employers.values()].reduce((sum, employer) => sum + employer.balance, 0)

  const residents = (dwellingId: string): string[] => persons.filter((person) => person.dwellingId === dwellingId).map((person) => person.id)
  const staff = (jobId: string): number => persons.filter((person) => person.jobId === jobId).length
  const wageOf = (person: MarketPerson): number => (person.jobId ? jobById.get(person.jobId)?.dailyWage ?? 0 : 0)
  const means = (person: MarketPerson) => ({ wealth: person.wealth, dailyWage: wageOf(person) })
  const freePlaces = (dwelling: Dwelling): number => {
    // A house is sold whole: it is on offer only while it stands empty and has a price.
    if (dwelling.kind === 'house') return dwelling.askingPrice != null && residents(dwelling.id).length === 0 ? dwelling.capacity : 0
    return dwelling.capacity - residents(dwelling.id).length
  }
  const credit = (ownerId: string, amount: number): void => {
    const owner = personById.get(ownerId)
    if (owner) owner.wealth += amount
    else ownerIncome.set(ownerId, (ownerIncome.get(ownerId) ?? 0) + amount)
  }
  const record = (entry: Omit<AccessRecord, 'origin'>): void => {
    records.push({ ...entry, origin: 'market' })
    if (entry.outcome === 'refused') { applications += 1; refusals += 1 }
    else if (entry.outcome === 'declined') declined += 1
    else applications += 1
  }

  const landlordSays = (person: MarketPerson, dwelling: Dwelling, tick: number) => landlordDecision({
    dwelling, freePlaces: freePlaces(dwelling),
    applicant: { ...means(person), ticksSinceEviction: person.lastEvictionTick == null ? null : tick - person.lastEvictionTick },
    ownerAffinity: dwelling.ownerKind === 'person' ? host.affinity(dwelling.ownerId, person.id, tick) : undefined,
  })
  const employerSays = (person: MarketPerson, job: MarketJob, tick: number) => employerDecision({
    vacancy: job, openPositions: job.positions - staff(job.id), applicant: { skills: person.skills },
    employerAffinity: job.employerKind === 'person' ? host.affinity(job.employerId, person.id, tick) : undefined,
  })
  /** Whether the person could work in that settlement: they already do, or someone there would hire them. */
  const workReachable = (person: MarketPerson, locationId: string, tick: number): boolean =>
    locationId === host.location(person.id) || !person.jobId
    || jobs.some((job) => job.locationId === locationId && solvent(job) && employerSays(person, job, tick).hired)

  /** Dwellings the person can pay for, whatever the owner would say. */
  const offers = (person: MarketPerson): HousingOffer[] => dwellings
    .filter((dwelling) => dwelling.id !== person.dwellingId)
    .map((dwelling) => housingOffer(dwelling, means(person), freePlaces(dwelling)))
    .filter((offer): offer is HousingOffer => offer !== null)

  /** An employer who cannot pay the wage has no position to offer. */
  const solvent = (job: MarketJob): boolean => { const employer = employers.get(job.employerId); return !employer || employer.balance >= job.dailyWage }
  const openJobs = (person: MarketPerson, anywhere: boolean): MarketJob[] => jobs
    .filter((job) => job.id !== person.jobId && job.positions - staff(job.id) > 0 && solvent(job))
    .filter((job) => anywhere || job.locationId === host.location(person.id))

  /** Places really open to the person: affordable, granted by the owner or employer, and liveable. */
  let openCache: { tick: number; counts: Map<string, number> } = { tick: -1, counts: new Map() }
  const openPlaces = (personId: string, tick: number): number => {
    if (openCache.tick !== tick) openCache = { tick, counts: new Map() }
    const known = openCache.counts.get(personId)
    if (known !== undefined) return known
    const count = countOpenPlaces(personId, tick)
    openCache.counts.set(personId, count)
    return count
  }
  const countOpenPlaces = (personId: string, tick: number): number => {
    const person = personById.get(personId)
    if (!person) return 0
    const homes = offers(person).filter((offer) => landlordSays(person, offer.dwelling, tick).granted && workReachable(person, offer.dwelling.locationId, tick)).length
    const work = openJobs(person, false).filter((job) => employerSays(person, job, tick).hired).length
    return homes + work
  }

  const leaveDwelling = (person: MarketPerson): void => {
    const old = person.dwellingId ? dwellingById.get(person.dwellingId) : undefined
    if (old && old.kind === 'house' && old.ownerId === person.id) {
      // The owner sells back at a loss; the house is on the market again.
      const price = Math.round((old.baseRent ?? 0) * 0.9)
      person.wealth += price
      // Research-market simplification: the abstract market buys the house back.
      // No payer account exists yet, so G1 classifies this explicitly as emission.
      propertyBuybackEmission += price
      old.ownerId = 'market'; old.ownerKind = 'landlord'; old.askingPrice = old.baseRent
    }
    person.dwellingId = null; person.tenure = 'none'; person.arrears = 0
  }
  const loseHome = (person: MarketPerson): void => { leaveDwelling(person); host.setHome(person.id, null) }
  const loseJob = (person: MarketPerson): void => { person.jobId = null; person.unpaidDays = 0; host.setWork(person.id, null) }

  const reviewHousing = (person: MarketPerson, tick: number, day: number): MarketChange | null => {
    const location = host.location(person.id)
    const current = person.dwellingId ? dwellingById.get(person.dwellingId) : undefined
    const here = host.company(person.id, current ? residents(current.id) : [], tick)
    const available = offers(person).filter((offer) => (person.closedUntil.get(offer.dwelling.id) ?? -1) <= tick)
    const candidates: HousingCandidate[] = available.map((offer) => {
      const there = host.company(person.id, residents(offer.dwelling.id), tick)
      return { offer, supply: host.supply(offer.dwelling.locationId), affinityToResidents: there.affinity, closeTies: there.close, workReachable: workReachable(person, offer.dwelling.locationId, tick) }
    })
    const mustMove = person.tenure === 'none' || person.tenure === 'hotel'
    // decideRelocation stays what it is: the decision to want a change, nothing more.
    const wish = decideRelocation({
      personId: person.id, tick, kind: 'home', needs: host.needs(person.id),
      current: { locationId: location, tileEntityId: current?.tileEntityId ?? '', supply: host.supply(location), affinityToResidents: here.affinity, closeTies: here.close },
      lastMoveTick: host.lastMove(person.id),
      options: candidates.filter((candidate) => candidate.offer.tenure !== 'hotel').map((candidate) => ({
        locationId: candidate.offer.dwelling.locationId, tileEntityId: candidate.offer.dwelling.tileEntityId ?? candidate.offer.dwelling.id,
        freePlaces: freePlaces(candidate.offer.dwelling), supply: candidate.supply, affinityToResidents: candidate.affinityToResidents, closeTies: candidate.closeTies,
      })),
    })
    const settled = host.lastMove(person.id) != null && tick - host.lastMove(person.id)! < SETTLE_TICKS
    if (!mustMove && !wish.move && (settled || day % BILLING_DAYS !== person.lookDay)) return null
    const rent = current?.kind === 'rental' ? current.rent ?? 0 : 0
    // Someone in a hotel has a roof: they look for a home, not for another hotel.
    const roofed = person.tenure === 'hotel' ? candidates.filter((candidate) => candidate.offer.tenure !== 'hotel') : candidates
    // Whoever has work looks for a home where the work is, and elsewhere only if there is none.
    const nearby = roofed.filter((candidate) => candidate.offer.dwelling.locationId === location)
    const eligible = mustMove && person.jobId && nearby.length ? nearby : roofed
    const pick = chooseHousing({
      current: { tenure: person.tenure, dwellingId: person.dwellingId, locationId: location, burden: Math.min(1, rentBurden(rent, wageOf(person))), supply: host.supply(location), affinityToResidents: here.affinity, closeTies: here.close },
      mustMove, wantsToMove: wish.move, candidates: eligible,
    })
    if (!pick) return null
    const dwelling = pick.offer.dwelling
    const decision = landlordSays(person, dwelling, tick)
    record({ tick, kind: 'housing', personId: person.id, targetId: dwelling.id, gatekeeperId: dwelling.ownerId, outcome: decision.granted ? 'granted' : 'refused', reason: decision.reason })
    if (!decision.granted) { person.closedUntil.set(dwelling.id, tick + CLOSED_TICKS); return null }

    leaveDwelling(person)
    if (pick.offer.tenure === 'owned') {
      person.wealth -= pick.offer.cost
      credit(dwelling.ownerId, pick.offer.cost)
      dwelling.baseRent = pick.offer.cost
      dwelling.ownerId = person.id; dwelling.ownerKind = 'person'; dwelling.askingPrice = null
    }
    person.dwellingId = dwelling.id
    person.tenure = pick.offer.tenure === 'rented' ? tenureIn(dwelling, person.id) : pick.offer.tenure
    host.setHome(person.id, { locationId: dwelling.locationId, tileEntityId: dwelling.tileEntityId ?? dwelling.id })
    if (dwelling.locationId !== location) {
      // Another settlement: the old job is gone, a new one has to be found there.
      if (person.jobId) loseJob(person)
      host.moveTo(person.id, dwelling.locationId)
    }
    housingMoves += 1
    return { kind: 'home', reason: mustMove ? (pick.offer.tenure === 'hotel' ? 'no_home_hotel' : 'no_home') : wish.move ? wish.reason : 'better_home', fromLocationId: location, toLocationId: dwelling.locationId }
  }

  const reviewJob = (person: MarketPerson, tick: number, day: number): MarketChange | null => {
    const location = host.location(person.id)
    const job = person.jobId ? jobById.get(person.jobId) : undefined
    const unpaid = person.unpaidDays >= UNPAID_SEARCH_DAYS
    const colleagues = job ? persons.filter((other) => other.jobId === job.id).map((other) => other.id) : []
    const here = host.company(person.id, colleagues, tick)
    const restless = !job || unpaid
    const vacancies = openJobs(person, !job)
      .filter((vacancy) => (person.closedUntil.get(vacancy.id) ?? -1) <= tick)
      // Nobody content with their work applies for a job they would not take.
      .filter((vacancy) => restless || vacancy.dailyWage >= wageOf(person) * 0.9)
    const wish = job ? decideRelocation({
      personId: person.id, tick, kind: 'work', needs: host.needs(person.id),
      current: { locationId: location, tileEntityId: job.tileEntityId ?? '', supply: host.supply(location), affinityToResidents: here.affinity, closeTies: here.close },
      lastMoveTick: host.lastMove(person.id),
      options: vacancies.map((vacancy) => {
        const there = host.company(person.id, persons.filter((other) => other.jobId === vacancy.id).map((other) => other.id), tick)
        return { locationId: vacancy.locationId, tileEntityId: vacancy.tileEntityId ?? vacancy.id, freePlaces: vacancy.positions - staff(vacancy.id), supply: host.supply(vacancy.locationId), affinityToResidents: there.affinity, closeTies: there.close }
      }),
    }) : null
    const wants = !job || unpaid || wish?.move === true
    if (!wants && day % BILLING_DAYS !== person.lookDay) return null
    // Work nearby comes first; the best wage decides among what is equally near.
    const near = (vacancy: MarketJob): number => (vacancy.locationId === location ? 0 : 1)
    const worthIt = wants ? vacancies : vacancies.filter((vacancy) => vacancy.dailyWage >= wageOf(person) * (vacancy.locationId === location ? 1.1 : 1.25))
    const target = worthIt.sort((a, b) => (near(a) - near(b)) || (b.dailyWage - a.dailyWage) || a.id.localeCompare(b.id))[0]
    if (!target) return null
    const decision = employerSays(person, target, tick)
    if (!decision.hired) {
      record({ tick, kind: 'job', personId: person.id, targetId: target.id, gatekeeperId: target.employerId, outcome: 'refused', reason: decision.reason })
      person.closedUntil.set(target.id, tick + CLOSED_TICKS)
      return null
    }
    const requiresMove = target.locationId !== location
    const answer = considerJobOffer({ offeredDailyWage: target.dailyWage, currentDailyWage: unpaid ? 0 : wageOf(person), wantsChange: wants, requiresMove })
    if (!answer.accepted) {
      record({ tick, kind: 'job', personId: person.id, targetId: target.id, gatekeeperId: target.employerId, outcome: 'declined', reason: answer.reason })
      person.closedUntil.set(target.id, tick + CLOSED_TICKS)
      return null
    }
    record({ tick, kind: 'job', personId: person.id, targetId: target.id, gatekeeperId: target.employerId, outcome: 'granted', reason: decision.reason })
    person.jobId = target.id; person.unpaidDays = 0
    host.setWork(person.id, { locationId: target.locationId, tileEntityId: target.tileEntityId ?? target.id })
    if (requiresMove) {
      // Arriving somewhere new means arriving without a home.
      loseHome(person)
      host.moveTo(person.id, target.locationId)
    }
    jobChanges += 1
    return { kind: 'work', reason: !job ? 'unemployed' : unpaid ? 'unpaid' : wish?.move ? wish.reason : 'better_wage', fromLocationId: location, toLocationId: target.locationId }
  }

  return {
    /** Once per game day: wages, living costs, hotel bills; every billing interval rent and rent changes. */
    daily(tick: number, day: number): void {
      unpaidToday = 0
      for (const employer of employers.values()) {
        employer.balance += employer.dailyIncome
        employerIncomeEmission += employer.dailyIncome
      }
      for (const person of persons) {
        const job = person.jobId ? jobById.get(person.jobId) : undefined
        if (job) {
          const employer = employers.get(job.employerId)
          if (!employer || employer.balance >= job.dailyWage) {
            if (employer) employer.balance -= job.dailyWage
            person.wealth += job.dailyWage
            person.unpaidDays = 0
          } else {
            person.unpaidDays += 1
            unpaidToday += 1
            if (person.unpaidDays >= UNPAID_QUIT_DAYS) { loseJob(person); quits += 1 }
          }
        }
        if (person.wealth >= livingCost) {
          person.wealth -= livingCost
          livingCostSink += livingCost
        } else {
          livingCostSink += person.wealth
          person.wealth = 0
          host.adjustNeed(person.id, 'sustenance', -0.15)
        }
        const dwelling = person.dwellingId ? dwellingById.get(person.dwellingId) : undefined
        if (dwelling && person.tenure === 'hotel') {
          const rate = dwelling.nightlyRate ?? 0
          if (person.wealth >= rate) { person.wealth -= rate; credit(dwelling.ownerId, rate) }
          else loseHome(person)
        }
        if (person.tenure === 'none') host.adjustNeed(person.id, 'safety', -0.05)
      }
      if (day % BILLING_DAYS !== 0) return
      for (const person of persons) {
        const dwelling = person.dwellingId ? dwellingById.get(person.dwellingId) : undefined
        if (!dwelling || person.tenure !== 'rented' || !dwelling.rent) continue
        const bill = settleRent(dwelling.rent, person.wealth, person.arrears)
        if (bill.paid) credit(dwelling.ownerId, dwelling.rent)
        person.wealth = bill.wealth; person.arrears = bill.arrears
        if (bill.evicted) { loseHome(person); person.lastEvictionTick = tick; evictions += 1 }
      }
      for (const dwelling of dwellings) {
        if (dwelling.kind !== 'rental') continue
        const local = dwellings.filter((other) => other.locationId === dwelling.locationId && other.kind !== 'hotel')
        const capacity = local.reduce((sum, other) => sum + other.capacity, 0)
        const occupied = local.reduce((sum, other) => sum + residents(other.id).length, 0)
        dwelling.rent = adjustRent(dwelling, { settlementOccupancy: capacity ? occupied / capacity : 1, vacantPlaces: dwelling.capacity - residents(dwelling.id).length })
      }
    },

    /** The person's daily look at their situation. At most one change per day. */
    review(personId: string, tick: number, day: number): MarketChange | null {
      const person = personById.get(personId)
      if (!person) return null
      return reviewHousing(person, tick, day) ?? reviewJob(person, tick, day)
    },

    shelter(personId: string): number {
      const person = personById.get(personId)
      return person ? shelterQuality(person.tenure) : 1
    },

    openPlaces,

    materialMeans(personId: string): { wealth: number; dailyIncome: number; essentialDailyCost: number } {
      const person = personById.get(personId)
      if (!person) return { wealth: 0, dailyIncome: 0, essentialDailyCost: livingCost }
      const job = person.jobId ? jobById.get(person.jobId) : undefined
      const dailyIncome = job && person.unpaidDays === 0 ? job.dailyWage : 0
      return { wealth: person.wealth, dailyIncome, essentialDailyCost: livingCost }
    },

    closeDay(day: number, tick: number): void {
      const open = persons.map((person) => openPlaces(person.id, tick))
      const rented = persons.filter((person) => person.tenure === 'rented').map((person) => dwellingById.get(person.dwellingId!)?.rent ?? 0)
      days.push({
        day,
        wealthAvg: round(mean(persons.map((person) => person.wealth))),
        wealthGini: gini(persons.map((person) => person.wealth)),
        wageAvg: round(mean(persons.map(wageOf))),
        unemployed: persons.filter((person) => !person.jobId).length,
        unpaid: unpaidToday,
        homeless: persons.filter((person) => person.tenure === 'none').length,
        hotelGuests: persons.filter((person) => person.tenure === 'hotel').length,
        owners: persons.filter((person) => person.tenure === 'owned').length,
        renters: rented.length,
        rentAvg: round(mean(rented)),
        evictions, quits, applications, refusals, declined, housingMoves, jobChanges,
        openPlacesAvg: round(mean(open)),
        noOpenPlaces: open.filter((count) => count === 0).length,
      })
      evictions = 0; quits = 0; applications = 0; refusals = 0; declined = 0; housingMoves = 0; jobChanges = 0
    },

    result(): MarketResult {
      const finalMoney = persons.reduce((sum, person) => sum + person.wealth, 0)
        + [...employers.values()].reduce((sum, employer) => sum + employer.balance, 0)
        + [...ownerIncome.values()].reduce((sum, amount) => sum + amount, 0)
      const expectedDelta = employerIncomeEmission + propertyBuybackEmission - livingCostSink
      const actualDelta = finalMoney - initialMoney
      return {
        days, records, summary: summarizeAccess(records), power: gatekeeperPower(records),
        money: {
          initial: round(initialMoney),
          final: round(finalMoney),
          employerIncomeEmission: round(employerIncomeEmission),
          livingCostSink: round(livingCostSink),
          propertyBuybackEmission: round(propertyBuybackEmission),
          expectedDelta: round(expectedDelta),
          actualDelta: round(actualDelta),
          unexplainedDelta: round(actualDelta - expectedDelta),
        },
        final: {
          wealth: Object.fromEntries(persons.map((person) => [person.id, round(person.wealth)])),
          tenure: Object.fromEntries(persons.map((person) => [person.id, person.tenure])),
          dailyWage: Object.fromEntries(persons.map((person) => [person.id, wageOf(person)])),
          rents: Object.fromEntries(dwellings.filter((dwelling) => dwelling.kind === 'rental').map((dwelling) => [dwelling.id, dwelling.rent ?? 0])),
          ownerIncome: Object.fromEntries([...ownerIncome.entries()].sort().map(([id, amount]) => [id, round(amount)])),
          employerBalance: Object.fromEntries([...employers.entries()].sort().map(([id, employer]) => [id, round(employer.balance)])),
        },
      }
    },
  }
}

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/**
 * A market for a synthetic colony: per settlement one full public habitat, private
 * rentals of a landlord, one home let by a resident, a public guest house, a
 * commercial hotel and two houses for sale; a public service, a solvent company
 * and one that pays more than it earns. Deterministic for an equal snapshot.
 */
export function syntheticMarket(snapshot: { people: { id: string; locationId: string; assignments?: { type: string; locationId: string; tileEntityId: string | null }[] | null }[] }): MarketSetup {
  const homes = new Map<string, { locationId: string; residents: string[] }>()
  const works = new Map<string, { locationId: string; staff: string[] }>()
  for (const person of [...snapshot.people].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const assignment of person.assignments ?? []) {
      if (!assignment.tileEntityId) continue
      if (assignment.type === 'home') {
        const home = homes.get(assignment.tileEntityId) ?? { locationId: assignment.locationId, residents: [] }
        home.residents.push(person.id); homes.set(assignment.tileEntityId, home)
      } else if (assignment.type === 'work') {
        const work = works.get(assignment.tileEntityId) ?? { locationId: assignment.locationId, staff: [] }
        work.staff.push(person.id); works.set(assignment.tileEntityId, work)
      }
    }
  }
  const dwellings: Dwelling[] = []
  const jobs: MarketJob[] = []
  const employers: Record<string, MarketEmployer> = {}
  const perLocation = new Map<string, number>()
  const next = (locationId: string): number => { const index = perLocation.get(locationId) ?? 0; perLocation.set(locationId, index + 1); return index }
  const base = { tileEntityId: null, rent: null, baseRent: null, askingPrice: null, nightlyRate: null }

  for (const [tile, home] of [...homes.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const index = next(home.locationId)
    if (index === 0) dwellings.push({ ...base, id: tile, tileEntityId: tile, locationId: home.locationId, kind: 'rental', capacity: home.residents.length, ownerKind: 'state', ownerId: `state:${home.locationId}`, rent: 0, baseRent: 0 })
    else if (index === 3) dwellings.push({ ...base, id: tile, tileEntityId: tile, locationId: home.locationId, kind: 'rental', capacity: home.residents.length + 1, ownerKind: 'person', ownerId: home.residents[0], rent: 380, baseRent: 380 })
    else dwellings.push({ ...base, id: tile, tileEntityId: tile, locationId: home.locationId, kind: 'rental', capacity: home.residents.length + 1, ownerKind: 'landlord', ownerId: `landlord:${home.locationId}`, rent: 420, baseRent: 420 })
  }
  const jobLocation = new Map<string, number>()
  for (const [tile, work] of [...works.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const index = jobLocation.get(work.locationId) ?? 0
    jobLocation.set(work.locationId, index + 1)
    const kind = index % 3
    const employerId = kind === 0 ? `state:${work.locationId}` : kind === 1 ? `company-a:${work.locationId}` : `company-b:${work.locationId}`
    const dailyWage = kind === 0 ? 55 : kind === 1 ? 75 : 95
    jobs.push({
      id: tile, tileEntityId: tile, locationId: work.locationId, employerId, employerKind: kind === 0 ? 'state' : 'company',
      roleCode: kind === 0 ? 'service' : kind === 1 ? 'technician' : 'engineer', dailyWage, positions: work.staff.length + 2,
      requiredSkill: kind === 2 ? { code: 'engineering', minLevel: 0.5 } : null,
    })
    const payroll = dailyWage * work.staff.length
    if (kind !== 0) {
      const employer = employers[employerId] ?? { balance: 0, dailyIncome: 0 }
      // Company A earns what it pays, company B lives on a reserve that runs out.
      employer.balance += payroll * (kind === 1 ? 30 : 60)
      employer.dailyIncome += Math.round(payroll * (kind === 1 ? 1.05 : 0.85))
      employers[employerId] = employer
    }
  }
  for (const locationId of [...new Set(snapshot.people.map((person) => person.locationId))].sort()) {
    dwellings.push({ ...base, id: `${locationId}:guesthouse`, tileEntityId: `${locationId}:guesthouse`, locationId, kind: 'hotel', capacity: 2, ownerKind: 'state', ownerId: `state:${locationId}`, nightlyRate: 10 })
    dwellings.push({ ...base, id: `${locationId}:hotel`, tileEntityId: `${locationId}:hotel`, locationId, kind: 'hotel', capacity: 4, ownerKind: 'landlord', ownerId: `hotelier:${locationId}`, nightlyRate: 40 })
    for (const n of [0, 1]) dwellings.push({ ...base, id: `${locationId}:house-${n}`, tileEntityId: `${locationId}:house-${n}`, locationId, kind: 'house', capacity: 1, ownerKind: 'landlord', ownerId: `developer:${locationId}`, askingPrice: 4000, baseRent: 4000 })
  }
  const people: MarketSetup['people'] = {}
  for (const person of snapshot.people) people[person.id] = { skills: { engineering: (hash(`skill:${person.id}`) % 100) / 100 } }
  return { dwellings, jobs, employers, people }
}
