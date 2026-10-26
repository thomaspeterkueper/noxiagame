import { validateInteriorTemplate } from '../buildings/interiors/topology'
import { VENUE_PLAYER_RADIUS, canSeeRoom, isVenueBlocked, placeVenueFigures, venuePath } from '../hospitality/venues'
import { baseInteriorFacts, withExtraFacts, MAX_FACTS, MAX_FACT_CHARS } from '../interiors/baseFacts'
import { ACADEMY_LAYOUT, academyKnowledge } from './academyInterior'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }
const L = ACADEMY_LAYOUT

// Fähigkeiten wie learn/teach sind noch nicht im Registry (Sache der Innenräume) – wie beim Café zählen nur Strukturfehler.
check(validateInteriorTemplate(L.template).every(issue => issue.code === 'unknown-capability'), 'the academy template has no structural issues')
check(L.spots.filter(s => s.kind !== 'staff').every(s => canSeeRoom(L, L.playerRoomId, s.roomId)), 'every visitor spot is in the player’s sight area')
check(!isVenueBlocked(L, L.start) && !isVenueBlocked(L, L.servicePoint) && L.spots.filter(s => s.kind === 'seat').every(s => venuePath(L, L.start, s).length >= 2), 'start, secretary and every desk are reachable')
check(L.spots.filter(s => s.kind === 'seat').every(s => !isVenueBlocked(L, { x: s.x, y: s.y + 20 }, VENUE_PLAYER_RADIUS) || !isVenueBlocked(L, { x: s.x, y: s.y - 20 }, VENUE_PLAYER_RADIUS)), 'one can stand next to every desk')
const figures = placeVenueFigures(L, [{ id: 't', worksHere: true }, { id: 'v', worksHere: false }])
check(figures.length === 2 && figures.every(f => f.visibleToPlayer) && figures.find(f => f.id === 't')!.spot.id === 'staff-secretary', 'staff stands at the secretary, visitors sit at a desk, both visible')
const facts = withExtraFacts(baseInteriorFacts({ layout: L, buildingName: 'Akademie Sundern', self: figures[0], figures, playerPos: L.servicePoint, staffRoleText: 'Du arbeitest hier in der Akademie' }), academyKnowledge([{ id: 'm1', title: 'Orbitalmechanik I', domain: 'Navigation' } as any]))
check(facts.length <= MAX_FACTS && facts.every(f => f.length <= MAX_FACT_CHARS) && facts.some(f => f.includes('Orbitalmechanik I')) && facts.some(f => f.includes('am Sekretariat')), 'staff facts fit the route and name the real modules')
check(academyKnowledge([])[0].includes('weißt du im Moment nicht'), 'without a module list nothing is invented')

if (failures > 0) throw new Error(`academy interior: ${failures} checks failed`)
console.log('academy interior checks passed')
