import { MUSIC_STYLES, PROPOSED_WAGE_PER_HOUR, ROLE_LABEL, SHIFT_S, roleStation, shiftRolesFor, shiftTasks, shiftWage, workingFact, type ShiftRole } from './playerShift'
import { VENUE_LAYOUTS, isVenueBlocked, venuePath, type VenueKind } from './venues'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }

check(shiftRolesFor('nightclub').join() === 'door,bar,dj,cleaning', 'club: doorman, barkeeper, DJ, cleaner')
check(shiftRolesFor('cafe').includes('service') && shiftRolesFor('restaurant').includes('cleaning') && shiftRolesFor('hotel').includes('reception') && shiftRolesFor('bar').includes('bar'), 'other venues have jobs too')
check(shiftRolesFor('bank').length === 0, 'no venue, no jobs here')

for (const kind of ['cafe', 'bar', 'restaurant', 'hotel', 'nightclub'] as VenueKind[]) {
  const L = VENUE_LAYOUTS[kind]
  for (const role of shiftRolesFor(kind)) {
    const s = roleStation(L, role)
    check(!isVenueBlocked(L, s) && venuePath(L, L.start, s).length >= 2, `${kind}/${role}: workplace reachable (${s.label})`)
  }
}
const club = VENUE_LAYOUTS.nightclub
check(roleStation(club, 'door').label === 'an der Tür' && roleStation(club, 'dj').label === 'am DJ-Pult', 'club stations: door and DJ booth')

const t0 = Date.parse('2026-10-28T22:00:00Z')
const visit = { personId: 'p1', startMs: t0 + 5 * 60_000, seat: { x: 300, y: 380 }, label: 'Longdrink' }
const at = (min: number) => t0 + min * 60_000
const bar = shiftTasks({ role: 'bar', layout: club, startedAtMs: t0, nowMs: at(5.5), visits: [visit], done: new Set() })
check(bar.some(t => t.kind === 'serve' && t.guest && t.label.includes('Longdrink')), 'a real guest ordering gives the barkeeper a task')
check(!shiftTasks({ role: 'bar', layout: club, startedAtMs: t0, nowMs: at(9), visits: [visit], done: new Set() }).some(t => t.kind === 'serve'), 'the order task passes when the guest has walked on')
check(shiftTasks({ role: 'bar', layout: club, startedAtMs: t0, nowMs: at(17), visits: [], done: new Set() }).filter(t => t.kind === 'rinse').length === 1, 'duties do not pile up: only the latest open one')
check(shiftTasks({ role: 'bar', layout: club, startedAtMs: t0, nowMs: at(3), visits: [], done: new Set() }).length === 0, 'nothing to do in the first minutes without guests')
check(shiftTasks({ role: 'door', layout: club, startedAtMs: t0, nowMs: at(6), visits: [visit], done: new Set() }).some(t => t.kind === 'admit'), 'doorman admits arriving guests')
const dj = shiftTasks({ role: 'dj', layout: club, startedAtMs: t0, nowMs: at(7), visits: [], done: new Set() })
check(dj.length === 1 && dj[0].kind === 'music', 'DJ chooses music every few minutes')
const wipeAt = at(5 + 38)
check(shiftTasks({ role: 'cleaning', layout: club, startedAtMs: t0, nowMs: wipeAt, visits: [visit], done: new Set() }).some(t => t.kind === 'wipe' && t.at.x === 300), 'cleaner wipes the table a guest left')
check(shiftTasks({ role: 'cleaning', layout: club, startedAtMs: t0, nowMs: at(16), visits: [], done: new Set() }).some(t => t.kind === 'toilet'), 'cleaner cleans the toilet')
const done = new Set(bar.map(t => t.key))
check(shiftTasks({ role: 'bar', layout: club, startedAtMs: t0, nowMs: at(5.5), visits: [visit], done }).length === 0, 'done tasks disappear')
check(!shiftTasks({ role: 'bar', layout: club, startedAtMs: t0, nowMs: at(5.5), visits: [{ ...visit, startMs: t0 - 10 * 60_000 }], done: new Set() }).some(t => t.kind === 'serve'), 'guests from before the shift are not yours')

check(shiftWage(8, t0, t0 + SHIFT_S * 1000) === 8 && shiftWage(8, t0, t0 + SHIFT_S * 500) === 4 && shiftWage(8, t0, t0 + SHIFT_S * 3000) === 8, 'wage pro rata, at most one shift')
check((Object.keys(PROPOSED_WAGE_PER_HOUR) as ShiftRole[]).every(r => PROPOSED_WAGE_PER_HOUR[r] > 0 && ROLE_LABEL[r]), 'every role has a wage proposal and a name')
check(workingFact('bar', true).includes('Barkeeper') && workingFact('door', false).includes('Türsteher') && MUSIC_STYLES.length >= 3, 'facts and music styles')

if (failures > 0) throw new Error(`player shift: ${failures} checks failed`)
console.log('player shift checks passed')
{
  const club2 = VENUE_LAYOUTS.nightclub
  const free = roleStation(club2, 'bar', new Set(['staff-counter']))
  const all = roleStation(club2, 'bar', new Set(['staff-counter', 'staff-counter-2']))
  if (!(free.y !== roleStation(club2, 'bar').y && all.label)) throw new Error('player shift: barkeeper takes the free counter place')
  console.log('player shift station checks passed')
}
