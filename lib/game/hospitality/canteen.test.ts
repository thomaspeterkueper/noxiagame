import { CANTEEN_QUESTIONS, automatDisplay, canteenAnswer, canteenGreeting, canteenServiceKind, portNoun } from './canteen'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }

check(canteenServiceKind('landing_pad_phobos') === 'automat' && canteenServiceKind('landing_pad') === 'automat', 'small landing pads get an automat')
check(canteenServiceKind('spaceport_core') === 'robot' && canteenServiceKind('docking_bay') === 'robot' && canteenServiceKind('q1_harbour_district') === 'robot', 'ports and stations get a swarm')
check(portNoun('landing_pad_moon') === 'Landeplatz' && portNoun('docking_bay') === 'Andockmodul' && portNoun(null) === 'Hafen', 'the device names its port')
const menu = [{ itemCode: 'water', label: 'Wasser', priceCredits: 2 }, { itemCode: 'ration', label: 'Ration', priceCredits: 6 }]
const memory = { visits: 3, lastVisitAgoS: 7200, lastItem: 'Ration', guestsToday: 13, rationsToday: 2 }
const answers = CANTEEN_QUESTIONS.map(q => canteenAnswer(q.id, { menu, portTypeId: 'docking_bay', rationAvailable: false, memory }))
check(answers.every(a => a.length > 0 && a.length <= 200), 'every question has a short answer')
check(answers[0].includes('Wasser 2 Cr') && answers[0].includes('Ration 6 Cr'), 'the menu answer lists the real items')
check(answers[1] === 'Wir haben Sie hier schon 3-mal bedient, zuletzt vor 2 Stunden: Ration.', 'the swarm remembers the player from real orders')
check(answers[2] === 'Seit gestern 13 Gäste an unserer Ausgabe, zwei Notrationen. Mehr sehen wir von hier nicht.', 'the swarm reports only what it saw')
check(canteenAnswer('seen', { menu, rationAvailable: false, memory: { ...memory, visits: 0 } }).includes('neu') && canteenAnswer('seen', { menu, rationAvailable: false, memory: null }).includes('neu'), 'without orders the player is a stranger')
check(canteenAnswer('work', { menu, rationAvailable: false }).includes('Verwaltung') && !/Stelle frei|Schiff/.test(answers[5]), 'the swarm knows nothing about work and refers to the administration')
check(answers[3].includes('noch nicht freigeschaltet'), 'without the server function the ration is not promised')
check(answers.filter(a => /\bWir\b|\bwir\b|\buns\b/.test(a)).length >= 6, 'the swarm speaks in the plural')
check(canteenAnswer('menu', { menu: [], rationAvailable: false }).includes('leer'), 'an empty menu is reported, not invented')
check(canteenAnswer('broke', { menu, rationAvailable: true }).includes('Notration verfügbar'), 'with the server function the ration is offered')
check(canteenGreeting(memory) !== canteenGreeting(null), 'a returning guest is greeted as such')
const display = automatDisplay(menu, false)
check(display.length === 4 && display[1] === 'WASSER · 2 CR' && display[3].includes('NICHT FREIGESCHALTET'), 'the automat only displays')

if (failures > 0) throw new Error(`canteen: ${failures} checks failed`)
console.log('canteen checks passed')
