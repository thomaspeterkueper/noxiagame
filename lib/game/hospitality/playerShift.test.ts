import { EINSATZ_S, MUSIC_STYLES, PROPOSED_WAGE_PER_HOUR, ROLE_LABEL, SHIFT_GAME_HOURS, compressPurchases, roleStation, shiftRolesFor, shiftTasks, shiftWage, workingFact, type ShiftRole } from './playerShift'
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
const sec = (n: number) => t0 + n * 1000
// Echte Käufe der letzten vier Stunden werden in den Einsatz verdichtet.
const purchases = [
  { personId: 'p1', atMs: t0 - 3.5 * 3600_000, label: 'Longdrink' },
  { personId: 'p2', atMs: t0 - 1 * 3600_000, label: 'Getränk' },
  { personId: 'old', atMs: t0 - 6 * 3600_000 },
  { personId: 'future', atMs: t0 + 60_000 },
]
const visits = compressPurchases(purchases, t0, 4)
check(visits.length === 2 && visits.every(v => v.startMs > t0 && v.startMs < t0 + EINSATZ_S * 1000) && visits[0].personId === 'p1' && visits[0].startMs < visits[1].startMs, 'only the real purchases of the shift hours, in order, inside the Einsatz')
const firstAt = (visits[0].startMs - t0) / 1000
const bar = shiftTasks({ role: 'bar', layout: club, startedAtMs: t0, nowMs: sec(firstAt + 5), visits, done: new Set() })
check(bar.some(t => t.kind === 'serve' && t.guest && t.label.includes('Longdrink')), 'a real guest gives the barkeeper a task')
check(!shiftTasks({ role: 'bar', layout: club, startedAtMs: t0, nowMs: sec(firstAt + 40), visits: [visits[0]], done: new Set() }).some(t => t.kind === 'serve'), 'the order task passes after half a minute')
check(shiftTasks({ role: 'bar', layout: club, startedAtMs: t0, nowMs: sec(130), visits: [], done: new Set() }).filter(t => t.kind === 'rinse').length === 1, 'duties do not pile up: only the latest open one')
check(shiftTasks({ role: 'bar', layout: club, startedAtMs: t0, nowMs: sec(10), visits: [], done: new Set() }).length === 0, 'nothing to do in the first seconds without guests')
check(shiftTasks({ role: 'door', layout: club, startedAtMs: t0, nowMs: sec(firstAt + 3), visits, done: new Set() }).some(t => t.kind === 'admit'), 'doorman admits arriving guests')
const dj = shiftTasks({ role: 'dj', layout: club, startedAtMs: t0, nowMs: sec(40), visits: [], done: new Set() })
check(dj.length === 1 && dj[0].kind === 'music', 'DJ chooses music every half minute or so')
check(shiftTasks({ role: 'cleaning', layout: club, startedAtMs: t0, nowMs: sec(firstAt + 60), visits, done: new Set() }).some(t => t.kind === 'wipe'), 'cleaner wipes the table a guest left')
check(shiftTasks({ role: 'cleaning', layout: club, startedAtMs: t0, nowMs: sec(95), visits: [], done: new Set() }).some(t => t.kind === 'toilet'), 'cleaner cleans the toilet')
const done = new Set(bar.map(t => t.key))
check(shiftTasks({ role: 'bar', layout: club, startedAtMs: t0, nowMs: sec(firstAt + 5), visits, done }).length === 0, 'done tasks disappear')
// Ein Einsatz von fünf Minuten zählt als ganze Schicht
check(EINSATZ_S <= 6 * 60 && SHIFT_GAME_HOURS.door === 4, 'a short Einsatz stands for a whole shift')
check(shiftWage(8, 4, t0, t0 + EINSATZ_S * 1000) === 32 && shiftWage(8, 4, t0, t0 + EINSATZ_S * 500) === 16 && shiftWage(8, 4, t0, t0 + EINSATZ_S * 3000) === 32, 'wage for the whole shift, pro rata when leaving early')
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
