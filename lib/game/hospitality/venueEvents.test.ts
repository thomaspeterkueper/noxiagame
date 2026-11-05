import { eventFacts, eventLine, upcoming, validateEvent, whenText, type VenueEvent } from './venueEvents'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }

const now = Date.parse('2026-11-05T18:00:00Z') // 19:00 in Deutschland
const ok = validateEvent({ kind: 'dj', title: '  Achtziger  ', startsAt: '2026-11-05T20:00:00Z', minutes: 240 }, now)
check(ok.ok && ok.title === 'Achtziger' && ok.endsAt === '2026-11-06T00:00:00.000Z', 'valid event cleaned')
check(!validateEvent({ kind: 'rave', startsAt: '2026-11-05T20:00:00Z', minutes: 60 }, now).ok, 'unknown kind')
check(!validateEvent({ kind: 'dj', startsAt: '2026-11-01T20:00:00Z', minutes: 60 }, now).ok, 'past start')
check(!validateEvent({ kind: 'dj', startsAt: '2026-11-05T20:00:00Z', minutes: 10 }, now).ok && !validateEvent({ kind: 'dj', startsAt: '2026-11-05T20:00:00Z', minutes: 600 }, now).ok, 'duration bounds')
check(validateEvent({ kind: 'quiz', startsAt: '2026-11-05T20:00:00Z', minutes: 90 }, now).ok, 'title defaults to the kind')
const ev = (id: string, kind: VenueEvent['kind'], s: string, e: string): VenueEvent => ({ id, tileEntityId: 't', kind, title: 'x', note: null, startsAt: s, endsAt: e })
const list = [ev('a', 'quiz', '2026-11-06T19:00:00Z', '2026-11-06T21:00:00Z'), ev('b', 'dj', '2026-11-05T17:00:00Z', '2026-11-05T22:00:00Z'), ev('c', 'feier', '2026-11-04T17:00:00Z', '2026-11-04T22:00:00Z')]
check(upcoming(list, now).map(e => e.id).join() === 'b,a', 'running first, past dropped')
check(whenText('2026-11-05T20:00:00Z', now) === 'heute 21:00' && whenText('2026-11-06T19:00:00Z', now) === 'morgen 20:00', 'German time words')
check(eventLine(list[1], now).includes('läuft gerade'), 'running line')
const staff = eventFacts(list, true, now), guest = eventFacts(list, false, now)
check(staff.some(f => f.startsWith('Gerade läuft')) && staff.some(f => f.includes('Quizabend')), 'staff knows the programme')
check(guest.length === 2 && guest[1].startsWith('Am Aushang hängt'), 'guests know what runs and the poster')
check(eventFacts([], true, now).length === 0, 'nothing invented without events')

if (failures) { console.error(failures + ' failed'); process.exit(1) } else console.log('venue events checks passed')
