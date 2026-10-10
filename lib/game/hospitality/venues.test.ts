import { validateInteriorTemplate } from '../buildings/interiors/topology'
import { CAFE_STANDARD_INTERIOR } from '../buildings/interiors/templates/cafeStandard'
import { getInteriorTemplateForBuildingType } from '../buildings/interiors/registry'
import { getBuildingEntryDefinition } from '../buildings/entry'
import { isSocialInfrastructure, arrivalPoints, SOCIAL_HOSPITALITY_EQUIVALENTS } from '../settlements/tiers'
import {
  ARRIVAL_ORIENTATION_FACTS,
  MAX_CONVERSATION_FACTS,
  MAX_CONVERSATION_FACT_CHARS,
  VENUE_LAYOUTS,
  VENUE_PLAYER_RADIUS,
  canSeeRoom,
  describePlayerPosition,
  isVenueBlocked,
  placeVenueFigures,
  venueConversationFacts,
  venueKindForBuildingType,
  venueService,
  type VenueKind,
  type VenueLayout,
  type VenuePoint,
  type VenueResidentInput,
} from './venues'

let failures = 0
const check = (ok: boolean, label: string) => { if (!ok) { failures++; console.error('FAIL: ' + label) } }

const kinds: VenueKind[] = ['cafe', 'bar', 'restaurant']

// ── Zuordnung ───────────────────────────────────────────────────────────────
check(venueKindForBuildingType('cafe') === 'cafe' && venueKindForBuildingType('café') === 'cafe', 'cafe ids map to cafe')
check(venueKindForBuildingType('bar') === 'bar' && venueKindForBuildingType('restaurant') === 'restaurant', 'bar and restaurant have their own layout')
check(venueKindForBuildingType('unknown') === 'cafe' && venueKindForBuildingType(null) === 'cafe', 'unknown types keep the cafe layout')
for (const kind of kinds) {
  const layout = VENUE_LAYOUTS[kind]
  check(getInteriorTemplateForBuildingType(kind)?.id === layout.template.id, kind + ': layout uses the registered interior template')
  check(getBuildingEntryDefinition(kind)?.kind === 'hospitality', kind + ': building can be entered as hospitality')
  check(isSocialInfrastructure(kind), kind + ': is social infrastructure')
}
check(arrivalPoints(kinds).join(',') === 'cafe,bar', 'restaurant is not an arrival point')
check(!(SOCIAL_HOSPITALITY_EQUIVALENTS as readonly string[]).includes('restaurant'), 'restaurant does not fulfil the standard equipment')

// Die neuen Vorlagen dürfen keine anderen Befunde haben als das bestehende Café.
const issueCodes = (kind: VenueKind) => [...new Set(validateInteriorTemplate(VENUE_LAYOUTS[kind].template).map(issue => issue.code))].sort().join(',')
const cafeIssues = [...new Set(validateInteriorTemplate(CAFE_STANDARD_INTERIOR).map(issue => issue.code))].sort().join(',')
for (const kind of kinds) check(issueCodes(kind) === cafeIssues, kind + ': template validates like the cafe template')

// ── Innenaufbau ─────────────────────────────────────────────────────────────
const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

function reachable(layout: VenueLayout, target: VenuePoint, tolerance: number): boolean {
  const step = 6
  const key = (p: VenuePoint) => p.x + ':' + p.y
  const seen = new Set<string>([key(layout.start)])
  const queue: VenuePoint[] = [layout.start]
  while (queue.length) {
    const p = queue.shift() as VenuePoint
    if (Math.hypot(p.x - target.x, p.y - target.y) <= tolerance) return true
    for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const next = { x: p.x + dx, y: p.y + dy }
      if (seen.has(key(next)) || isVenueBlocked(layout, next)) continue
      seen.add(key(next))
      queue.push(next)
    }
  }
  return false
}

for (const kind of kinds) {
  const layout = VENUE_LAYOUTS[kind]
  const roomIds = new Set(layout.template.rooms.map(room => room.id))
  check(!isVenueBlocked(layout, layout.start), kind + ': start is walkable')
  check(layout.furniture.every(item => item.x >= 35 && item.y >= 42 && item.x + item.w <= layout.width - 35 && item.y + item.h <= layout.height - 34), kind + ': furniture stays inside the walls')
  const solid = layout.furniture.filter(item => item.kind !== 'pass')
  check(solid.every((a, i) => solid.every((b, j) => i >= j || !overlaps(a, b))), kind + ': furniture does not overlap')
  check(new Set(layout.furniture.map(item => item.id)).size === layout.furniture.length, kind + ': furniture ids are unique')
  check(new Set(layout.spots.map(spot => spot.id)).size === layout.spots.length, kind + ': spot ids are unique')
  check(layout.spots.every(spot => roomIds.has(spot.roomId)), kind + ': every spot lies in a template room')
  check(roomIds.has(layout.playerRoomId), kind + ': player room exists in template')
  check(reachable(layout, layout.servicePoint, 12), kind + ': service point is reachable on foot')
  check(reachable(layout, layout.exit, 30), kind + ': exit is reachable on foot')
  for (const spot of layout.spots) {
    const visible = canSeeRoom(layout, layout.playerRoomId, spot.roomId)
    const inFurniture = layout.furniture.some(item => spot.x > item.x && spot.x < item.x + item.w && spot.y > item.y && spot.y < item.y + item.h)
    if (spot.kind === 'seat') {
      check(layout.furniture.some(item => (item.kind === 'chair' || item.kind === 'stool') && spot.x > item.x && spot.x < item.x + item.w && spot.y > item.y && spot.y < item.y + item.h), kind + ': seat ' + spot.id + ' is on a chair or stool')
      check(reachable(layout, spot, VENUE_PLAYER_RADIUS + 26), kind + ': player can walk up to seat ' + spot.id)
    } else if (visible) {
      check(!inFurniture, kind + ': ' + spot.id + ' does not stand inside furniture')
    }
  }
  check(layout.spots.filter(spot => spot.kind === 'staff' && canSeeRoom(layout, layout.playerRoomId, spot.roomId)).length >= 1, kind + ': at least one staff spot is in view')
  for (const text of [layout.roomFact, layout.guestBackFact, layout.staffBackFact]) check(text.length <= MAX_CONVERSATION_FACT_CHARS, kind + ': room fact fits the pipeline limit')
}
check(VENUE_LAYOUTS.cafe.spots.filter(s => s.kind === 'seat').length === 8, 'cafe has eight seats as its room fact says')
check(VENUE_LAYOUTS.bar.spots.filter(s => s.id.startsWith('stool-')).length === 5 && VENUE_LAYOUTS.bar.furniture.filter(f => f.kind === 'high-table').length === 3, 'bar has five stools and three high tables as its room fact says')
check(VENUE_LAYOUTS.restaurant.furniture.filter(f => f.kind === 'table').length === 8, 'restaurant has eight tables as its room fact says')

// ── Sichtweite ──────────────────────────────────────────────────────────────
check(canSeeRoom(VENUE_LAYOUTS.cafe, 'guest-room', 'counter') && canSeeRoom(VENUE_LAYOUTS.cafe, 'entry', 'counter'), 'cafe: entry, guest room and counter are one sight area')
check(!canSeeRoom(VENUE_LAYOUTS.cafe, 'guest-room', 'back-room'), 'cafe: back room is out of sight')
check(!canSeeRoom(VENUE_LAYOUTS.restaurant, 'guest-room', 'kitchen') && !canSeeRoom(VENUE_LAYOUTS.restaurant, 'kitchen', 'guest-room'), 'restaurant: kitchen and dining room do not see each other')
check(!canSeeRoom(VENUE_LAYOUTS.cafe, 'guest-room', 'nowhere'), 'unknown rooms are never in sight')

// ── Figuren ─────────────────────────────────────────────────────────────────
const guests = (n: number): VenueResidentInput[] => Array.from({ length: n }, (_, i) => ({ id: 'guest-' + String(i).padStart(2, '0'), worksHere: false }))
for (const kind of kinds) {
  const layout = VENUE_LAYOUTS[kind]
  const input: VenueResidentInput[] = [{ id: 'worker-a', worksHere: true }, { id: 'friend', worksHere: false, isCompanion: true }, ...guests(40)]
  const figures = placeVenueFigures(layout, input)
  const again = placeVenueFigures(layout, [...input].reverse())
  const byId = (list: typeof figures) => JSON.stringify([...list].sort((a, b) => a.id.localeCompare(b.id)).map(f => [f.id, f.spot.id]))
  check(byId(figures) === byId(again), kind + ': placement does not depend on input order')
  const shown = figures.filter(f => f.visibleToPlayer)
  check(new Set(shown.map(f => f.spot.id)).size === shown.length, kind + ': no two visible figures share a spot')
  const worker = figures.find(f => f.id === 'worker-a')
  check(worker?.roomRole === 'staff' && worker.spot.kind === 'staff' && worker.visibleToPlayer, kind + ': first worker stands at a visible staff spot')
  const friend = figures.find(f => f.id === 'friend')
  check(friend?.roomRole === 'companion' && friend.spot.label === 'beim Eingang', kind + ': companion waits at the entrance')
  check(figures.filter(f => f.roomRole === 'guest').every(f => f.spot.kind !== 'staff'), kind + ': guests never stand at staff spots')
  const guestSpotCount = layout.spots.filter(s => s.kind !== 'staff' && !s.id.startsWith('entry-')).length
  check(figures.filter(f => f.roomRole === 'guest').length === guestSpotCount, kind + ': guests fill the room and no further')
  check(placeVenueFigures(layout, [{ id: 'x', worksHere: false }, { id: 'x', worksHere: false }]).length === 1, kind + ': duplicate residents are placed once')
}

const cafe = VENUE_LAYOUTS.cafe
const twoWorkers = placeVenueFigures(cafe, [{ id: 'w1', worksHere: true }, { id: 'w2', worksHere: true }])
check(twoWorkers[0].visibleToPlayer && !twoWorkers[1].visibleToPlayer && twoWorkers[1].spot.roomId === 'back-room', 'cafe: a second worker without a counter spot is busy in the back room')
const frontWorkers = placeVenueFigures(cafe, [{ id: 'w1', worksHere: true }, { id: 'w2', worksHere: true, presenceRoomId: 'guest-room' }])
check(frontWorkers.every(f => f.visibleToPlayer), 'cafe: a worker known to be in front stays visible')
const backGuest = placeVenueFigures(cafe, [{ id: 'g', worksHere: false, presenceRoomId: 'back-room' }])
check(backGuest.length === 1 && !backGuest[0].visibleToPlayer, 'recorded presence in an unseen room hides the figure')
const stray = placeVenueFigures(cafe, [{ id: 'g', worksHere: false, presenceRoomId: 'analysis-lab' }])
check(stray[0].visibleToPlayer, 'presence from a foreign template is ignored, not trusted')

const restaurant = VENUE_LAYOUTS.restaurant
const brigade = placeVenueFigures(restaurant, [{ id: 'a', worksHere: true }, { id: 'b', worksHere: true }, { id: 'c', worksHere: true }])
check(brigade.map(f => f.spot.label).join('|') === 'am Empfang|an der Durchreiche|in der Küche', 'restaurant: desk, pass, kitchen in that order')
check(brigade[2].visibleToPlayer === false, 'restaurant: the cook is not visible from the dining room')

// ── Wo steht der Spieler? ───────────────────────────────────────────────────
check(describePlayerPosition(cafe, cafe.start) === 'beim Eingang', 'player at the start is at the entrance')
check(describePlayerPosition(cafe, cafe.servicePoint) === 'am Tresen', 'player at the service point is at the counter')
check(describePlayerPosition(restaurant, restaurant.servicePoint) === 'am Empfang', 'restaurant service point is the desk')
check(describePlayerPosition(cafe, { x: 300, y: 175 }) === 'an Tisch 1' || describePlayerPosition(cafe, { x: 300, y: 175 }) === 'an Tisch 2', 'player between tables is at a table')
check(describePlayerPosition(cafe, { x: 480, y: 400 }) === 'mitten im Raum', 'player away from everything is in the room')

// ── Gesprächswissen ─────────────────────────────────────────────────────────
const FORBIDDEN = /kontostand von|wissensstufe \d|heimatort ist|guest-\d|worker-|friend/i
for (const kind of kinds) {
  const layout = VENUE_LAYOUTS[kind]
  const figures = placeVenueFigures(layout, [
    { id: 'worker-a', worksHere: true }, { id: 'worker-b', worksHere: true }, { id: 'worker-c', worksHere: true },
    { id: 'friend', worksHere: false, isCompanion: true }, ...guests(40),
  ])
  for (const arrivalPoint of [true, false]) for (const self of figures) {
    const facts = venueConversationFacts({ layout, buildingName: 'Zur langen Nacht am Raumhafen mit einem wirklich sehr, sehr langen Namen', self, figures, playerPos: layout.start, arrivalPoint })
    check(facts.length <= MAX_CONVERSATION_FACTS, kind + ': at most 16 facts for ' + self.id)
    check(facts.every(fact => fact.length > 0 && fact.length <= MAX_CONVERSATION_FACT_CHARS), kind + ': every fact fits 140 chars for ' + self.id)
    check(!facts.some(fact => FORBIDDEN.test(fact)), kind + ': no ids, names or player state leak for ' + self.id)
    check(facts.some(fact => fact.includes(self.spot.label)), kind + ': ' + self.id + ' knows its own place')
    const knowsWay = facts.some(fact => fact === ARRIVAL_ORIENTATION_FACTS[1])
    check(knowsWay === (self.roomRole === 'staff' && arrivalPoint), kind + ': only staff of an arrival point explains the way in (' + self.id + ')')
    check(facts.includes(self.roomRole === 'staff' ? layout.staffBackFact : layout.guestBackFact), kind + ': back area knowledge follows the room role for ' + self.id)
    check(!facts.includes(self.roomRole === 'staff' ? layout.guestBackFact : layout.staffBackFact), kind + ': no foreign back area knowledge for ' + self.id)
    check(facts.some(fact => /ausgeschenkt/.test(fact)), kind + ': nobody pretends to serve or charge (' + self.id + ')')
  }
}

const cook = brigade[2]
const cookFacts = venueConversationFacts({ layout: restaurant, buildingName: 'Sol', self: cook, figures: brigade, playerPos: restaurant.start, arrivalPoint: false })
check(!cookFacts.includes(restaurant.roomFact) && !cookFacts.some(f => /Gegenüber steht|siehst du/.test(f)), 'the cook knows nothing about the dining room it cannot see')

const lonely = placeVenueFigures(cafe, [{ id: 'w', worksHere: true }])
const lonelyFacts = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: lonely[0], figures: lonely, playerPos: cafe.servicePoint, arrivalPoint: true })
check(lonelyFacts[0] === 'Ihr befindet euch im Café Sol', 'location fact names the venue')
check(lonelyFacts.includes('Außer dir und deinem Gegenüber siehst du gerade niemanden im Raum'), 'an empty room is described as empty')
check(lonelyFacts.includes('Dein Gegenüber steht gerade am Tresen'), 'the figure sees where the player stands')
check(lonelyFacts.length === 8 + ARRIVAL_ORIENTATION_FACTS.length, 'staff facts: eight room facts plus orientation')

const pair = placeVenueFigures(cafe, [{ id: 'w', worksHere: true }, { id: 'g1', worksHere: false }, { id: 'hidden', worksHere: false, presenceRoomId: 'back-room' }])
const g1 = pair.find(f => f.id === 'g1')!
const g1Facts = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: g1, figures: pair, playerPos: cafe.start, arrivalPoint: true })
check(g1Facts.some(f => f.startsWith('Außer euch siehst du im Raum: eine Person hinter dem Tresen') && f.endsWith('ihre Namen kennst du nicht')), 'a guest sees the person behind the counter, without a name')
check(!g1Facts.some(f => /zwei Personen|Nebenraum/.test(f)), 'a guest does not count the person in the back room')

// ── Betrieb und Karte ───────────────────────────────────────────────────────
check(venueService(cafe, lonely) === 'staffed', 'a venue with a worker is staffed')
check(venueService(cafe, placeVenueFigures(cafe, guests(3))) === 'self-service', 'a cafe without staff is a self-service cafe')
check(venueService(VENUE_LAYOUTS.bar, placeVenueFigures(VENUE_LAYOUTS.bar, guests(3))) === 'closed' && venueService(restaurant, []) === 'closed', 'bar and restaurant without staff are closed')
check(venueService(restaurant, [brigade[2]]) === 'staffed', 'a cook alone still keeps the restaurant open')

const cafeMenu = [{ label: 'Getränk', priceCredits: 3 }, { label: 'Kuchen', priceCredits: 5 }, { label: 'Mahlzeit', priceCredits: 8 }]
const staffMenuFacts = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: pair[0].roomRole === 'staff' ? pair[0] : pair.find(f => f.roomRole === 'staff')!, figures: pair, playerPos: cafe.servicePoint, arrivalPoint: true, menu: cafeMenu, playerOrders: ['Kuchen', 'Kuchen', 'Getränk'] })
check(staffMenuFacts.includes('Karte: Getränk 3, Kuchen 5, Mahlzeit 8 Credits; bestellt und bezahlt wird am Tresen, nicht im Gespräch'), 'staff knows the menu and where it is paid')
check(staffMenuFacts.includes('Dein Gegenüber hat hier eben bestellt: 2× Kuchen, Getränk'), 'staff saw what the player ordered')
check(!staffMenuFacts.some(f => /ausgeschenkt/.test(f)), 'with a menu nobody claims the venue does not serve')
check(staffMenuFacts.length === MAX_CONVERSATION_FACTS && staffMenuFacts.every(f => f.length <= MAX_CONVERSATION_FACT_CHARS), 'staff facts with menu and orders use the full budget, not more')
check(staffMenuFacts[staffMenuFacts.length - 1] === ARRIVAL_ORIENTATION_FACTS[ARRIVAL_ORIENTATION_FACTS.length - 1], 'no orientation fact is cut off')
const guestMenuFacts = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: g1, figures: pair, playerPos: cafe.start, arrivalPoint: true, menu: cafeMenu })
check(guestMenuFacts.includes('Bestellt und bezahlt wird am Tresen beim Personal; die Preise hast du nicht im Kopf') && !guestMenuFacts.some(f => /Karte:|\d Credits/.test(f)), 'a guest knows where to order but not the prices')
const automat = placeVenueFigures(cafe, guests(2))
const automatFacts = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: automat[0], figures: automat, playerPos: cafe.start, arrivalPoint: true, menu: cafeMenu })
check(automatFacts.includes('Hier bedient kein Personal; bestellt und bezahlt wird am Automaten am Tresen'), 'in a self-service cafe guests point to the machine')
check(!automatFacts.some(f => f === ARRIVAL_ORIENTATION_FACTS[1]), 'nobody in a self-service cafe explains the way in')
const longMenu = Array.from({ length: 30 }, (_, i) => ({ label: 'Tagesgericht Nummer ' + i, priceCredits: 10 + i }))
const longFacts = venueConversationFacts({ layout: restaurant, buildingName: 'Sol', self: brigade[0], figures: brigade, playerPos: restaurant.start, arrivalPoint: false, menu: longMenu })
check(longFacts.every(f => f.length <= MAX_CONVERSATION_FACT_CHARS) && longFacts.some(f => f.startsWith('Karte: Tagesgericht Nummer 0 10') && f.endsWith('nicht im Gespräch')), 'a long menu is shortened without losing where to pay')

if (failures > 0) throw new Error(`hospitality venues: ${failures} checks failed`)
console.log('hospitality venue checks passed')
