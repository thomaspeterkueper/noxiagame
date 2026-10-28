import { validateInteriorTemplate } from '../buildings/interiors/topology'
import { CONSUMPTION_INTERVAL_S, VISIT_TOTAL_S, spreadVisitAge } from './venues'
import { CAFE_STANDARD_INTERIOR } from '../buildings/interiors/templates/cafeStandard'
import { getInteriorTemplateForBuildingType } from '../buildings/interiors/registry'
import { getBuildingEntryDefinition } from '../buildings/entry'
import { isSocialInfrastructure, arrivalPoints, SOCIAL_HOSPITALITY_EQUIVALENTS } from '../settlements/tiers'
import { venueIntroduction, MAX_INTRO_LEADS, MAX_INTRO_LEAD_CHARS, MAX_INTRO_STANCE_CHARS } from './introductions'
import { venueHearsay, MAX_HEARSAY, MAX_HEARSAY_CHARS } from './hearsay'
import {
  freeSeats,
  nearestFreeSeat,
  seatBeside,
  seatForGuest,
  tableServicePhase,
  tableServiceSpot,
  TABLE_SERVICE,
  likesCompany,
  ARRIVAL_ORIENTATION_FACTS,
  MAX_CONVERSATION_FACTS,
  MAX_CONVERSATION_FACT_CHARS,
  VENUE_LAYOUTS,
  VENUE_PLAYER_RADIUS,
  canSeeRoom,
  describePlayerPosition,
  hasUpperFloor,
  upperFloorFact,
  venueClosedReason,
  venueOpenAt,
  venueSizeForArea,
  venueLayoutForSize,
  venueHoursText,
  roomsFact,
  roomsFree,
  canBookRoom,
  ROOM_ITEM_CODE,
  venueHoursFor,
  clockLabel,
  withUpperFloor,
  guestMoment,
  pointAlongPath,
  venuePath,
  visitPhase,
  VISIT_TIMES,
  isAtServicePoint,
  isVenueBlocked,
  placeVenueFigures,
  venueConversationFacts,
  venueKindForBuildingType,
  venueKindForRealPlace,
  venueService,
  type VenueKind,
  type VenueLayout,
  type VenuePoint,
  type VenueResidentInput,
} from './venues'

let failures = 0
const check = (ok: boolean, label: string) => { if (!ok) { failures++; console.error('FAIL: ' + label) } }

const kinds: VenueKind[] = ['cafe', 'bar', 'restaurant', 'hotel']

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

// Am Tresen steht, wer irgendwo an seiner Kante steht – nicht nur in der Mitte.
check(isAtServicePoint(cafe, { x: 548, y: 172 }) && isAtServicePoint(cafe, { x: 690, y: 172 }), 'both ends of the cafe counter count as at the counter')
check(isAtServicePoint(cafe, { x: 500, y: 126 }), 'standing at the short side of the counter counts')
check(!isAtServicePoint(cafe, cafe.start) && !isAtServicePoint(cafe, { x: 440, y: 230 }), 'entrance and tables are not the counter')
check(isAtServicePoint(VENUE_LAYOUTS.bar, { x: 520, y: 100 }) && isAtServicePoint(VENUE_LAYOUTS.bar, { x: 520, y: 330 }), 'the whole length of the bar counts')
check(isAtServicePoint(restaurant, restaurant.servicePoint) && !isAtServicePoint(restaurant, { x: 400, y: 200 }), 'restaurant: desk yes, dining room no')

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
check(staffMenuFacts.includes('Karte: Getränk 3, Kuchen 5, Mahlzeit 8 Credits; gebucht ist nur, was der Gast bestätigt – nie „notiert“ sagen'), 'staff knows the menu and where it is paid')
check(staffMenuFacts.includes('Dein Gegenüber hat hier eben bestellt: 2× Kuchen, Getränk'), 'staff saw what the player ordered')
check(!staffMenuFacts.some(f => /ausgeschenkt/.test(f)), 'with a menu nobody claims the venue does not serve')
check(staffMenuFacts.length === MAX_CONVERSATION_FACTS && staffMenuFacts.every(f => f.length <= MAX_CONVERSATION_FACT_CHARS), 'staff facts with menu and orders use the full budget, not more')
check(staffMenuFacts[staffMenuFacts.length - 1] === ARRIVAL_ORIENTATION_FACTS[ARRIVAL_ORIENTATION_FACTS.length - 1], 'no orientation fact is cut off')
const mikaSelf = pair.find(f => f.roomRole === 'staff')!
const treatFacts = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: mikaSelf, figures: pair, playerPos: cafe.servicePoint, arrivalPoint: true, menu: cafeMenu, playerOrders: ['Kuchen'], giftsToSelf: ['Getränk'] })
check(treatFacts.includes('Dein Gegenüber hat dir eben ausgegeben: Getränk; es steht vor dir. Für sich selbst bestellt: Kuchen'), 'the treated figure knows it was treated and what the player ordered')
check(treatFacts.length === MAX_CONVERSATION_FACTS && treatFacts.every(f => f.length <= MAX_CONVERSATION_FACT_CHARS), 'a treat does not push staff facts over the limit')
const onlyTreat = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: g1, figures: pair, playerPos: cafe.start, arrivalPoint: true, menu: cafeMenu, giftsToSelf: ['Getränk', 'Getränk'] })
check(onlyTreat.includes('Dein Gegenüber hat dir eben ausgegeben: 2× Getränk; es steht vor dir'), 'a treated guest knows it too')
const bystander = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: g1, figures: pair, playerPos: cafe.start, arrivalPoint: true, menu: cafeMenu, playerOrders: ['Getränk'] })
check(bystander.includes('Dein Gegenüber hat hier eben bestellt: Getränk') && !bystander.some(f => /ausgegeben/.test(f)), 'a bystander only saw an order')

const guestMenuFacts = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: g1, figures: pair, playerPos: cafe.start, arrivalPoint: true, menu: cafeMenu })
check(guestMenuFacts.includes('Bestellt und bezahlt wird am Tresen beim Personal; die Preise hast du nicht im Kopf') && !guestMenuFacts.some(f => /Karte:|\d Credits/.test(f)), 'a guest knows where to order but not the prices')
const automat = placeVenueFigures(cafe, guests(2))
const automatFacts = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: automat[0], figures: automat, playerPos: cafe.start, arrivalPoint: true, menu: cafeMenu })
check(automatFacts.includes('Hier bedient kein Personal; bestellt und bezahlt wird am Automaten am Tresen'), 'in a self-service cafe guests point to the machine')
check(!automatFacts.some(f => f === ARRIVAL_ORIENTATION_FACTS[1]), 'nobody in a self-service cafe explains the way in')
const longMenu = Array.from({ length: 30 }, (_, i) => ({ label: 'Tagesgericht Nummer ' + i, priceCredits: 10 + i }))
const longFacts = venueConversationFacts({ layout: restaurant, buildingName: 'Sol', self: brigade[0], figures: brigade, playerPos: restaurant.start, arrivalPoint: false, menu: longMenu })
check(longFacts.every(f => f.length <= MAX_CONVERSATION_FACT_CHARS) && longFacts.some(f => f.startsWith('Karte: Tagesgericht Nummer 0 10') && f.endsWith('nie „notiert“ sagen')), 'a long menu is shortened without losing the booking rule')

// ── Besuch eines Gastes ─────────────────────────────────────────────────────
check(visitPhase(0).phase === 'ordering' && visitPhase(VISIT_TIMES.orderS - 1).phase === 'ordering', 'a visit starts at the counter')
check(visitPhase(VISIT_TIMES.orderS + 1).phase === 'to-seat' && visitPhase(600).phase === 'seated', 'then the guest walks to the seat and sits')
const visitEnd = VISIT_TIMES.orderS + VISIT_TIMES.walkS + VISIT_TIMES.stayS
check(visitPhase(visitEnd + 1).phase === 'leaving' && visitPhase(visitEnd + VISIT_TIMES.leaveS + 1).phase === 'gone' && visitPhase(99999).phase === 'gone', 'after the stay the guest leaves and is gone')
check(visitPhase(-5).phase === 'ordering', 'a clock running slightly ahead does not break the visit')
for (const kind of kinds) {
  const layout = VENUE_LAYOUTS[kind]
  for (const seat of layout.spots.filter(spot => spot.kind !== 'staff')) {
    for (const [from, to, what] of [[layout.servicePoint, seat, 'to'], [seat, layout.exit, 'from']] as const) {
      const path = venuePath(layout, from, to)
      check(path.length > 2, kind + ': a way ' + what + ' ' + seat.id + ' exists')
      check(path.slice(1, -1).every(p => !isVenueBlocked(layout, p, 7)), kind + ': the way ' + what + ' ' + seat.id + ' goes around the furniture')
      check(path.slice(1).every((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y) < 60), kind + ': the way ' + what + ' ' + seat.id + ' has no jumps')
    }
  }
}
check(JSON.stringify(pointAlongPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 0.75)) === JSON.stringify({ x: 10, y: 5 }), 'position along a path follows its length')
const seat = cafe.spots.find(spot => spot.id === 'table-3-l')!
check(guestMoment(cafe, seat, 10).spot.label === 'am Tresen' && !guestMoment(cafe, seat, 10).served, 'a guest who just bought stands at the counter, not yet served')
const sitting = guestMoment(cafe, seat, 900)
check(sitting.phase === 'seated' && sitting.point.x === seat.x && sitting.served, 'later the guest sits at the seat with the order')
check(guestMoment(cafe, seat, visitEnd + 5).spot.label === 'auf dem Weg zum Ausgang', 'at the end the guest is on the way out')
const buyer = { ...g1, spot: sitting.spot }
const buyerFacts = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: buyer, figures: pair, playerPos: cafe.start, arrivalPoint: true, ownOrder: 'Mahlzeit' })
check(buyerFacts.includes('Du hast hier vor kurzem selbst bestellt und bezahlt: Mahlzeit') && !buyerFacts.some(f => /nichts bestellt|nichts ausgeschenkt/.test(f)), 'a guest who bought knows it and does not claim nothing is served')

// ── Öffnungszeiten ──────────────────────────────────────────────────────────
check(venueOpenAt('cafe', 6) && venueOpenAt('cafe', 19) && !venueOpenAt('cafe', 20) && !venueOpenAt('cafe', 5), 'cafe: open through the day')
check(venueOpenAt('bar', 17) && venueOpenAt('bar', 23) && venueOpenAt('bar', 1) && !venueOpenAt('bar', 2) && !venueOpenAt('bar', 12), 'bar: open through the night, across midnight')
check(venueOpenAt('restaurant', 11) && !venueOpenAt('restaurant', 23) && venueOpenAt('cafe', 30), 'hours repeat every day')
check(venueService(cafe, lonely, 12) === 'staffed' && venueService(cafe, lonely, 3) === 'closed' && venueClosedReason(cafe, lonely, 3) === 'hours', 'a staffed cafe is closed at night – because of the hour')
check(venueService(cafe, [], 3) === 'self-service', 'a self-service cafe has no closing time')
check(venueClosedReason(VENUE_LAYOUTS.bar, [], 20) === 'no-staff' && venueClosedReason(cafe, lonely, 12) === null, 'a bar without staff is closed for lack of staff, even in the evening')
check(venueService(cafe, lonely) === 'staffed' && venueService(cafe, lonely, null) === 'staffed', 'without a clock no hours apply')
const noonFacts = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: lonely[0], figures: lonely, playerPos: cafe.start, arrivalPoint: true, hour: 12 })
check(noonFacts[0] === 'Ihr befindet euch im Café Sol; es ist etwa 12 Uhr, geöffnet ist von 6 bis 20 Uhr', 'everyone in the room knows the time and the opening hours')
check(venueConversationFacts({ layout: restaurant, buildingName: 'x'.repeat(90), self: brigade[0], figures: brigade, playerPos: restaurant.start, arrivalPoint: false, hour: 22 })[0].length <= MAX_CONVERSATION_FACT_CHARS, 'the clock never pushes the first fact over the limit')

// ── Obergeschoss ────────────────────────────────────────────────────────────
check(!hasUpperFloor(null) && !hasUpperFloor({ homes: 0, guestRooms: 0 }) && hasUpperFloor({ homes: 2, guestRooms: 0 }), 'an upper floor exists only if the building data say so')
for (const kind of kinds) {
  if (kind === 'hotel') continue // das Hotel hat seine Treppe von Anfang an
  const upper = withUpperFloor(VENUE_LAYOUTS[kind])
  const stairs = upper.furniture.find(item => item.kind === 'stairs')!
  check(Boolean(stairs) && !VENUE_LAYOUTS[kind].furniture.some(item => item.kind === 'stairs'), kind + ': stairs appear only in the variant with an upper floor')
  check(upper.furniture.filter(item => item !== stairs && item.kind !== 'pass').every(item => !overlaps(item, stairs)), kind + ': the stairs stand clear of the furniture')
  check(reachable(upper, upper.servicePoint, 12) && upper.spots.filter(spot => spot.kind === 'seat').every(spot => reachable(upper, spot, VENUE_PLAYER_RADIUS + 26)), kind + ': with stairs every seat and the counter stay reachable')
  check(withUpperFloor(VENUE_LAYOUTS[kind]) === upper, kind + ': the variant is built once')
}
const flat = { homes: 2, guestRooms: 0 }, hotel = { homes: 0, guestRooms: 8 }
const staffFlat = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: lonely[0], figures: lonely, playerPos: cafe.start, arrivalPoint: true, menu: cafeMenu, playerOrders: ['Kuchen'], upper: flat, hour: 12 })
check(staffFlat.includes(upperFloorFact(flat, true)) && !staffFlat.includes(cafe.staffBackFact), 'staff knows about the flat above')
check(staffFlat.length === MAX_CONVERSATION_FACTS && staffFlat.every(f => f.length <= MAX_CONVERSATION_FACT_CHARS), 'upper floor and clock keep the staff facts within the limit')
const guestFlat = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: g1, figures: pair, playerPos: cafe.start, arrivalPoint: true, upper: flat })
check(guestFlat.includes('In der Ecke führt eine Treppe nach oben; sie ist privat, was oben ist, weißt du nicht'), 'a guest sees the stairs and nothing more')
check(upperFloorFact(hotel, true).includes('8 Gästezimmer') && upperFloorFact(hotel, true).includes('keine Übernachtungsgäste') && upperFloorFact(hotel, true).length <= MAX_CONVERSATION_FACT_CHARS, 'hotel staff knows the rooms and does not pretend to let them yet')

// ── Mitbekommenes ───────────────────────────────────────────────────────────
const heard = venueHearsay({ guestsToday: 3, hoursSinceLastGuest: 2.2, builds: [{ name: 'Fabrik', distanceM: 820, bearingDeg: 90 }], conflicts: 2, assistances: 1, jobSeekers: 4 })
check(heard[0] === 'Selbst gesehen: Seit gestern waren drei Gäste hier; der letzte vor etwa zwei Stunden', 'own observation: guests of the day')
check(heard.includes('Gehört: Am Ort wird gebaut – Fabrik, ca. 800 m östlich') && heard.includes('Gehört: Vier Leute am Ort suchen Arbeit'), 'hearsay: building site and job seekers')
check(heard.includes('Gehört: Seit gestern gab es am Ort zweimal Streit; wer beteiligt war, weißt du nicht'), 'hearsay about a conflict names nobody')
check(heard.every(line => /^(Selbst gesehen|Gehört): /.test(line) && line.length <= MAX_HEARSAY_CHARS) && heard.length <= MAX_HEARSAY, 'every line says whether it was seen or heard and fits the limit')
const quiet = venueHearsay({ guestsToday: 0, hoursSinceLastGuest: null, builds: [], conflicts: 0, assistances: 0, jobSeekers: 0 })
check(quiet.length === 1 && quiet[0].includes('niemand etwas bestellt'), 'a quiet day yields one honest line and no invented rumours')
check(venueHearsay({ guestsToday: 1, hoursSinceLastGuest: 0.2, builds: [], conflicts: 1, assistances: 0, jobSeekers: 1 }).join('|') === 'Selbst gesehen: Seit gestern war ein Gast hier; der letzte Gast war eben erst da|Gehört: Eine Person am Ort sucht Arbeit|Gehört: Seit gestern gab es am Ort einen Streit; wer beteiligt war, weißt du nicht', 'singular forms')

// ── Einführung je Haus ──────────────────────────────────────────────────────
const intros = ([['cafe', 0], ['bar', 0], ['restaurant', 0], ['cafe', 6]] as const).map(([kind, rooms]) => venueIntroduction(kind, rooms))
check(new Set(intros.map(entry => entry.stance)).size === 4 && intros[3].style === 'hotel', 'every house introduces newcomers in its own way; guest rooms make it a hotel')
check(intros.every(entry => entry.stance.length <= MAX_INTRO_STANCE_CHARS && entry.leads.length >= 3 && entry.leads.length <= MAX_INTRO_LEADS && entry.leads.every(lead => lead.length <= MAX_INTRO_LEAD_CHARS)), 'stance and leads fit the limits of the conversation route')
check(intros.every(entry => !/\d|Stelle frei|sucht (einen|eine)|Kapitän|heißt/.test(entry.leads.join(' '))), 'no lead names a concrete offer, price or person')

// ── Hinsetzen und Dazusetzen ────────────────────────────────────────────────
for (const kind of kinds) {
  const room = VENUE_LAYOUTS[kind]
  const seats = freeSeats(room, [])
  check(seats.length >= 4 && seats.every(spot => venuePath(room, room.start, spot).length >= 2 && venuePath(room, spot, room.servicePoint).length >= 2), kind + ': the player can walk to every seat and from there to the counter')
  const mine = nearestFreeSeat(room, [], room.start)!
  const beside = seatBeside(room, mine, [])
  check(Boolean(beside) && beside!.id !== mine.id && beside!.label === mine.label, kind + ': there is a second seat at the same table')
  const liker = ['a', 'b', 'c', 'd', 'e', 'f'].find(likesCompany)!, loner = ['a', 'b', 'c', 'd', 'e', 'f'].find(id => !likesCompany(id))!
  const far = seats.find(spot => spot.label !== mine.label)!
  check(seatForGuest(room, far, liker, 100, { seat: mine, seatedForS: 60 }, []).joined && seatForGuest(room, far, liker, 100, { seat: mine, seatedForS: 60 }, []).seat.id === beside!.id, kind + ': a sociable guest who leaves the counter after the player sat down joins the table')
  check(!seatForGuest(room, far, liker, 400, { seat: mine, seatedForS: 60 }, []).joined, kind + ': a guest already on the way keeps the seat')
  check(!seatForGuest(room, far, loner, 100, { seat: mine, seatedForS: 60 }, []).joined && !seatForGuest(room, far, liker, 100, null, []).joined, kind + ': nobody joins a standing player, and not everybody joins')
  check(seatForGuest(room, mine, loner, 400, { seat: mine, seatedForS: 60 }, []).seat.id !== mine.id, kind + ': nobody sits down on the player')
}
const seatFact = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: g1, figures: pair, playerPos: cafe.start, arrivalPoint: false, playerSeat: { ...g1.spot, id: 'x' }, joinedPlayer: true })
check(seatFact.some(f => f.startsWith('Dein Gegenüber sitzt ') && f.includes('du hast dich eben dazugesetzt')) && !seatFact.some(f => f.includes('steht gerade')) && seatFact.every(f => f.length <= MAX_CONVERSATION_FACT_CHARS), 'a guest who joined knows that both sit together')

// ── Startcafé nach Ortszeit des Spielers ────────────────────────────────────
const arrival = venueHoursFor('cafe', true), plain = venueHoursFor('cafe')
check(arrival.clock === 'player' && arrival.open === 6 && arrival.close === 23 && plain.clock === 'colony' && plain.open === 6 && plain.close === 20, 'the arrival café keeps 6–23 by the player clock, other cafés colony hours')
check(venueOpenAt('cafe', 22, arrival) && !venueOpenAt('cafe', 22) && !venueOpenAt('cafe', 23.5, arrival) && venueOpenAt('cafe', 6, arrival), 'at 22 the arrival café is open while a normal café is closed; 23–6 it is closed')
check(venueService(cafe, pair, 23, arrival) === 'closed' && venueService(cafe, pair, 23) === 'closed' && venueService(cafe, pair, 22, arrival) === 'staffed', 'the service follows the hours handed in')
check(clockLabel(arrival) === 'deiner Ortszeit' && clockLabel(plain) === 'Koloniezeit', 'the player is told which clock applies')

// ── Hotel und Zimmer ────────────────────────────────────────────────────────
const hotelLayout = VENUE_LAYOUTS.hotel
check(venueKindForBuildingType('hotel') === 'hotel' && hotelLayout.furniture.some(item => item.kind === 'stairs') && withUpperFloor(hotelLayout) === hotelLayout, 'the hotel has its stairs from the start and gets no second one')
check(venueOpenAt('hotel', 3) && venueOpenAt('hotel', 23.9) && venueHoursText('hotel') === 'rund um die Uhr', 'the reception never closes')
const free = { capacity: 4, occupied: 1, mineForS: null }, full = { capacity: 4, occupied: 4, mineForS: null }, mine = { capacity: 4, occupied: 2, mineForS: 5 * 3600 }
check(roomsFree(free) === 3 && canBookRoom(free) && !canBookRoom(full) && !canBookRoom(mine) && !canBookRoom(null), 'booking needs a free room and no room of one\'s own')
check(roomsFact(free, true) === 'Oben gibt es 4 Gästezimmer, davon 3 frei; gebucht wird am Empfang' && roomsFact(full, true).includes('keins frei'), 'staff knows the rooms')
check(roomsFact(mine, false) === 'Oben gibt es Gästezimmer; wie viele frei sind, weißt du nicht; dein Gegenüber hat hier ein Zimmer, noch etwa 5 Stunden', 'a guest sees the stairs and the player\'s key, not the books')
const hotelStaff = placeVenueFigures(hotelLayout, [{ id: 'r', worksHere: true }])
const hotelFacts = venueConversationFacts({ layout: hotelLayout, buildingName: 'Hotel Sol', self: hotelStaff[0], figures: hotelStaff, playerPos: hotelLayout.servicePoint, arrivalPoint: false, menu: [{ label: 'Zimmer für eine Nacht', priceCredits: 40 }], rooms: free, upper: { homes: 0, guestRooms: 4 } })
check(hotelFacts.includes(roomsFact(free, true)) && !hotelFacts.includes(upperFloorFact({ homes: 0, guestRooms: 4 }, true)) && hotelFacts.length <= MAX_CONVERSATION_FACTS, 'with room data the rooms fact replaces the upper-floor fact')
check(ROOM_ITEM_CODE === 'room_night', 'the room is a menu item')

// ── Bedienung am Tisch ──────────────────────────────────────────────────────
check(tableServicePhase(5, 'cafe', 'staffed') === 'none' && tableServicePhase(15, 'cafe', 'staffed') === 'coming' && tableServicePhase(30, 'cafe', 'staffed') === 'at-table' && tableServicePhase(500, 'cafe', 'staffed') === 'gone', 'staff comes to the table shortly after the player sits down and leaves again')
check(tableServicePhase(30, 'cafe', 'self-service') === 'none' && tableServicePhase(30, 'hotel', 'staffed') === 'none', 'no table service at the automat or in a hotel lobby')
const mySeat = nearestFreeSeat(cafe, [], cafe.start)!, home = pair.find(f => f.roomRole === 'staff')!.spot
const serving = tableServiceSpot(cafe, mySeat, 'at-table', 40, home)
check(Math.hypot(serving.x - mySeat.x, serving.y - mySeat.y) < 40 && !isVenueBlocked(cafe, serving) && tableServiceSpot(cafe, mySeat, 'gone', 400, home) === home, 'the waiter stands beside the seat on free floor and returns home afterwards')
const coming = tableServiceSpot(cafe, mySeat, 'coming', TABLE_SERVICE.comeAfterS + TABLE_SERVICE.walkS / 2, home)
check(coming.label === 'auf dem Weg zum Tisch' && !isVenueBlocked(cafe, coming), 'on the way the waiter walks around the furniture')
const servingFacts = venueConversationFacts({ layout: cafe, buildingName: 'Sol', self: pair.find(f => f.roomRole === 'staff')!, figures: pair, playerPos: mySeat, arrivalPoint: false, playerSeat: mySeat, servingPlayer: true, menu: cafeMenu })
check(servingFacts.some(f => f.includes('nimmst die Bestellung auf')), 'the waiter knows why they are at the table')

// ── Größe nach Gebäude ──────────────────────────────────────────────────────
check(venueSizeForArea(null) === 'standard' && venueSizeForArea(80) === 'small' && venueSizeForArea(150) === 'standard' && venueSizeForArea(400) === 'large', 'the floor area picks the size; without it the template applies')
for (const kind of kinds) {
  const base = VENUE_LAYOUTS[kind]
  const tablesOf = (l: VenueLayout) => l.furniture.filter(f => f.kind === 'table').length
  const small = venueLayoutForSize(base, 'small'), large = venueLayoutForSize(base, 'large')
  check(venueLayoutForSize(base, 'standard') === base && venueLayoutForSize(base, 'small') === small, kind + ': standard is the template, variants are built once')
  check(tablesOf(small) <= tablesOf(base) && tablesOf(small) >= Math.min(2, tablesOf(base)) && tablesOf(large) >= tablesOf(base), kind + ': small has fewer tables, large has more')
  for (const variant of [small, large]) {
    check(variant.spots.filter(spot => spot.kind === 'seat').every(spot => reachable(variant, spot, VENUE_PLAYER_RADIUS + 26)) && reachable(variant, variant.servicePoint, 12), kind + ': every seat and the counter stay reachable in the variants')
    check(variant.furniture.filter(f => f.kind === 'table').every(a => variant.furniture.filter(f => f.kind !== 'pass' && f !== a && !f.id.startsWith('chair-')).every(b => !overlaps(a, b))), kind + ': added tables do not overlap other furniture')
  }
  check(!/vier Tische/.test(venueLayoutForSize(VENUE_LAYOUTS.cafe, 'large').roomFact) && /sechs Tische/.test(venueLayoutForSize(VENUE_LAYOUTS.cafe, 'large').roomFact), 'the room fact counts the tables of the variant')
}

// ── Lokalart aus den Kartendaten ────────────────────────────────────────────
check(venueKindForRealPlace({ amenity: 'bar', name: 'Metropol' }) === 'bar' && venueKindForRealPlace({ amenity: 'restaurant' }) === 'restaurant' && venueKindForRealPlace({ amenity: 'pub' }) === 'bar' && venueKindForRealPlace({ tourism: 'guest_house' }) === 'hotel', 'real venues from the map open the matching room')
check(venueKindForRealPlace({ building: 'apartments' }) === null && venueKindForRealPlace(null) === null, 'a dwelling is no venue until converted')

// Besuche über den Kaufabschnitt verteilt (Lokal nicht 5 Stunden leer)
{
  const at = '2026-10-28T01:01:22.152Z'
  const ids = Array.from({ length: 40 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
  const starts = ids.map(id => CONSUMPTION_INTERVAL_S - (spreadVisitAge(id, at, CONSUMPTION_INTERVAL_S) ?? 0))
  check(starts.every(s => s >= 0 && s <= CONSUMPTION_INTERVAL_S - VISIT_TOTAL_S), 'every visit starts and ends inside the purchase interval')
  check(new Set(starts.map(s => Math.floor(s / 3600))).size >= 4, 'visits of one run spread over several hours')
  check(spreadVisitAge(ids[0], at, 0) === null || spreadVisitAge(ids[0], at, 0) === 0, 'nobody is visible before their visit starts')
  check(spreadVisitAge(ids[3], at, 5000) === spreadVisitAge(ids[3], at, 5000), 'the same purchase always gives the same visit')
  const hourOf = (t: number) => ids.filter(id => { const a = spreadVisitAge(id, at, t); return a !== null && a <= VISIT_TOTAL_S }).length
  check([1, 2, 3, 4, 5].map(h => hourOf(h * 3600)).filter(n => n > 0).length >= 4, 'at most hours of the interval someone is there')
}

if (failures > 0) throw new Error(`hospitality venues: ${failures} checks failed`)
console.log('hospitality venue checks passed')
