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
console.log(JSON.stringify({ experiment: 'OMNI-O5-ACCESS-001', checks: 16, failures, housing: { affordable: Boolean(offered), denied: refused.reason, admitted: granted.reason }, employment: { denied: jobRefused.reason, admitted: jobGranted.reason }, measurement: { denied, admitted }, scope: 'pure rule contrast; no live effects' }))
if (failures) throw new Error(`OMNI-O5-ACCESS-001: ${failures} checks failed`)
