import {
  affectActionModifiers,
  affectProfileFromTraits,
  affectSalience,
  applyAffect,
  applyPain,
  appraisalFromPopulationEvent,
  appraiseEvent,
  decayAffect,
  expressedAffect,
  learnPlaceAversion,
  neutralAffect,
  painEffects,
  painFromHealthEvent,
  placeSafetyPenalty,
} from './personAffect'
import { decidePopulationAction, type PopulationDecisionContext } from '../population/decision'

let failures = 0
const check = (ok: boolean, label: string) => { if (!ok) { failures++; console.error('FAIL: ' + label) } }

const profile = affectProfileFromTraits(null)
const needs = (overrides: Record<string, number> = {}) =>
  (['sustenance', 'rest', 'safety', 'social', 'purpose'] as const).map((needCode) => ({ needCode, satisfaction: overrides[needCode] ?? 0.9 }))

// Appraisal is relative to the person, not fixed per event type.
const conflict = { eventType: 'person_conflict', relatedPersonId: 'p2', payload: {} }
const fromStranger = appraiseEvent(appraisalFromPopulationEvent(conflict, { needs: needs(), relationship: { familiarity: 0.1, trust: 0.2, affinity: 0.3 } })!, profile)
const fromFriend = appraiseEvent(appraisalFromPopulationEvent(conflict, { needs: needs(), relationship: { familiarity: 0.9, trust: 0.9, affinity: 0.9 } })!, profile)
check(fromFriend.anger > fromStranger.anger, 'conflict with a trusted person angers more than with a stranger')
check(fromFriend.sadness > fromStranger.sadness, 'conflict with a liked person also disappoints')
check(fromFriend.joy === 0, 'a conflict produces no joy')

const help = { eventType: 'person_assistance', relatedPersonId: 'p2', payload: {} }
const helpWhenFine = appraiseEvent(appraisalFromPopulationEvent(help, { needs: needs() })!, profile)
const helpInNeed = appraiseEvent(appraisalFromPopulationEvent(help, { needs: needs({ sustenance: 0.1 }) })!, profile)
check(helpInNeed.joy > helpWhenFine.joy, 'help means more to someone in need')

const loss = appraiseEvent({ goalImpact: -1, stakes: 0.9, irreversible: true }, profile)
const setback = appraiseEvent({ goalImpact: -1, stakes: 0.9 }, profile)
check(loss.sadness > setback.sadness && loss.anger === 0 && setback.anger > 0, 'irreversible loss grieves, a recoverable setback frustrates')
check(appraisalFromPopulationEvent({ eventType: 'unknown_event', relatedPersonId: null, payload: {} }, { needs: needs() }) === null, 'unknown events produce no affect')

const crisis = appraiseEvent(appraisalFromPopulationEvent({ eventType: 'crisis_experience', relatedPersonId: null, payload: { severity: 0.9 } }, { needs: needs({ safety: 0.2 }) })!, profile)
check(crisis.fear > 0.5 && crisis.sadness > 0, 'a crisis mixes fear with distress')

// Personality scales the reaction.
const calm = affectProfileFromTraits({ affect_reactivity: 0.1 })
const intense = affectProfileFromTraits({ affect_reactivity: 0.9 })
check(appraiseEvent({ goalImpact: 0.5, stakes: 0.8 }, intense).joy > appraiseEvent({ goalImpact: 0.5, stakes: 0.8 }, calm).joy, 'reactive persons feel the same event more strongly')

// Time scales: emotions fade in hours, mood lingers.
const afraid = applyAffect(neutralAffect('p1'), crisis, 100, profile)
const later = decayAffect(afraid, 112, profile)
check(later.fear < afraid.fear * 0.3, 'fear fades within hours')
check(Math.abs(later.mood) > Math.abs(afraid.mood) * 0.8 && afraid.mood < 0, 'mood outlasts the emotion')
check(decayAffect(afraid, 100, profile) === afraid, 'no decay without elapsed time')
const resilient = decayAffect(afraid, 106, affectProfileFromTraits({ affect_recovery: 0.9 }))
check(resilient.fear < decayAffect(afraid, 106, profile).fear, 'recovery trait shortens emotions')

// Determinism and bounds.
const again = applyAffect(neutralAffect('p1'), crisis, 100, profile)
check(JSON.stringify(again) === JSON.stringify(afraid), 'equal state and event give equal affect')
let stacked = neutralAffect('p1')
for (let i = 0; i < 20; i++) stacked = applyAffect(stacked, { joy: 0, fear: 1, anger: 1, sadness: 1 }, 100, profile)
check(stacked.fear === 1 && stacked.mood >= -1, 'values stay bounded under repeated events')

// Pain: signal, behavioural cost, emotional echo, learned avoidance.
const pain = painFromHealthEvent({ eventType: 'workplace_accident', severity: 0.7 }, profile)
const tough = painFromHealthEvent({ eventType: 'workplace_accident', severity: 0.7 }, affectProfileFromTraits({ pain_tolerance: 1 }))
check(pain > tough && tough > 0, 'pain tolerance dampens but does not remove pain')
check(painFromHealthEvent({ eventType: 'exhaustion', severity: 0.7 }, profile) < pain, 'exhaustion hurts less than an accident')
const hurt = applyPain(neutralAffect('p1'), pain, 200, profile)
check(hurt.pain === pain && hurt.fear > 0, 'pain registers and echoes as fear')
const hurtByFriend = applyPain(neutralAffect('p1'), pain, 200, profile, { causedByOther: true, intentional: true, causerTrust: 0.9 })
check(hurtByFriend.anger > hurt.anger, 'pain inflicted on purpose angers')
const acute = painEffects(hurt, 200, profile)
check(acute.workCapacity < 1 && acute.restPressureBoost > 0 && acute.reflexStimulus?.kind === 'pain', 'acute pain lowers capacity and feeds the reflex gate')
const healed = painEffects(hurt, 200 + 240, profile)
check(healed.workCapacity > 0.99 && healed.reflexStimulus === null, 'pain heals over days')
const aversion = learnPlaceAversion(pain, 'loc:fab', 200)!
check(placeSafetyPenalty([aversion], 'loc:fab', 210) > 0 && placeSafetyPenalty([aversion], 'loc:home', 210) === 0, 'the place where it hurt feels less safe')
check(placeSafetyPenalty([aversion], 'loc:fab', 200 + 7200) < placeSafetyPenalty([aversion], 'loc:fab', 210) * 0.01, 'aversion fades over a long time')
check(learnPlaceAversion(0.1, 'loc:fab', 200) === null, 'trivial pain teaches no aversion')

// Felt vs. shown.
const reserved = affectProfileFromTraits({ affect_expressiveness: 0.1 })
const toStranger = expressedAffect(afraid, reserved, 0.1)
const toFriend = expressedAffect(afraid, reserved, 0.9)
check(toStranger.fear < afraid.fear * 0.3 && toFriend.fear > toStranger.fear, 'a reserved person hides fear from strangers, less from friends')
check(expressedAffect(hurt, reserved, 0).pain >= hurt.pain * 0.5, 'pain cannot be fully hidden')
check(expressedAffect(neutralAffect('p1'), profile).dominant === 'neutral', 'no affect shows as neutral')

// Effect on the utility decision.
const context: PopulationDecisionContext = {
  person: { id: 'p1', displayName: 'P', birthYear: null, currentLocationId: 'loc:work', simulationTier: 'active', activityState: 'working', lastAction: null, lastDecisionFactors: {}, lastTick: null },
  needs: needs().map((need) => ({ ...need, personId: 'p1', updatedTick: null })),
  assignments: [
    { id: 'a1', personId: 'p1', assignmentType: 'work', locationId: 'loc:work', tileEntityId: null, employerActorId: null, roleCode: null, startsTick: null, endsTick: null, isActive: true },
    { id: 'a2', personId: 'p1', assignmentType: 'home', locationId: 'loc:home', tileEntityId: null, employerActorId: null, roleCode: null, startsTick: null, endsTick: null, isActive: true },
  ],
  skills: [], relationships: [], knowledge: [], workObligation: 0.6,
}
const baseline = decidePopulationAction(context)
check(baseline.action === 'work' && !('affectModifier' in baseline.factors), 'without affect the decision is unchanged')
const terrified = decidePopulationAction({ ...context, affect: { ...neutralAffect('p1'), fear: 1, pain: 0.8, updatedTick: 300 } })
check(terrified.action !== 'work' && typeof terrified.factors.affectModifier === 'number', 'fear and pain pull a person off work and show up in the trace')
const neutral = decidePopulationAction({ ...context, affect: neutralAffect('p1') })
check(neutral.action === baseline.action && neutral.score === baseline.score, 'neutral affect changes no score')
const lonely = decidePopulationAction({ ...context, affect: { ...neutralAffect('p1'), sadness: 1 } })
check(lonely.action !== 'social_interaction', 'affect never unlocks an unavailable action')
check(Object.values(affectActionModifiers({ ...neutralAffect('p1'), joy: 1, fear: 1, anger: 1, sadness: 1, pain: 1, mood: 1 })).every((value) => Math.abs(value!) <= 0.6), 'modifiers stay bounded')
check(affectSalience(afraid) === afraid.fear, 'salience is the strongest current signal')

if (failures) throw new Error(String(failures) + ' affect test(s) failed')
console.log('NPC affect runtime: tests passed; external_llm_calls=0')
