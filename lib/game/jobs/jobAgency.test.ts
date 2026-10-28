import { validateInteriorTemplate } from '../buildings/interiors/topology'
import { canSeeRoom, isVenueBlocked, placeVenueFigures, venuePath } from '../hospitality/venues'
import { JOB_AGENCY_LAYOUT as L, distanceM, jobAgencyKnowledge, venueJobOffers } from './jobAgency'

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

if (failures > 0) throw new Error(`job agency: ${failures} checks failed`)
console.log('job agency checks passed')
