# NOXIA Core — Epistemic Observation Contract

Status: initial implementation contract for #214.

NOXIA separates authoritative world truth from what an actor can know.

`Ground Truth → Sense/Measure → Observation → Knowledge/Belief → Decision → ActionIntent → validated Domain Action → Result/Event → Observation`

## Boundaries

- Ground truth remains in the owning Core/domain model and is never injected wholesale into a decision context.
- An observation is an actor-scoped record of something perceived, measured, communicated or returned by an action.
- Knowledge/belief is a deterministic projection from observations/events. It can be incomplete, uncertain or stale.
- Communication transfers information plus provenance; it does not turn a claim into ground truth.
- Decisions consume actor-visible knowledge and other explicitly observable state.
- Action intents do not mutate the world. Existing authoritative domain actions validate and execute them.
- Results/events may generate new observations, closing the learning loop.

## Observation minimum

An observation carries observer identity, tick/time, subject identity, observation type, source, confidence, payload and evidence references. It may additionally carry spatial scope and a validity/freshness horizon.

## Freshness

`observedTick` records when evidence was obtained. `validUntilTick` can mark information that should be considered stale after a known horizon. Domains may later add richer decay models without changing the fundamental boundary.

## Existing model reuse

`PersonKnowledge` remains the population knowledge projection. #214 does not introduce a parallel person-knowledge table. Social memory remains the personal/social consequence layer and `PopulationActionIntent` remains the bridge from decision to validated action.

## Realtime boundary

`noxia-realtime` is not authoritative for epistemic state. A future adapter may submit sensor observations and receive action intents/results. Unity-local animation, interpolation and transient interaction state do not become canonical world truth.

## Non-human actors

The same cycle should later support rovers, mines, power plants and habitat controllers. Their sensors and actuators differ; the epistemic boundary and authoritative action contract do not.
