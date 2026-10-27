import { BUILDING_LEARNING_GATES, gateOpen, gateStatuses, learningGateFacts, learningGatesFor, moduleForGate, statusesFromViews } from './learningGates'
import { knowledgeUnlocks, learningModules } from '../../knowledge/data'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }

// Nichts erfunden: jede Freischaltung steht im Wissenskatalog oder in den SSF-Pfaden.
const catalogUnlocks = new Set([...knowledgeUnlocks.map(u => u.id), ...learningModules.flatMap(m => m.unlocks), 'UNL:NOX:NAV:ORBITAL', 'UNL:NOX:NAV:CURVATURE'])
for (const [kind, gates] of Object.entries(BUILDING_LEARNING_GATES)) {
  for (const gate of gates) check(catalogUnlocks.has(gate.unlock), `${kind}/${gate.id}: unlock ${gate.unlock} is in the knowledge catalog`)
  check(new Set(gates.map(g => g.id)).size === gates.length, `${kind}: gate ids unique`)
}
check(learningGatesFor('bank').some(g => g.id === 'bank-credit' && g.need === 'required' && g.moduleIds.includes('ECO-L0-000001')), 'bank: credit is the enforced gate with the clearance module the bank checks')
check(learningGatesFor('cafe').length === 0, 'buildings without gates have none')

const credit = learningGatesFor('bank')[0]
check(!gateOpen(credit, null), 'unknown progress: gate closed')
check(gateOpen(credit, { unlocks: [], completedModules: ['ECO-L0-000001'] }), 'completed module opens the gate')
check(gateOpen(credit, { unlocks: ['UNL:NOX:bank-credit'], completedModules: [] }), 'unlock opens the gate')

check(moduleForGate(credit, [{ id: 'X', unlocks: ['UNL:NOX:bank-credit'] }]) === 'X', 'module found by unlock')
check(moduleForGate(credit, [{ id: 'ECO-L0-000001' }]) === 'ECO-L0-000001', 'module found by id')
check(moduleForGate(credit, []) === null, 'no SSF module: null, nothing invented')

const st = gateStatuses('bank', { unlocks: [], completedModules: ['ECO-L0-000001'] }, [{ id: 'ECO-L0-000001' }])
const general = learningGateFacts(st, false)
const personal = learningGateFacts(st, true)
check(general.some(f => f.includes('Kredit aufnehmen')) && !general.some(f => f.includes('Gegenüber')), 'staff know the gates, not the customer’s progress, away from the counter')
check(personal.some(f => f.includes('hat schon') && f.includes('Was ist Kredit?')) && personal.some(f => f.includes('fehlt noch')), 'at the counter staff know what the customer has and lacks')
check(personal.every(f => f.length <= 140), 'facts are short')
check(statusesFromViews('bank', [{ id: 'bank-credit', open: true, moduleId: 'M' }])[0].open && !statusesFromViews('bank', [])[0].open, 'views map back to statuses')

if (failures > 0) throw new Error(`learning gates: ${failures} checks failed`)
console.log('learning gate checks passed')
