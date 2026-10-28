import { validateInteriorTemplate } from '../buildings/interiors/topology'
import { canSeeRoom, freeSeats, isVenueBlocked, placeVenueFigures, venuePath } from '../hospitality/venues'
import { MAX_FACTS, MAX_FACT_CHARS, baseInteriorFacts, withExtraFacts } from '../interiors/baseFacts'
import { ADVICE_SEAT_ID, ADVICE_STAFF_SPOT_ID, BANK_LAYOUT, bankAdvice, bankAdvisorFacts, bankKnowledge, customerStatusFrom, isAtAdviceTable } from './bankInterior'
import { WAREHOUSE_LAYOUT, warehouseKnowledge } from '../warehouse/warehouseInterior'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }

for (const [name, L] of [['bank', BANK_LAYOUT], ['warehouse', WAREHOUSE_LAYOUT]] as const) {
  check(validateInteriorTemplate(L.template).every(issue => issue.code === 'unknown-capability'), name + ': template has no structural issues')
  check(L.spots.filter(s => s.kind !== 'staff').every(s => canSeeRoom(L, L.playerRoomId, s.roomId)), name + ': visitor spots are in sight')
  check(!isVenueBlocked(L, L.start) && !isVenueBlocked(L, L.servicePoint) && L.spots.filter(s => s.kind === 'seat').every(s => venuePath(L, L.start, s).length >= 2), name + ': start, counter and seats reachable')
}
const bankStaff = placeVenueFigures(BANK_LAYOUT, [{ id: 'a', worksHere: true }])
const away = withExtraFacts(baseInteriorFacts({ layout: BANK_LAYOUT, buildingName: 'Bank', self: bankStaff[0], figures: bankStaff, playerPos: BANK_LAYOUT.start }), bankKnowledge({ locationName: 'Sundern', depositRate: 0.001, loanRate: 0.003, customer: null }))
const atDesk = withExtraFacts(baseInteriorFacts({ layout: BANK_LAYOUT, buildingName: 'Bank', self: bankStaff[0], figures: bankStaff, playerPos: BANK_LAYOUT.servicePoint }), bankKnowledge({ locationName: 'Sundern', depositRate: 0.001, loanRate: 0.003, customer: { deposit: 500, loan: 0, creditLimit: 2000, availableLoan: 2000, hasModule: false } }))
check(away.some(f => f.includes('0.1 % je Tag')) && !away.some(f => f.includes('500 Credits')) && away.some(f => f.includes('nur am Schalter')), 'bank: away from the desk the clerk knows rates, not the balance')
check(atDesk.some(f => f.includes('500 Credits angelegt')) && atDesk.some(f => f.includes('Kreditfreigabe')) && atDesk.length <= MAX_FACTS && atDesk.every(f => f.length <= MAX_FACT_CHARS), 'bank: at the desk the clerk knows the customer’s own balance')
const wk = warehouseKnowledge({ locationName: 'Sundern', prices: [{ resource: 'water', buyPrice: 12, sellPrice: 9, stock: 0 }, { resource: 'metal', buyPrice: 40, sellPrice: 31, stock: 120 }], openOrders: 2, cargo: { water: 3 } })
check(wk[0].includes('Wasser Ankauf 9, Verkauf 12 Cr') && wk[1].includes('Ausverkauft: Wasser') && wk[2].includes('2 offene') && wk[3].includes('3 Wasser'), 'warehouse: prices, stock, orders and cargo come from the data')
check(warehouseKnowledge(null)[0].includes('liegt dir gerade nicht vor') && bankKnowledge(null)[0].includes('liegen dir gerade nicht vor'), 'without data nothing is invented')

// Beratung
const two = placeVenueFigures(BANK_LAYOUT, [{ id: 'a', worksHere: true }, { id: 'b', worksHere: true }])
check(two.some(f => f.spot.id === ADVICE_STAFF_SPOT_ID && f.visibleToPlayer), 'bank: with two staff one sits at the advice table, in sight')
const seat = BANK_LAYOUT.spots.find(s => s.id === ADVICE_SEAT_ID)!
check(freeSeats(BANK_LAYOUT, two).some(s => s.id === ADVICE_SEAT_ID), 'bank: the customer can sit down at the advice table')
check(Boolean(seat) && isAtAdviceTable(ADVICE_SEAT_ID, seat) && !isAtAdviceTable(null, BANK_LAYOUT.start), 'bank: the customer chair is the advice place, the entrance is not')
check(venuePath(BANK_LAYOUT, BANK_LAYOUT.start, seat).length >= 2, 'bank: advice chair reachable')
const cs = customerStatusFrom({ credits: 1000, deposit: 2000, loan: 1500, creditLimit: 1000, availableLoan: 0, depositRate: 0.001, loanRate: 0.004, hasModule: false, collateralTotal: 2000, collateralWarning: { overLimit: 500 } })!
const advice = bankAdvice(cs)
check(advice[0].includes('Bargeld 1.000 Cr') && advice[0].includes('Guthaben hier 2.000 Cr') && advice[0].includes('Kredit 1.500 Cr'), 'advice: account line from the data')
check(advice.some(l => l.includes('Guthaben bringt etwa 2 Cr je Tag')) && advice.some(l => l.includes('kostet etwa 6 Cr je Tag')), 'advice: interest per day computed')
check(advice.some(l => l.startsWith('Tilgen aus dem Guthaben spart etwa 4,5 Cr')), 'advice: repaying from deposit saves the rate difference on the smaller amount')
check(advice.some(l => l.includes('500 Cr über dem Rahmen')) && advice.some(l => l.includes('„Was ist Kredit?“')), 'advice: over limit and missing clearance named')
const none = bankAdvice(customerStatusFrom({ credits: 300, deposit: 0, loan: 0, creditLimit: 0, availableLoan: 0, depositRate: 0.001, loanRate: 0.004, hasModule: true, collateralTotal: 0 })!)
check(none.some(l => l.includes('Bargeld bringt keine Zinsen')) && none.some(l => l.includes('Keine Sicherheiten')) && !none.some(l => l.includes('Kredit kostet')) && !none.some(l => l.includes('Nachweis')), 'advice: no loan, no collateral, clearance present')
const adv = withExtraFacts(baseInteriorFacts({ layout: BANK_LAYOUT, buildingName: 'Bank', self: two[1], figures: two, playerPos: seat }), bankAdvisorFacts(cs))
check(adv.some(f => f.startsWith('Mappe: Konto')) && adv.length <= MAX_FACTS && adv.every(f => f.length <= MAX_FACT_CHARS), 'advisor knows the folder, within limits')
check(bankAdvisorFacts(null)[0].includes('noch nicht vor'), 'advisor without data says so')
check(customerStatusFrom(null) === null, 'no status, no folder')

if (failures > 0) throw new Error(`bank/warehouse interior: ${failures} checks failed`)
console.log('bank and warehouse interior checks passed')
