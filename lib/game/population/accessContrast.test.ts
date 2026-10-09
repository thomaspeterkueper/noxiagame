// O5 controlled contrasts: no database, no world writes.
import { housingOffer, landlordDecision, type Dwelling } from './housing'
import { employerDecision, type Vacancy } from './employment'
import { summarizeAccess, type AccessRecord } from './access'

let failures = 0
const check = (condition: boolean, message: string) => {
  if (!condition) { failures++; console.error('FAIL: ' + message) }
}
const dwelling: Dwelling = {
  id: 'flat-1', locationId: 'colony', tileEntityId: 'tile-1', kind: 'rental',
  capacity: 2, ownerKind: 'person', ownerId: 'owner-a',
  rent: 600, baseRent: 600, askingPrice: null, nightlyRate: null,
}
const applicant = { wealth: 1000, dailyWage: 100, ticksSinceEviction: null }
const offered = housingOffer(dwelling, applicant, 1)
check(offered !== null, 'housing is physically available and financially affordable')
const refused = landlordDecision({ dwelling, freePlaces: 1, applicant, ownerAffinity: 0.2 })
const granted = landlordDecision({ dwelling, freePlaces: 1, applicant, ownerAffinity: 0.6 })
check(refused.reason === 'owner_dislikes' && !refused.granted, 'same affordable flat refused by gatekeeper')
check(granted.granted && granted.reason === 'granted', 'same affordable flat granted with changed gatekeeper condition')
check(housingOffer(dwelling, { ...applicant, dailyWage: 40 }, 1) === null, 'unaffordable option is not a gatekeeper refusal')
check(landlordDecision({ dwelling, freePlaces: 0, applicant, ownerAffinity: 0.6 }).reason === 'no_room', 'capacity control')
const publicFlat: Dwelling = { ...dwelling, ownerKind: 'state', ownerId: 'state' }
check(landlordDecision({ dwelling: publicFlat, freePlaces: 1, applicant, ownerAffinity: 0.2 }).granted, 'institutional rule control')

const vacancy: Vacancy = {
  id: 'job-1', locationId: 'colony', tileEntityId: 'factory',
  employerId: 'boss-a', employerKind: 'person', roleCode: 'worker',
  dailyWage: 100, requiredSkill: { code: 'repair', minLevel: 0.5 },
}
const qualified = { skills: { repair: 0.8 } }
const jobRefused = employerDecision({ vacancy, openPositions: 1, applicant: qualified, employerAffinity: 0.2 })
const jobGranted = employerDecision({ vacancy, openPositions: 1, applicant: qualified, employerAffinity: 0.6 })
check(!jobRefused.hired && jobRefused.reason === 'employer_dislikes', 'qualified candidate blocked by employer')
check(jobGranted.hired, 'same qualified candidate admitted when only employer affinity changes')
check(employerDecision({ vacancy, openPositions: 1, applicant: { skills: { repair: 0.2 } }, employerAffinity: 0.6 }).reason === 'underqualified', 'qualification control')
check(employerDecision({ vacancy, openPositions: 0, applicant: qualified, employerAffinity: 0.6 }).reason === 'no_vacancy', 'job capacity control')

const log = (outcome: AccessRecord['outcome'], origin: AccessRecord['origin'] = 'market'): AccessRecord => ({
  tick: 1, kind: 'housing', personId: 'person-a', targetId: dwelling.id,
  gatekeeperId: 'owner-a', outcome, reason: outcome, origin,
})
const denied = summarizeAccess([log('refused')])
const admitted = summarizeAccess([log('granted')])
check(denied.accessibleShare === 0 && denied.shutOut === 1, 'denied request changes observed access measure')
check(admitted.accessibleShare === 1 && admitted.shutOut === 0, 'granted request changes observed access measure')
check(summarizeAccess([log('refused', 'backfill')]).requests === 0, 'backfill does not count as exercise of power')
check(summarizeAccess([log('refused', 'provided')]).requests === 0, 'provided assignment does not count as exercise of power')
check(summarizeAccess([log('declined')]).requests === 0, 'applicant decline not attributed to gatekeeper decision')
// Multiple independent alternatives: a refusal only closes the possibility space
// if no other accessible, affordable offer remains.
const alternative: Dwelling = { ...dwelling, id: 'flat-2', ownerId: 'owner-b' }
const alternatives = [dwelling, alternative]
const possibleHomes = (affinities: Record<string, number>): string[] =>
  alternatives.filter((home) =>
    housingOffer(home, applicant, 1) !== null &&
    landlordDecision({ dwelling: home, freePlaces: 1, applicant, ownerAffinity: affinities[home.ownerId] }).granted
  ).map((home) => home.id)
const openBoth = possibleHomes({ 'owner-a': 0.6, 'owner-b': 0.6 })
const deniedOne = possibleHomes({ 'owner-a': 0.2, 'owner-b': 0.6 })
const deniedBoth = possibleHomes({ 'owner-a': 0.2, 'owner-b': 0.2 })
check(openBoth.length === 2, 'two independent owners provide two accessible alternatives')
check(deniedOne.length === 1 && deniedOne[0] === 'flat-2', 'one refusal reduces but does not eliminate alternatives')
check(deniedBoth.length === 0, 'combined refusal closes all alternatives')
check(possibleHomes({ 'owner-a': 0.2, 'owner-b': 0.6 }).length === deniedOne.length, 'deterministic replay of the same conditions')
// Concentration counterfactual: identical homes, means and capacities;
// only the ownership graph and one owner's decision policy differ.
const jointlyOwned: Dwelling[] = [dwelling, { ...alternative, ownerId: 'owner-a' }]
const accessibleUnder = (homes: Dwelling[], affinities: Record<string, number>) =>
  homes.filter((home) => housingOffer(home, applicant, 1) !== null &&
    landlordDecision({ dwelling: home, freePlaces: 1, applicant, ownerAffinity: affinities[home.ownerId] }).granted).length
const distributedAccess = accessibleUnder(alternatives, { 'owner-a': 0.2, 'owner-b': 0.6 })
const concentratedAccess = accessibleUnder(jointlyOwned, { 'owner-a': 0.2 })
check(distributedAccess === 1 && concentratedAccess === 0, 'same refusal by owner A closes all options only under concentrated ownership')
check(accessibleUnder(jointlyOwned, { 'owner-a': 0.6 }) === 2, 'concentrated owner can also open both options')
const distributedLog: AccessRecord[] = [
  { ...log('refused'), targetId: 'flat-1', gatekeeperId: 'owner-a' },
  { ...log('granted'), targetId: 'flat-2', gatekeeperId: 'owner-b' },
]
const concentratedLog: AccessRecord[] = [
  { ...log('refused'), targetId: 'flat-1', gatekeeperId: 'owner-a' },
  { ...log('refused'), targetId: 'flat-2', gatekeeperId: 'owner-a' },
]
check(summarizeAccess(distributedLog).topGatekeeperShare === 0.5, 'distributed decisions have half-share concentration')
check(summarizeAccess(concentratedLog).topGatekeeperShare === 1, 'single owner decides all applications')
check(summarizeAccess(distributedLog).shutOut === 0 && summarizeAccess(concentratedLog).shutOut === 1, 'ownership concentration changes complete exclusion')

// Temporal counterfactual: same starting resources and deterministic rules.
// A missed job causes foregone wages, which can outlast the gate reopening.
// This is a deliberately minimal model, not the colony tick economy.
type TemporalState = { wealth: number; working: boolean; missedWages: number }
const simulatePeriods = (blockedFirstPeriod: boolean, alternativeJob: boolean): TemporalState => {
  const state: TemporalState = { wealth: 0, working: false, missedWages: 0 }
  for (let period = 0; period < 4; period++) {
    const primaryOpen = period > 0 || !blockedFirstPeriod
    const accessible = primaryOpen || alternativeJob
    if (accessible) state.working = true
    if (state.working) state.wealth += 100
    else state.missedWages += 100
  }
  return state
}
const uninterrupted = simulatePeriods(false, false)
const temporaryBlock = simulatePeriods(true, false)
const temporaryBlockWithExit = simulatePeriods(true, true)
check(uninterrupted.wealth === 400, 'uninterrupted employment yields four wage periods')
check(temporaryBlock.wealth === 300 && temporaryBlock.working, 'one-period refusal creates persistent wealth gap after reopening')
check(temporaryBlock.missedWages === 100, 'foregone wages are explicitly recorded')
check(temporaryBlockWithExit.wealth === uninterrupted.wealth, 'independent substitute prevents wage gap')
check(simulatePeriods(true, false).wealth === temporaryBlock.wealth, 'temporal contrast is deterministic')
console.log(JSON.stringify({ experiment: 'OMNI-O5-ACCESS-001', checks: 30, failures, housing: { affordable: Boolean(offered), denied: refused.reason, admitted: granted.reason }, employment: { denied: jobRefused.reason, admitted: jobGranted.reason }, measurement: { denied, admitted }, alternatives: { openBoth, deniedOne, deniedBoth }, concentration: { distributedAccess, concentratedAccess }, temporal: { uninterrupted, temporaryBlock, temporaryBlockWithExit }, scope: 'pure rule contrast; no live effects' }))
if (failures) throw new Error(`OMNI-O5-ACCESS-001: ${failures} checks failed`)
