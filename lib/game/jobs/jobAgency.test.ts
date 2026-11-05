import { validateInteriorTemplate } from '../buildings/interiors/topology'
import { canSeeRoom, isVenueBlocked, placeVenueFigures, venuePath } from '../hospitality/venues'
import { AGENCY_ROBOT_FACTS, AGENCY_ROBOT_INTRODUCTION, JOB_AGENCY_LAYOUT as L, agencyRobot, agencyRobotId, distanceM, jobAgencyKnowledge, venueJobOffers } from './jobAgency'
import { agencyReferralFacts, referralFor, referralFromOffer, referralValid, REFERRAL_VALID_MS, spokenJobChoices, venueReferralFacts } from './referral'
import { MAX_FACTS, MAX_FACT_CHARS, baseInteriorFacts, withExtraFacts } from '../interiors/baseFacts'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }

check(validateInteriorTemplate(L.template).every(issue => issue.code === 'unknown-capability'), 'agency: template has no structural issues')
check(!isVenueBlocked(L, L.start) && !isVenueBlocked(L, L.servicePoint) && L.spots.filter(s => s.kind === 'seat').every(s => venuePath(L, L.start, s).length >= 2), 'agency: counter and seats reachable')
check(L.spots.filter(s => s.kind !== 'staff').every(s => canSeeRoom(L, L.playerRoomId, s.roomId)), 'agency: visitor spots in sight')
const staff = placeVenueFigures(L, [{ id: 'a', worksHere: true }, { id: 'b', worksHere: true }])
check(staff[0].spot.id === 'staff-counter' && staff[1].spot.id === 'staff-advice' && staff.every(f => f.visibleToPlayer), 'agency: counter first, then the advice table')

const buildings = [
  { id: 'm', typeId: 'bar', name: 'Bar · Metropol', lat: 51.3262, lon: 8.0043 },
  { id: 'c', typeId: 'nightclub', name: 'Nachtclub · Hauptstraße 50', lat: 51.3255, lon: 8.005 },
  { id: 'b', typeId: 'bank', name: 'Bank · Sparkasse · Hauptstraße 140', lat: 51.3308, lon: 8.0042 },
]
const probe = venueJobOffers(buildings)
check(probe.filter(o => o.buildingId === 'c').map(o => o.role).sort().join() === 'bar,cleaning,dj,door' && !probe.some(o => o.buildingId === 'b'), 'venues only: the club offers its four jobs, the bank none')
check(probe.every(o => !o.paid && o.wage > 0 && o.gameHours > 0) && probe[0].wage >= probe[probe.length - 1].wage, 'probe offers with proposed wage, best paid first')
check(probe.find(o => o.buildingId === 'm')?.placeName === 'Metropol' && probe.find(o => o.buildingId === 'm')?.placeKind === 'Bar', 'place name and kind from the map name')
const server = venueJobOffers(buildings, { c: { open: ['dj'], wages: { dj: 12 } } })
check(server.filter(o => o.buildingId === 'c').length === 1 && server.find(o => o.buildingId === 'c')!.wage === 48 && server.find(o => o.buildingId === 'c')!.paid, 'with server data only the open, paid jobs')
check(distanceM({ lat: 51.33, lon: 8 }, { lat: 51.331, lon: 8 }) > 100 && distanceM({ lat: 51.33, lon: 8 }, { lat: 51.331, lon: 8 }) < 120, 'distance in metres')

const k = jobAgencyKnowledge(probe)
check(k[0].startsWith('Freie Schichten in Lokalen') && k.some(f => f.includes('Probeschicht')) && k.some(f => f.includes('noch nicht im Angebot')) && k.every(f => f.length <= 140), 'the advisor knows the board and says what is not there yet')
check(jobAgencyKnowledge(null)[0].includes('geholt') && jobAgencyKnowledge([])[0].includes('keine freien'), 'without data nothing is invented')

// Vermittlungsroboter
const rid = agencyRobotId('agency-1')
check(rid.startsWith('robot:') && agencyRobot('agency-1').assignments[0].tileEntityId === 'agency-1', 'the robot works in this agency')
const alone = placeVenueFigures(L, [{ id: rid, worksHere: true }])
const withStaff = placeVenueFigures(L, [{ id: '00000000-0000-4000-8000-000000000001', worksHere: true }, { id: rid, worksHere: true }])
check(alone[0].spot.id === 'staff-counter' && withStaff.find(f => f.id === rid)?.spot.id === 'staff-advice', 'robot at the counter when alone, at the advice table when there is staff')
check(AGENCY_ROBOT_FACTS.every(f => f.length <= 140) && AGENCY_ROBOT_FACTS.some(f => f.includes('0800 4 555500') && f.includes('Check-U')) && AGENCY_ROBOT_FACTS.some(f => f.includes('Maschine, kein Mensch')), 'robot facts: honest about being a machine, real help for real life')
check(AGENCY_ROBOT_INTRODUCTION.stance.length <= 320 && AGENCY_ROBOT_INTRODUCTION.leads.every(l => l.length <= 180), 'robot introduction within the route limits')
const robotFacts = withExtraFacts(baseInteriorFacts({ layout: L, buildingName: 'Agentur für Arbeit · Freiheitsmühle 7', self: alone[0], figures: alone, playerPos: L.servicePoint }), [...AGENCY_ROBOT_FACTS, ...jobAgencyKnowledge(probe)])
check(robotFacts.length <= MAX_FACTS && robotFacts.every(f => f.length <= MAX_FACT_CHARS) && AGENCY_ROBOT_FACTS.every(f => robotFacts.includes(f)) && robotFacts.some(f => f.startsWith('Freie Schichten')), 'all robot facts and the job summary fit')

// Direkt vermitteln
const clubDj = probe.find(o => o.buildingId === 'c' && o.role === 'dj')!
const ref = referralFromOffer(clubDj, 'VERA', 1_000)
check(ref.buildingTypeId === 'nightclub' && ref.buildingName === 'Nachtclub · Hauptstraße 50' && ref.role === 'dj', 'the referral carries what it takes to open the venue')
check(referralValid(ref, 1_000 + REFERRAL_VALID_MS - 1) && !referralValid(ref, 1_000 + REFERRAL_VALID_MS) && !referralValid(null, 0), 'a referral holds two real hours')
check(referralFor(ref, 'c', 2_000) === ref && referralFor(ref, 'm', 2_000) === null, 'only the referred house knows it')
check(agencyReferralFacts(ref, 2_000)[0].includes('DJ') && agencyReferralFacts(ref, 1_000 + REFERRAL_VALID_MS).length === 0, 'the agency knows the open referral')
check(venueReferralFacts(ref, true, false)[0].includes('vermittelt') && venueReferralFacts(ref, false, false).length === 0 && venueReferralFacts(ref, true, true).length === 0, 'venue staff know, guests do not, and not while working')
const said = (t: string) => spokenJobChoices(t, probe).map(o => o.buildingId + ':' + o.role).join()
check(said('Ich würde gern als Barkeeper im Metropol arbeiten') === 'm:bar', 'role and house named')
check(said('Kann ich als DJ auflegen?') === 'c:dj', 'role only: the first fitting job')
check(said('Bitte nicht putzen, lieber an die Tür') === 'c:door', 'negated work does not count')
check(said('Hallo, wie geht es dir?') === '', 'no role, no button')
const refFacts = withExtraFacts(baseInteriorFacts({ layout: L, buildingName: 'Freiheitsmühle 7', self: alone[0], figures: alone, playerPos: L.servicePoint }), [...agencyReferralFacts(ref, 2_000), ...AGENCY_ROBOT_FACTS, ...jobAgencyKnowledge(probe)])
check(refFacts.length <= MAX_FACTS && refFacts.some(f => f.startsWith('Dein Gegenüber ist schon vermittelt')) && refFacts.some(f => f.startsWith('Du vermittelst direkt')), 'with a referral the robot still knows how referring works')

if (failures > 0) throw new Error(`job agency: ${failures} checks failed`)
console.log('job agency checks passed')
