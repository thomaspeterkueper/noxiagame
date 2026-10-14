# Cross-cutting principles: observation integrity, timescale engineering and adaptive detail

Status: active design guidance
Established: 2026-10-05

## Integrity of Observation

NOXIA must distinguish a value from the evidence supporting that value. Measurements, navigation, NPC/world knowledge and autonomous-agent observations should carry enough provenance to reason about:

- source and acquisition method;
- accuracy/uncertainty;
- freshness;
- authentication/integrity where applicable;
- interference, spoofing, contamination or self-interference risk;
- processing/derivation history.

A plausible observation is not automatically a trustworthy observation. Systems should degrade confidence explicitly instead of silently converting uncertain or unauthenticated input into world truth.

This extends the existing separation between reasoning, intent, authority and execution: observations are evidence inputs, not authority by themselves.

## Timescale Engineering

When a physical or control-system bottleneck exists, evaluate whether the operation, measurement or feedback loop can run on a timescale that avoids or suppresses the limiting process.

Examples include pulsed operation faster than thermal, vortex, diffusion or degradation dynamics; deliberately slower integration to suppress transient noise; and multi-rate control loops.

Treat this as an engineering option alongside new materials, larger components or more complex algorithms.


## Adaptive Detail Resolution

NOXIA must not model every subsystem at maximum granularity all the time.

**Principle:** simulation detail increases only where additional detail becomes
causally relevant, observable, decision-relevant, failure-relevant or economically
relevant. Otherwise the subsystem remains on the coarsest level that preserves
the required behavior and invariants.

This is not permission to invent hidden detail later. Coarse state must remain
compatible with any finer model it may expand into.

Examples:

- A kitchen normally needs only operational state, food availability and maintenance cost.
  Cleaning robots and waste handling remain facility inventory/maintenance unless a real
  shortage or failure makes them decision-relevant.
- A door is normally open/closed. Hinge, actuator, seal or lock detail appears only when
  damage, pressure containment, access control or repair depends on it.
- A machine can be represented by condition + maintenance debt until a component failure,
  spare-part dependency or diagnosis requires decomposition.
- Population can stay aggregated at macro scale until an individual person, household,
  relationship, movement or decision becomes locally relevant.
- Geography can remain coarse at planetary scale and resolve to streets, buildings and
  interiors only where observation, movement or interaction needs them.

### Refinement triggers

Increase detail when at least one of these applies:

1. a causal outcome depends on the internal state;
2. an actor can observe or interact with the internal state;
3. a decision, price, risk, failure or repair depends on it;
4. a scientific/engineering measurement requires the finer representation;
5. consistency would otherwise be lost between two authoritative systems.

Do **not** refine merely because a finer model is imaginable.

### Collapse rule

After the relevant event or interaction has ended, fine state may be summarized back into
a coarser representation when doing so preserves authoritative consequences, provenance,
damage/maintenance state, ownership, inventory and any other information needed for replay
or future decisions.

Adaptive detail is therefore a resolution strategy, not data deletion.

### Relationship to the other principles

- **Integrity of Observation** decides what evidence justifies resolving a state more finely.
- **Timescale Engineering** decides how often a resolved subsystem needs to be evaluated.
- **Adaptive Detail Resolution** decides how much of that subsystem needs to exist explicitly.

Together they control **trust, time and granularity**.

## Causal Sufficiency

Adaptive Detail Resolution is constrained by **causal sufficiency**: a coarse representation
is acceptable only while it can reproduce all causally relevant consequences required at that
level. Deeper state is resolved when observation, interaction, failure or research makes it
necessary, and the refined state must remain compatible with the already established history.

This creates three distinct notions of depth: ontological, simulated and epistemic. They must
never be conflated.

See `docs/architecture/NOXIA-PHIL-0001-causal-sufficiency-and-simulation-epistemology.md`.

## Robustness rule

Disturbances are part of the model. Prefer architectures that represent, characterize, authenticate, suppress or route around disturbances rather than assuming ideal inputs.

Apply these principles to sensors, navigation, robotics/MiniNodes, vehicles, habitats, buildings, logistics, economies, populations, geography, scientific gameplay, autonomous agents and future X-era systems.

## Cross-project flow

Research evidence -> Knowledge Graph -> Engineering hypothesis/design -> Product opportunity/prototype -> NOXIA simulation/story feedback.

Predicted capability and measured capability must remain distinguishable throughout the flow.
