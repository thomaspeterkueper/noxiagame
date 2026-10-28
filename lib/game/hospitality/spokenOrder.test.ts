import { spokenOrderItems, spokenOrderTitle } from './spokenOrder'
import { DEFAULT_VENUE_SERVICES, VENUE_WC_DOOR, mentionsToilet, toiletAccess, toiletFact, venueServiceRules } from './venueServices'
import { MAX_CONVERSATION_FACTS, MAX_CONVERSATION_FACT_CHARS, VENUE_LAYOUTS, isVenueBlocked, placeVenueFigures, venueConversationFacts, venueLayoutForSize, venuePath, withUpperFloor, type VenueKind } from './venues'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }

const restaurant = [{ itemCode: 'starter', label: 'Vorspeise' }, { itemCode: 'main', label: 'Hauptgericht' }, { itemCode: 'dessert', label: 'Nachtisch' }, { itemCode: 'drink', label: 'Getränk' }]
const cafe = [{ itemCode: 'drink', label: 'Getränk' }, { itemCode: 'cake', label: 'Kuchen' }, { itemCode: 'meal', label: 'Mahlzeit' }]

// Der Fall aus der Auswertung: „ja bitte ein wasser“ ist ein Getränk – keine Vorspeise.
const water = spokenOrderItems('ja bitte ein wasser', restaurant)
check(water.length === 1 && water[0].itemCode === 'drink' && spokenOrderTitle(water[0]) === 'Getränk (Wasser)', 'water is a drink, nothing added')
check(spokenOrderItems('Einen Kaffee und ein Stück Kuchen, bitte', cafe).map(o => o.itemCode).join() === 'drink,cake', 'two items in sentence order')
check(spokenOrderItems('keinen Kaffee, nur Kuchen', cafe).map(o => o.itemCode).join() === 'cake', 'negated words do not count')
check(spokenOrderItems('Suppe', restaurant)[0]?.itemCode === 'starter' && spokenOrderItems('Suppe', cafe)[0]?.itemCode === 'meal', 'soup maps to what the menu has')
check(spokenOrderItems('Ich nehme die Vorspeise', restaurant).length === 1 && spokenOrderTitle(spokenOrderItems('die Vorspeise', restaurant)[0]) === 'Vorspeise', 'menu label itself')
check(spokenOrderItems('Wie heißt du?', cafe).length === 0 && spokenOrderItems('', cafe).length === 0 && spokenOrderItems('Kaffee', []).length === 0, 'nothing named, nothing suggested')
check(spokenOrderItems('Ein Zimmer für heute Nacht', [{ itemCode: 'room_night', label: 'Zimmer für eine Nacht' }])[0]?.itemCode === 'room_night', 'a room can be asked for')
check(spokenOrderItems('Bier, Kuchen, Suppe, Eis', [...cafe, { itemCode: 'dessert', label: 'Nachtisch' }]).length === 3, 'at most three suggestions')

// Toilette: Standard frei für jeden
check(DEFAULT_VENUE_SERVICES.toilet.available && DEFAULT_VENUE_SERVICES.toilet.priceCredits === 0 && !DEFAULT_VENUE_SERVICES.toilet.guestsOnly, 'toilet is free for everyone by default')
check(venueServiceRules(undefined) === DEFAULT_VENUE_SERVICES && venueServiceRules({ toilet: { priceCredits: 2, guestsOnly: true } }).toilet.priceCredits === 2, 'house rules override the default')
check(toiletAccess(DEFAULT_VENUE_SERVICES.toilet, { hasOrdered: false }).ok, 'default: anyone may use it')
check(!toiletAccess({ available: true, priceCredits: 0, guestsOnly: true }, { hasOrdered: false }).ok && toiletAccess({ available: true, priceCredits: 0, guestsOnly: true }, { hasOrdered: true }).ok, 'guests-only rule')
check(toiletFact(DEFAULT_VENUE_SERVICES.toilet, true).includes('frei für jeden') && toiletFact(DEFAULT_VENUE_SERVICES.toilet, false).includes('WC'), 'staff know the rule, guests see the door')
check(mentionsToilet('Ich suche eine Toilett') && mentionsToilet('Kann ich hier pinkeln?') && mentionsToilet('wo ist das WC') && !mentionsToilet('Einen Kaffee bitte'), 'toilet questions are recognized')

for (const kind of ['cafe', 'bar', 'restaurant', 'hotel', 'nightclub'] as VenueKind[]) for (const size of ['small', 'standard', 'large'] as const) {
  const L = withUpperFloor(venueLayoutForSize(VENUE_LAYOUTS[kind], size))
  check(!isVenueBlocked(L, VENUE_WC_DOOR) && venuePath(L, L.start, VENUE_WC_DOOR).length >= 2, `${kind}/${size}: WC door free and reachable`)
  const staff = placeVenueFigures(L, [{ id: 's', worksHere: true }])[0]
  const menu = [{ itemCode: 'drink', label: 'Getränk', priceCredits: 3 }]
  const asked = venueConversationFacts({ layout: L, buildingName: 'Lokal am Markt', self: staff, figures: [staff], playerPos: L.servicePoint, arrivalPoint: true, menu, playerOrders: ['Getränk'], hour: 12, toilet: DEFAULT_VENUE_SERVICES.toilet, playerSaid: 'Wo ist die Toilette?' })
  check(asked.length <= MAX_CONVERSATION_FACTS && asked.every(f => f.length <= MAX_CONVERSATION_FACT_CHARS) && asked.some(f => f.includes('frei für jeden')), `${kind}/${size}: asked about the toilet, the rule is in the facts within limits`)
}

if (failures > 0) throw new Error(`spoken order / services: ${failures} checks failed`)
console.log('spoken order and venue service checks passed')

// Gebäudetafel: offen oder zu
import { venueStatusLine } from './venueStatus'
import { venueHoursFor as hoursFor } from './venues'
{
  let f2 = 0
  const c = (ok: boolean, label: string) => { if (!ok) { f2++; console.error('FAIL', label) } }
  const bar = hoursFor('bar')
  c(venueStatusLine({ kind: 'bar', hours: bar, hour: null, staffCount: 0 }).text.includes('niemand') && venueStatusLine({ kind: 'bar', hours: bar, hour: null, staffCount: 0 }).open === false, 'bar without staff is closed')
  c(venueStatusLine({ kind: 'cafe', hours: hoursFor('cafe'), hour: 3, staffCount: 0 }).open === true, 'café without staff runs as vending café')
  const open = venueStatusLine({ kind: 'restaurant', hours: hoursFor('restaurant'), hour: 13, staffCount: 2 })
  const shut = venueStatusLine({ kind: 'restaurant', hours: hoursFor('restaurant'), hour: 4, staffCount: 2 })
  c(open.open === true && open.text.startsWith('Geöffnet – jetzt 13 Uhr Koloniezeit') && shut.open === false && shut.text.includes('geöffnet von'), 'hours decide when staff is there')
  c(venueStatusLine({ kind: 'cafe', hours: hoursFor('cafe', true), hour: 7, staffCount: 1 }).text.includes('deiner Ortszeit'), 'start café runs on the player clock')
  if (f2 > 0) throw new Error(`venue status: ${f2} checks failed`)
  console.log('venue status checks passed')
}
