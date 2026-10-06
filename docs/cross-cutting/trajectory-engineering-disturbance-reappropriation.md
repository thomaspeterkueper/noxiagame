# Cross-cutting principles: Trajectory Engineering & Disturbance Reappropriation

Status: active simulation/design guidance
Established: 2026-10-06

## Trajectory Engineering

NOXIA systems may be path-dependent: reaching the same nominal state through different sequences can consume different energy, create different damage, risks, emissions, material states or success probabilities.

Where relevant, simulation should retain process history rather than deriving outcomes solely from current endpoint values.

Applications include propulsion, fusion/energy systems, batteries, manufacturing, habitat control, medicine/biology, robotics and logistics.

## Disturbance Reappropriation

Technologies and NPC/agent engineering should be able to discover that a nuisance process can become useful when controlled. Examples include waste streams, heat, vibration, chemical side reactions, interference or environmental variability.

Discovery should require evidence and engineering capability; it must not be an automatic bonus from any failure.

## Research gameplay

Support the loop:
observe anomaly -> characterize disturbance/path dependence -> form hypothesis -> simulate/test -> validate -> engineer -> productize/deploy.

Keep simulated discovery separate from empirical real-world evidence when knowledge is exchanged with other projects.

## Relations

These principles complement Integrity of Observation and Timescale Engineering:
- Integrity asks whether evidence is trustworthy.
- Timescale asks whether changing temporal regime changes the limit.
- Trajectory asks whether the route through state space changes the outcome.
- Reappropriation asks whether an unwanted process can become controlled function.
