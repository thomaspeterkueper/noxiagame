import { advanceBodyHealing, healthyBody, projectBody, senseBody } from '../cognition/personBody'
import { affectProfileFromTraits, decayAffect, feltPain, neutralAffect, syncBodyAffect } from '../cognition/personAffect'
import { accidentRegion, applyHealthEventToBody } from './bodyHealthBridge'

let failures = 0
const check = (ok: boolean, label: string) => { if (!ok) { failures++; console.error('FAIL: ' + label) } }
const profile = affectProfileFromTraits(null)

// Health event → body.
const injured = applyHealthEventToBody(healthyBody(), { eventType: 'workplace_accident', severity: 0.8 }, 'evt-1')
check(injured.injuries.length === 1 && injured.injuries[0].region === accidentRegion('evt-1'), 'an accident becomes one located injury')
check(accidentRegion('evt-1') === accidentRegion('evt-1'), 'the region is stable for the same event')
check(injured.injuries[0].tissue === 'bone' && applyHealthEventToBody(healthyBody(), { eventType: 'workplace_accident', severity: 0.2 }, 'e').injuries[0].tissue === 'skin', 'severity decides how deep the injury goes')
const replayed = applyHealthEventToBody(injured, { eventType: 'workplace_accident', severity: 0.8 }, 'evt-1')
check(replayed.injuries.length === 1, 'replaying the event does not create a second injury')
const tired = applyHealthEventToBody(healthyBody(), { eventType: 'exhaustion', severity: 0.7 }, 'evt-2')
check(tired.injuries.length === 0 && tired.fatigue === 0.7 && senseBody(tired).nociception === 0, 'exhaustion is fatigue, not pain')
const exposed = applyHealthEventToBody(healthyBody(), { eventType: 'environmental_exposure', severity: 0.6 }, 'evt-3')
check(exposed.injuries.length === 0 && senseBody(exposed).systemicDistress === 0.6, 'exposure is systemic distress')
check(applyHealthEventToBody(tired, { eventType: 'exhaustion', severity: 0.2 }, 'evt-4').fatigue === 0.7, 'a milder event does not lower existing stress')

// Body → affect: the body owns the pain signal.
const acute = senseBody(injured)
const hurt = syncBodyAffect(neutralAffect('p1'), acute, 100, profile)
check(hurt.pain === feltPain(acute.nociception, profile) && hurt.pain > 0 && hurt.pain < acute.nociception, 'felt pain is the body signal after tolerance')
check(hurt.fear > 0, 'a new injury echoes as fear')
const tough = syncBodyAffect(neutralAffect('p1'), acute, 100, affectProfileFromTraits({ pain_tolerance: 1 }))
check(tough.pain < hurt.pain, 'tolerance lowers felt pain, not the injury')

const same = syncBodyAffect(hurt, acute, 101, profile)
check(same.pain === hurt.pain && same.fear < hurt.fear, 'steady pain adds no fresh fear')
const healedBody = advanceBodyHealing(advanceBodyHealing(injured, 24), 24)
const healing = syncBodyAffect(hurt, senseBody(healedBody), 148, profile)
check(healing.pain < hurt.pain && healing.pain === feltPain(senseBody(healedBody).nociception, profile), 'pain follows the body down as it heals')
check(healing.pain > decayAffect(hurt, 148, profile).pain, 'body healing, not the affect half-life, decides how long it hurts')

const worse = applyHealthEventToBody(healedBody, { eventType: 'workplace_accident', severity: 1 }, 'evt-9')
const reinjured = syncBodyAffect(healing, senseBody(worse), 149, profile)
check(reinjured.pain > healing.pain && reinjured.fear > decayAffect(healing, 149, profile).fear, 'a new injury on top is felt as a new event')

// Systemic distress is fear, not pain, and does not pile up.
const hypoxic = { ...healthyBody(), oxygenStress: 0.8 }
const afraid = syncBodyAffect(neutralAffect('p1'), senseBody(hypoxic), 200, profile)
check(afraid.pain === 0 && afraid.fear > 0.5, 'hypoxia frightens without hurting')
let repeated = afraid
for (let tick = 201; tick <= 210; tick++) repeated = syncBodyAffect(repeated, senseBody(hypoxic), tick, profile)
check(repeated.fear === afraid.fear, 'repeated syncs hold fear at the same level')
const recovered = syncBodyAffect(repeated, senseBody(healthyBody()), 222, profile)
check(recovered.fear < repeated.fear * 0.3 && recovered.pain === 0, 'fear fades once the body is fine')

check(JSON.stringify(syncBodyAffect(neutralAffect('p1'), acute, 100, profile)) === JSON.stringify(hurt), 'equal body and state give equal affect')
check(projectBody(injured).reflexStimulus?.kind === 'pain', 'the body supplies the reflex stimulus')

if (failures) throw new Error(String(failures) + ' body bridge test(s) failed')
console.log('Body-affect bridge: tests passed; external_llm_calls=0; persistence_writes=0')
