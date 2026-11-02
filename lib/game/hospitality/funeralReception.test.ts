import { FUNERAL_RECEPTION_KIND, receptionAt, receptionFacts, receptionNotice, receptionRole } from './funeralReception'
import { VENUE_LAYOUTS, placeVenueFigures, venueConversationFacts } from './venues'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }

const T = 'e157b61c-d1d5-48bb-aab6-4adb75b0a150'
const row = (p: Record<string, unknown>) => ({ payload: { kind: FUNERAL_RECEPTION_KIND, tileEntityId: T, deceasedName: 'Maria Schulte', hostPersonId: 'h', guestIds: ['g1', 'g2'], playerProfileIds: ['me'], startsTick: 100, endsTick: 103, ...p } })

check(receptionAt([row({})], T, 99) === null && receptionAt([row({})], T, 103) === null && receptionAt([row({})], T, 101)?.deceasedName === 'Maria Schulte', 'only while it runs')
check(receptionAt([row({ cancelled: true })], T, 101) === null && receptionAt([row({})], 'other', 101) === null && receptionAt([row({ kind: 'service' })], T, 101) === null, 'cancelled, other house or other kind: nothing')
check(receptionAt([row({ deceasedName: '' })], T, 101) === null, 'without a name nothing is invented')
const r = receptionAt([row({})], T, 101, 'me')!
check(r.playerInvited && !receptionAt([row({})], T, 101, 'you')!.playerInvited, 'invitation per player')
check(receptionRole(r, 'h', false) === 'host' && receptionRole(r, 'g1', false) === 'mourner' && receptionRole(r, 'x', false) === 'other' && receptionRole(r, 'h', true) === 'staff', 'roles')
const host = receptionFacts(r, 'host', { playerInvited: true, condoled: true })
check(host[0].includes('Maria Schulte') && host.some(f => f.includes('erfinde keine')) && host.some(f => f.includes('Beileid')) && host.every(f => f.length <= 140), 'the host knows, invents nothing and hears the condolence')
check(receptionFacts(r, 'staff', { playerInvited: false, condoled: false })[0].includes('taktvoll') && receptionFacts(null, 'staff', { playerInvited: false, condoled: false }).length === 0, 'staff serve quietly; no event, no fact')
check(receptionNotice(r, true).includes('eingeladen') && receptionNotice(r, false).includes('leiser'), 'notice for invited and other guests')

const L = VENUE_LAYOUTS.cafe
const [self] = placeVenueFigures(L, [{ id: 'g1', worksHere: false }])
const facts = venueConversationFacts({ layout: L, buildingName: 'Metropol', self, figures: [self], servingPlayer: false, playerPos: L.start, playerSeat: null, joinedPlayer: false, menu: [], playerOrders: [], giftsToSelf: [], ownOrder: null, hour: 15, occasionFacts: receptionFacts(r, 'mourner', { playerInvited: false, condoled: false }) } as any)
check(facts.length <= 16 && facts.some(f => f.includes('Beerdigung von Maria Schulte')), 'the occasion reaches the conversation and is not cut off')

if (failures > 0) throw new Error(`funeral reception: ${failures} checks failed`)
console.log('funeral reception checks passed')
