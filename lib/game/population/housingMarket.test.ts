import { gatekeeperPower, summarizeAccess, type AccessRecord } from './access'
import { considerJobOffer, employerDecision, type Vacancy } from './employment'
import {
  adjustRent, BILLING_INTERVAL_TICKS, chooseHousing, EVICTION_ARREARS, housingOffer, landlordDecision, rentBurden, settleRent,
  shelterQuality, tenureSecurity, type Dwelling, type HousingCandidate, type HousingChoiceInput,
} from './housing'
import { needDelta, passiveNeedDrift } from './actionEffects'

let failures = 0
const check = (ok: boolean, label: string) => { if (!ok) { failures++; console.error('FAIL: ' + label) } }

const dwelling = (values: Partial<Dwelling>): Dwelling => ({
  id: 'd', locationId: 'loc', tileEntityId: 't', kind: 'rental', capacity: 4, ownerKind: 'landlord', ownerId: 'landlord-1',
  rent: 600, baseRent: 600, askingPrice: null, nightlyRate: null, ...values,
})
const flat = dwelling({})
const social = dwelling({ id: 'social', ownerKind: 'state', ownerId: 'state', rent: 300, baseRent: 300 })
const house = dwelling({ id: 'house', kind: 'house', capacity: 2, rent: null, baseRent: null, askingPrice: 6000, ownerKind: 'person', ownerId: 'seller' })
const hotel = dwelling({ id: 'hotel', kind: 'hotel', rent: null, baseRent: null, nightlyRate: 45, ownerId: 'hotelier' })

// What is affordable.
check(BILLING_INTERVAL_TICKS === 720 && rentBurden(600, 100) === 0.2 && rentBurden(600, 40) === 0.5, 'burden is the share of a billing period of wages')
check(housingOffer(flat, { wealth: 0, dailyWage: 100 }, 1)?.tenure === 'rented' && housingOffer(flat, { wealth: 9999, dailyWage: 40 }, 1) === null, 'a rent beyond one\'s wage is not an option, whatever the savings')
check(housingOffer(flat, { wealth: 0, dailyWage: 100 }, 0) === null, 'a full dwelling is not an option')
check(housingOffer(house, { wealth: 6700, dailyWage: 100 }, 2)?.tenure === 'owned' && housingOffer(house, { wealth: 6500, dailyWage: 100 }, 2) === null, 'buying needs the price plus a week of wages in reserve')
check(housingOffer(hotel, { wealth: 135, dailyWage: 60 }, 3)?.tenure === 'hotel' && housingOffer(hotel, { wealth: 100, dailyWage: 60 }, 3) === null, 'a hotel needs money for a few nights')
check(housingOffer(dwelling({ kind: 'house', askingPrice: null, rent: null }), { wealth: 1e6, dailyWage: 100 }, 1) === null, 'a house that is not for sale is not an option')

// The landlord decides.
const ok = { wealth: 500, dailyWage: 100, ticksSinceEviction: null }
check(landlordDecision({ dwelling: flat, freePlaces: 1, applicant: ok }).granted, 'a solvent applicant gets the flat')
check(landlordDecision({ dwelling: flat, freePlaces: 0, applicant: ok }).reason === 'no_room', 'no room, no flat')
check(landlordDecision({ dwelling: flat, freePlaces: 1, applicant: { ...ok, dailyWage: 40 } }).reason === 'income_too_low', 'a private landlord refuses a low earner')
check(landlordDecision({ dwelling: social, freePlaces: 1, applicant: { ...ok, dailyWage: 10 } }).granted, 'public housing takes anyone it has room for')
check(landlordDecision({ dwelling: flat, freePlaces: 1, applicant: { ...ok, ticksSinceEviction: 1000 } }).reason === 'past_arrears', 'a recent eviction closes private flats')
check(landlordDecision({ dwelling: flat, freePlaces: 1, applicant: { ...ok, wealth: 2000, ticksSinceEviction: 1000 } }).granted, 'unless a deposit outweighs it')
check(landlordDecision({ dwelling: flat, freePlaces: 1, applicant: { ...ok, ticksSinceEviction: 24 * 400 } }).granted, 'and it is forgotten after a year')
const lodging = dwelling({ ownerKind: 'person', ownerId: 'owner' })
check(landlordDecision({ dwelling: lodging, freePlaces: 1, applicant: ok, ownerAffinity: 0.2 }).reason === 'owner_dislikes' && landlordDecision({ dwelling: lodging, freePlaces: 1, applicant: ok, ownerAffinity: 0.6 }).granted, 'an owner in person can refuse someone they dislike')
check(landlordDecision({ dwelling: hotel, freePlaces: 1, applicant: { ...ok, ticksSinceEviction: 10 } }).granted, 'a hotel takes anyone')

// Choosing.
const candidate = (d: Dwelling, means = { wealth: 8000, dailyWage: 100 }, extra: Partial<HousingCandidate> = {}): HousingCandidate =>
  ({ offer: housingOffer(d, means, 1)!, supply: 1, affinityToResidents: 0.5, closeTies: 0, workReachable: true, ...extra })
const renting: HousingChoiceInput['current'] = { tenure: 'rented', dwellingId: 'old', locationId: 'loc', burden: 0.2, supply: 1, affinityToResidents: 0.5, closeTies: 0 }
check(chooseHousing({ current: renting, mustMove: false, wantsToMove: false, candidates: [candidate(flat)] }) === null, 'nobody moves to something that is merely the same')
check(chooseHousing({ current: renting, mustMove: false, wantsToMove: false, candidates: [candidate(flat), candidate(house)] })?.offer.tenure === 'owned', 'those who can afford it buy: owning is more secure')
check(chooseHousing({ current: { ...renting, burden: 0.55 }, mustMove: false, wantsToMove: false, candidates: [candidate(social)] })?.offer.dwelling.id === 'social', 'an overburdened tenant takes cheaper housing')
check(chooseHousing({ current: renting, mustMove: false, wantsToMove: true, candidates: [candidate(hotel)] }) === null, 'nobody moves into a hotel by choice')
check(chooseHousing({ current: { ...renting, tenure: 'none', dwellingId: null }, mustMove: true, wantsToMove: false, candidates: [candidate(hotel)] })?.offer.tenure === 'hotel', 'someone with nowhere to go takes the hotel')
check(chooseHousing({ current: { ...renting, tenure: 'none', dwellingId: null }, mustMove: true, wantsToMove: false, candidates: [candidate(hotel), candidate(flat)] })?.offer.tenure === 'rented', 'but prefers a flat')
check(chooseHousing({ current: renting, mustMove: true, wantsToMove: false, candidates: [candidate(flat, undefined, { workReachable: false })] }) === null, 'a home where one cannot work is no option')
check(chooseHousing({ current: renting, mustMove: true, wantsToMove: false, candidates: [] }) === null, 'with nothing on offer there is nowhere to go')
check(chooseHousing({ current: renting, mustMove: false, wantsToMove: true, candidates: [candidate(flat, undefined, { closeTies: 2, affinityToResidents: 0.8 })] })?.offer.dwelling.id === 'd', 'people move towards their friends')

// Rent, arrears, eviction.
check(JSON.stringify(settleRent(600, 700, 1)) === JSON.stringify({ paid: true, wealth: 100, arrears: 0, evicted: false }), 'paying clears arrears')
const first = settleRent(600, 100, 0), second = settleRent(600, 100, first.arrears)
check(!first.paid && !first.evicted && first.wealth === 100 && second.evicted && second.arrears === EVICTION_ARREARS, 'missing rent twice costs the dwelling')

// The landlord sets the price.
check(adjustRent(flat, { settlementOccupancy: 0.95, vacantPlaces: 0 }) === 630, 'a private landlord raises the rent in a full settlement')
check(adjustRent(flat, { settlementOccupancy: 0.5, vacantPlaces: 4 }) === 570, 'an empty dwelling gets cheaper')
check(adjustRent(flat, { settlementOccupancy: 0.7, vacantPlaces: 1 }) === 600, 'otherwise the rent stays')
check(adjustRent(social, { settlementOccupancy: 1, vacantPlaces: 0 }) === 300, 'public rent does not follow the market')
let squeezed = flat, slack = flat
for (let i = 0; i < 100; i++) { squeezed = { ...squeezed, rent: adjustRent(squeezed, { settlementOccupancy: 1, vacantPlaces: 0 }) }; slack = { ...slack, rent: adjustRent(slack, { settlementOccupancy: 0, vacantPlaces: 4 }) } }
check(squeezed.rent === 1800 && slack.rent === 300, 'rent stays within bounds of where it started')

// Shelter and security.
check(shelterQuality('none') < shelterQuality('hotel') && shelterQuality('rented') === 1, 'having nowhere to live is poor shelter')
check(needDelta('rest', 'rest', { shelter: shelterQuality('none') }) < needDelta('rest', 'rest') && needDelta('rest', 'rest', { shelter: 1 }) === 0.12, 'without a home, rest restores less')
check(passiveNeedDrift('safety', { shelter: shelterQuality('none') }) < 0 && passiveNeedDrift('safety', { shelter: 1 }) === 0, 'and life feels less safe')
check(tenureSecurity('owned') > tenureSecurity('rented') && tenureSecurity('rented') > tenureSecurity('hotel') && tenureSecurity('none') === 0 && tenureSecurity('rented', 1) < tenureSecurity('rented'), 'owning is the most secure hold on a place, arrears weaken it')

// Jobs: both sides can say no.
const vacancy: Vacancy = { id: 'v', locationId: 'loc', tileEntityId: 'w', employerId: 'corp', employerKind: 'company', roleCode: 'technician', dailyWage: 80, requiredSkill: { code: 'maintenance', minLevel: 0.5 } }
check(employerDecision({ vacancy, openPositions: 1, applicant: { skills: { maintenance: 0.7 } } }).hired, 'a qualified applicant is hired')
check(employerDecision({ vacancy, openPositions: 1, applicant: { skills: { maintenance: 0.2 } } }).reason === 'underqualified', 'an unqualified one is not')
check(employerDecision({ vacancy, openPositions: 0, applicant: { skills: { maintenance: 1 } } }).reason === 'no_vacancy', 'no opening, no job')
check(employerDecision({ vacancy, openPositions: 1, applicant: { skills: { maintenance: 1 }, dismissedByEmployer: true } }).reason === 'dismissed_before', 'a company does not rehire someone it dismissed')
check(employerDecision({ vacancy: { ...vacancy, employerKind: 'state' }, openPositions: 1, applicant: { skills: { maintenance: 1 }, dismissedByEmployer: true } }).hired, 'a public employer does')
check(employerDecision({ vacancy: { ...vacancy, employerKind: 'person', requiredSkill: null }, openPositions: 1, applicant: { skills: {} }, employerAffinity: 0.2 }).reason === 'employer_dislikes', 'someone who employs in person can refuse whom they dislike')
check(considerJobOffer({ offeredDailyWage: 50, currentDailyWage: 0, wantsChange: false, requiresMove: true }).accepted, 'someone without work takes what there is')
check(!considerJobOffer({ offeredDailyWage: 82, currentDailyWage: 80, wantsChange: false, requiresMove: false }).accepted && considerJobOffer({ offeredDailyWage: 90, currentDailyWage: 80, wantsChange: false, requiresMove: false }).accepted, 'nobody changes jobs for nothing')
check(considerJobOffer({ offeredDailyWage: 90, currentDailyWage: 80, wantsChange: false, requiresMove: true }).reason === 'not_worth_moving', 'and moving takes a clear raise')
check(considerJobOffer({ offeredDailyWage: 75, currentDailyWage: 80, wantsChange: true, requiresMove: false }).accepted && considerJobOffer({ offeredDailyWage: 60, currentDailyWage: 80, wantsChange: true, requiresMove: false }).reason === 'wage_too_low', 'someone who wants a change accepts a small loss, not a large one')

// Power as a record of decisions.
const record = (personId: string, gatekeeperId: string, outcome: AccessRecord['outcome'], kind: AccessRecord['kind'] = 'housing'): AccessRecord => ({ tick: 1, kind, personId, targetId: 't', gatekeeperId, outcome, reason: outcome })
const log = [record('a', 'L1', 'granted'), record('b', 'L1', 'refused'), record('c', 'L1', 'refused'), record('c', 'L1', 'refused'), record('b', 'state', 'granted'), record('d', 'L2', 'declined'), record('a', 'corp', 'granted', 'job')]
const power = gatekeeperPower(log)
check(power[0].gatekeeperId === 'L1' && power[0].peopleAffected === 3 && power[0].refused === 3 && power[0].refusalRate === 0.75, 'the gatekeeper deciding about most people comes first')
check(power.find((entry) => entry.gatekeeperId === 'L2')?.declined === 1 && power.find((entry) => entry.gatekeeperId === 'L2')?.decisions === 0, 'an offer turned down counts as the other side\'s say')
const summary = summarizeAccess(log)
check(summary.requests === 6 && summary.accessibleShare === 0.5 && summary.shutOut === 1 && summary.topGatekeeperShare === round4(4 / 6), 'the summary shows how much is really open and who is shut out')
check(summary.declinedShare === 0.25, 'and how often people themselves said no')
check(summarizeAccess([]).accessibleShare === 1 && gatekeeperPower([]).length === 0, 'no decisions, no power')
function round4(value: number): number { return Math.round(value * 10_000) / 10_000 }

if (failures) throw new Error(String(failures) + ' housing market test(s) failed')
console.log('Housing, employment and access: tests passed; mutations=0')
