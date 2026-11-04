import { familyFacts, isMinor, itemAllowedFor, minorsAllowed } from './familyRules'
import { spokenOrderItems } from './spokenOrder'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }

check(isMinor({ lifeStage: 'child' }) && isMinor({ knownAgeYears: 12 }) && !isMinor({ knownAgeYears: 18 }) && !isMinor({ lifeStage: 'adult' }) && !isMinor(null), 'minor by life stage or known age')
check(!minorsAllowed('bar') && !minorsAllowed('nightclub') && minorsAllowed('cafe') && minorsAllowed('restaurant'), 'no children in bar and nightclub')
check(!itemAllowedFor('longdrink', true) && !itemAllowedFor('shot', true) && itemAllowedFor('cocoa', true) && itemAllowedFor('longdrink', false), 'no alcohol for minors')
const kid = familyFacts({ selfIsMinor: true, staff: false, minorsPresent: 1 })
check(kid.length === 3 && kid.some(f => f.includes('gehst mit niemandem mit')) && kid.every(f => f.length <= 140), 'a child knows its rules')
check(familyFacts({ selfIsMinor: false, staff: true, minorsPresent: 2 })[0].includes('keinen Alkohol') && familyFacts({ selfIsMinor: false, staff: false, minorsPresent: 2 }).length === 0, 'staff know, guests are not told')
const menu = [{ itemCode: 'drink', label: 'Getränk' }, { itemCode: 'cocoa', label: 'Kakao' }, { itemCode: 'kids_meal', label: 'Kinderteller' }]
check(spokenOrderItems('Einen Kakao und einen Kinderteller bitte', menu).map(o => o.itemCode).join() === 'cocoa,kids_meal', 'cocoa and kids meal by word')
check(spokenOrderItems('Einen Kakao', [{ itemCode: 'drink', label: 'Getränk' }]).map(o => o.itemCode).join() === 'drink', 'without cocoa on the menu it is a drink')

if (failures > 0) throw new Error(`family rules: ${failures} checks failed`)
console.log('family rules checks passed')
