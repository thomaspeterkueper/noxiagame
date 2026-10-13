import { CANTEEN_QUESTIONS, canteenAnswer, canteenGreeting, canteenServiceKind, portNoun } from './canteen'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }

check(canteenServiceKind('landing_pad_phobos') === 'automat' && canteenServiceKind('landing_pad') === 'automat', 'small landing pads get an automat')
check(canteenServiceKind('spaceport_core') === 'robot' && canteenServiceKind('docking_bay') === 'robot' && canteenServiceKind('q1_harbour_district') === 'robot', 'ports and stations get a robot')
check(portNoun('landing_pad_moon') === 'Landeplatz' && portNoun('docking_bay') === 'Andockmodul' && portNoun(null) === 'Hafen', 'the device names its port')
const menu = [{ itemCode: 'water', label: 'Wasser', priceCredits: 2 }, { itemCode: 'ration', label: 'Ration', priceCredits: 6 }]
for (const kind of ['automat', 'robot'] as const) {
  const answers = CANTEEN_QUESTIONS.map(q => canteenAnswer(q.id, { kind, menu, portTypeId: 'docking_bay', rationAvailable: false }))
  check(answers.every(a => a.length > 0 && a.length <= 160), kind + ': every question has a short answer')
  check(answers[0].includes('Wasser 2 Cr') && answers[0].includes('Ration 6 Cr'), kind + ': the menu answer lists the real items')
  check(/Verwaltung/.test(answers[4]) && !/Stelle frei|Schiff/.test(answers[4]), kind + ': the device knows nothing about work and refers to the administration')
  check(answers[2].includes('noch nicht freigeschaltet'), kind + ': without the server function the ration is not promised')
}
check(canteenAnswer('menu', { kind: 'robot', menu: [], rationAvailable: false }).includes('leer'), 'an empty menu is reported, not invented')
check(canteenAnswer('broke', { kind: 'robot', menu, rationAvailable: true }).includes('Notration verfügbar'), 'with the server function the ration is offered')
check(canteenGreeting('robot') !== canteenGreeting('automat'), 'robot and automat greet differently')

if (failures > 0) throw new Error(`canteen: ${failures} checks failed`)
console.log('canteen checks passed')
