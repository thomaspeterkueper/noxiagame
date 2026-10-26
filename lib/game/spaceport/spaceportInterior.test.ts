import { validateInteriorTemplate } from '../buildings/interiors/topology'
import { canSeeRoom, isVenueBlocked, placeVenueFigures, venuePath } from '../hospitality/venues'
import { baseInteriorFacts, withExtraFacts, MAX_FACTS, MAX_FACT_CHARS } from '../interiors/baseFacts'
import { SPACEPORT_LAYOUT, spaceportKnowledge } from './spaceportInterior'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }
const L = SPACEPORT_LAYOUT

check(validateInteriorTemplate(L.template).every(issue => issue.code === 'unknown-capability'), 'the spaceport template has no structural issues')
check(L.spots.filter(s => s.kind !== 'staff').every(s => canSeeRoom(L, L.playerRoomId, s.roomId)), 'benches and entry are in the arrival hall')
check(!isVenueBlocked(L, L.start) && !isVenueBlocked(L, L.servicePoint) && L.spots.filter(s => s.kind === 'seat').every(s => venuePath(L, L.start, s).length >= 2), 'start, flight control and every bench are reachable')
const figures = placeVenueFigures(L, [{ id: 'a', worksHere: true }, { id: 'b', worksHere: true }, { id: 'c', worksHere: true }, { id: 'd', worksHere: true }, { id: 'v', worksHere: false }])
// Cargo und Wartung sind durch offene Durchgänge einsehbar: Man sieht die Leute dort arbeiten.
check(figures.filter(f => f.roomRole === 'staff' && f.visibleToPlayer).length === 4 && figures.filter(f => f.spot.id.startsWith('staff-control')).length === 2 && figures.some(f => f.spot.roomId === 'cargo') && figures.some(f => f.spot.roomId === 'service'), 'two at flight control, one each in cargo and service, all in sight through the passages')
const facts = withExtraFacts(baseInteriorFacts({ layout: L, buildingName: 'Raumhafen Sundern', self: figures[0], figures, playerPos: L.servicePoint, staffRoleText: 'Du arbeitest hier im Raumhafen' }), spaceportKnowledge({ locationName: 'Sundern', destinations: [{ name: 'Mond / Shackleton', population: 12 }, { name: 'Mars / Tharsis Hub', population: 40 }], hasShip: false, shipTypeId: null, shipRangeKm: null, inTransit: false, canteen: true }))
check(facts.length <= MAX_FACTS && facts.every(f => f.length <= MAX_FACT_CHARS) && facts.some(f => f.includes('Mond / Shackleton')) && facts.some(f => f.includes('kein eigenes Schiff')) && facts.some(f => f.includes('Kantine')), 'flight control knows the real destinations, the ship situation and the canteen')
check(spaceportKnowledge(null)[0].includes('liegen dir gerade nicht vor') && spaceportKnowledge({ locationName: 'X', destinations: [], hasShip: true, shipTypeId: 'freighter_mk1', shipRangeKm: 250, inTransit: false, canteen: false }).some(f => f.includes('freighter_mk1')), 'without data nothing is invented; with a ship it is named')

if (failures > 0) throw new Error(`spaceport interior: ${failures} checks failed`)
console.log('spaceport interior checks passed')
