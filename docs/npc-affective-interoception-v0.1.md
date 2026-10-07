# NPC Affective & Interoceptive Architecture v0.1

Status: experimental deterministic runtime slice.

## Contract

NOXIA separates four layers:

1. **Body state** is authoritative simulation truth: injury, tissue damage and systemic stress.
2. **Interoception** is the person's bounded sensing of that body state. Nociception is not identical to pain behaviour.
3. **Affective appraisal** derives valence, arousal, salience and goal conflict without changing world truth.
4. **Cognition/action** consumes those signals. A high-priority protective reflex may pre-empt ordinary deliberation.

Language models never decide whether an NPC is injured or in pain. They may later verbalise an already-derived subjective state.

## v0.1 runtime

`lib/game/cognition/affectiveInteroception.ts` implements a pure deterministic bridge:

`BodyState -> InteroceptiveState -> AffectiveState -> CognitiveStimulus + optional ReflexIntent`

It deliberately has no persistence dependency. This keeps routine ticks cheap and lets thresholds be tested before schema work.

### Reflex semantics

Reflexes are not memories and are not plans. They are fast protective action intents. Repeated successful or harmful outcomes may later shape learned anticipatory behaviour through the existing memory/consolidation system; that learned behaviour must remain distinct from the reflex itself.

## Next integration boundary

After threshold validation, feed `stimulus` into the existing `selectCognitiveState` input and let `personBrain` give `ReflexIntent` priority over role/routine work. Persist body state only when an authoritative injury/health event exists. Persist subjective affect only if later gameplay needs longitudinal mood/history.

## Invariants

- deterministic and auditable
- no random pain
- no LLM world-truth writes
- body damage != nociception != affect != expressed emotion
- no reflex requires external inference
- healthy body creates no synthetic pain
- systemic distress can exist without nociception
