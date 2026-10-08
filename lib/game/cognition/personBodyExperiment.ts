import { applyBodyInsult, advanceBodyHealing, healthyBody, projectBody, type BodyInsult, type PersonBodyState } from './personBody'
import { evaluateReflex, reflexProfileFromTraits } from './personReflex'
import { applyPain, affectProfileFromTraits, neutralAffect } from './personAffect'

/** One deterministic event-driven body-to-reflex-to-affect experiment. No database writes. */
export function simulateBodyIncident(input: {
  personId: string
  tick: number
  insult: BodyInsult
  body?: PersonBodyState
  traits?: Record<string, unknown>
}) {
  const body = applyBodyInsult(input.body ?? healthyBody(), input.insult)
  const projection = projectBody(body)
  const reflex = projection.reflexStimulus
    ? evaluateReflex(reflexProfileFromTraits(input.traits), projection.reflexStimulus)
    : null
  const profile = affectProfileFromTraits(input.traits)
  const affect = applyPain(neutralAffect(input.personId), projection.painSignal, input.tick, profile)
  const healedBody = advanceBodyHealing(body, 12)
  const later = projectBody(healedBody)
  return { body, interoception: projection.interoception, reflex, affect, healedBody, later }
}
