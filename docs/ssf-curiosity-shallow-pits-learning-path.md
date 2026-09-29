# SSF/KG Research Case — Curiosity broad shallow pits (2026)

## Epistemic status
**Open question.** This case must not encode a preferred cause as ground truth.

NASA's Curiosity team reported broad, shallow pits across Mount Sharp bedrock around sols 4988–4994. The highlighted example is about 1 cm across. Weathered-out resistant nodules or pebbles can leave pits, but these examples were broader and shallower and lacked obvious former occupants. MAHLI and Mastcam acquired stereo/overlapping images suitable for digital elevation models.

## Context, not answer
The Mount Sharp boxwork campaign supplies relevant context: fractures, mineral cementation, calcium-sulfate veins, nodules, ridges/hollows and differential erosion associated with ancient groundwater. This makes fluid, mineral and erosional explanations testable; it does not establish the cause of these new pits.

## KG separation
- Observed: morphology, scale, stratigraphic context and measured instrument data.
- Interpretation: competing causal hypotheses.
- Unknown: formation mechanism until discriminating evidence changes the assessment.
- Invariant: NPC, KG, SSF and UI must never expose an unobserved historical cause as fact.

## NOXIA hypotheses
Executable catalogue: `lib/game/science/curiosityShallowPits.ts`
- weathered resistant inclusions
- differential cementation plus erosion
- selective mineral dissolution/removal
- preferential mechanical erosion

Priors are deliberately weak gameplay inference parameters, not scientific probabilities.

## Learning path
1. Observe and quantify pit width, depth and shape distribution.
2. Build stereo DEMs and compare profiles.
3. Measure host bedrock versus pit rim/interior chemistry.
4. Test mineralogy, textures, vein/cement association, remnants and mechanical weakness.
5. Use `discriminatingQuestions()` to select observations that separate hypotheses.
6. Recompute assessments from player/NPC knowledge only.
7. Preserve unresolved/contested status when evidence is insufficient.

## SSF objective
Success is not guessing an origin. The learner must distinguish observation, context, hypothesis, discriminating measurement and conclusion, then choose a measurement that reduces ambiguity.

## Sources
NASA Science: Curiosity Blog, Sols 4988–4994, 2026-09-03.
NASA/JPL: Curiosity Rover Sees Martian Spiderwebs Up Close, 2026-02-23.
