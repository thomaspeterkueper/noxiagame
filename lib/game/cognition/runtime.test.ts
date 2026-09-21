import { lightingObservation, planTemporalResponse, type TemporalProtocol, type WorldEvent } from './runtime'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error(`FAIL: ${label}`) } }

const protocol: TemporalProtocol = { id: 'tp-greenhouse', version: 1, phaseOffsetMinutes: 0, evidenceRefs: ['study:baseline'] }
const event = (minutes: number): WorldEvent => ({
  id: `lighting-${minutes}`,
  type: 'HabitatLightingPhaseShift',
  occurredAtTick: 100,
  scopeRef: 'station-a:greenhouse',
  sourceSystem: 'habitat-lighting',
  payload: { actualPhaseOffsetMinutes: minutes },
})

const normal = planTemporalResponse(lightingObservation(event(5), 'chrono-1', 5), protocol)
check(normal.action === 'none', 'normal profile remains L0')

const known = planTemporalResponse(lightingObservation(event(45), 'chrono-1', 45), protocol)
check(known.action === 'apply_known_protocol', 'small known deviation remains rule based')

const novel = planTemporalResponse(lightingObservation(event(100), 'chrono-1', 100), protocol)
check(novel.action === 'plan_experiment', 'novel deviation creates L2 experiment path')

const ambiguous = planTemporalResponse(lightingObservation(event(180), 'chrono-1', 180, 0.35), protocol)
check(ambiguous.action === 'escalate', 'large uncertain deviation creates L4 request')
check(ambiguous.escalation?.status === 'pending', 'L4 is persisted as request, not executed')

// Epistemic boundary: hidden authoritative payload is not copied into the observation.
const hidden = event(100)
hidden.payload.hiddenCause = 'controller-firmware-bug'
const observed = lightingObservation(hidden, 'chrono-2', 100)
check(!('hiddenCause' in observed.payload), 'observation does not leak ground truth')

if (failures) throw new Error(`${failures} cognitive runtime test(s) failed`)
console.log('Cognitive runtime slice: tests passed; external_llm_calls=0')
