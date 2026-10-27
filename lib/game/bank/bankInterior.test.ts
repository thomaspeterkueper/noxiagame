import { validateInteriorTemplate } from '../buildings/interiors/topology'
import { canSeeRoom, isVenueBlocked, placeVenueFigures, venuePath } from '../hospitality/venues'
import { MAX_FACTS, MAX_FACT_CHARS, baseInteriorFacts, withExtraFacts } from '../interiors/baseFacts'
import { BANK_LAYOUT, bankKnowledge } from './bankInterior'
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
check(away.some(f => f.includes('0.1 % je Tick')) && !away.some(f => f.includes('500 Credits')) && away.some(f => f.includes('nur am Schalter')), 'bank: away from the desk the clerk knows rates, not the balance')
check(atDesk.some(f => f.includes('500 Credits angelegt')) && atDesk.some(f => f.includes('Kreditfreigabe')) && atDesk.length <= MAX_FACTS && atDesk.every(f => f.length <= MAX_FACT_CHARS), 'bank: at the desk the clerk knows the customer’s own balance')
const wk = warehouseKnowledge({ locationName: 'Sundern', prices: [{ resource: 'water', buyPrice: 12, sellPrice: 9, stock: 0 }, { resource: 'metal', buyPrice: 40, sellPrice: 31, stock: 120 }], openOrders: 2, cargo: { water: 3 } })
check(wk[0].includes('Wasser Ankauf 9, Verkauf 12 Cr') && wk[1].includes('Ausverkauft: Wasser') && wk[2].includes('2 offene') && wk[3].includes('3 Wasser'), 'warehouse: prices, stock, orders and cargo come from the data')
check(warehouseKnowledge(null)[0].includes('liegt dir gerade nicht vor') && bankKnowledge(null)[0].includes('liegen dir gerade nicht vor'), 'without data nothing is invented')

if (failures > 0) throw new Error(`bank/warehouse interior: ${failures} checks failed`)
console.log('bank and warehouse interior checks passed')
