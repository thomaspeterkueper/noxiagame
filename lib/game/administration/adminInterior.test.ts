import { validateInteriorTemplate } from '../buildings/interiors/topology'
import { canSeeRoom, isVenueBlocked, placeVenueFigures, venuePath } from '../hospitality/venues'
import { baseInteriorFacts, withExtraFacts, MAX_FACTS, MAX_FACT_CHARS } from '../interiors/baseFacts'
import { ADMIN_LAYOUT, adminKnowledge } from './adminInterior'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }
const L = ADMIN_LAYOUT

check(validateInteriorTemplate(L.template).every(issue => issue.code === 'unknown-capability'), 'the civic template has no structural issues')
check(L.spots.filter(s => s.kind !== 'staff').every(s => canSeeRoom(L, L.playerRoomId, s.roomId)), 'bench, meeting table and entry are in the player’s sight area')
check(!isVenueBlocked(L, L.start) && !isVenueBlocked(L, L.servicePoint) && L.spots.filter(s => s.kind === 'seat').every(s => venuePath(L, L.start, s).length >= 2), 'start, counter and every seat are reachable')
const figures = placeVenueFigures(L, [{ id: 'a', worksHere: true }, { id: 'b', worksHere: true }, { id: 'c', worksHere: true }, { id: 'v', worksHere: false }])
check(figures.filter(f => f.roomRole === 'staff' && f.visibleToPlayer).length === 2 && figures.some(f => f.id === 'c' && !f.visibleToPlayer), 'two clerks at the counter, the third works in the back office unseen')
const facts = withExtraFacts(baseInteriorFacts({ layout: L, buildingName: 'Verwaltung Sundern', self: figures[0], figures, playerPos: L.servicePoint, staffRoleText: 'Du arbeitest hier in der Verwaltung des Ortes' }), adminKnowledge({ locationName: 'Sundern', population: 36, populationMax: 120, governorName: null, taxProperty: 2, taxTransaction: 0.19, taxLanding: 0, playerHome: 'earth', playerRegisteredHere: true }))
check(facts.length <= MAX_FACTS && facts.every(f => f.length <= MAX_FACT_CHARS) && facts.some(f => f.includes('36 Einwohner')) && facts.some(f => f.includes('19 %')) && facts.some(f => f.includes('keinen Gouverneur')), 'the clerk knows the public figures of the place')
check(adminKnowledge(null)[0].includes('liegen dir gerade nicht vor'), 'without data nothing is invented')

if (failures > 0) throw new Error(`admin interior: ${failures} checks failed`)
console.log('admin interior checks passed')
