# NOXIA Core — Cognitive Runtime

Status: vertical slice for #236 / #235.

This runtime deliberately builds on the existing epistemic learning cycle:

`WorldEvent → sensor projection → PersonObservation → PersonKnowledge → DecisionSufficiency → CognitiveTrigger → rule/research/escalation → Observation`

## Invariants

- Ground truth remains authoritative in its owning domain.
- NPCs reason from observations/knowledge, never canonical world snapshots.
- Existing DecisionSufficiency and information-gathering contracts are reused.
- L0/L1/L2 are deterministic.
- L3 is reserved for future local inference.
- L4 creates an EscalationRequest only. No provider call exists here.
- Research output is structured and versioned before any narrative rendering.

## Chronobiology vertical slice

A habitat lighting phase shift is projected into a sensor observation. Fresh, sufficiently confident evidence passes the existing epistemic sufficiency gate. Small deviations use known protocols; novel deviations create Hypothesis and ExperimentPlan objects. Experimental evidence can create a versioned ProtocolRevision. Large and uncertain cases create an L4 request but do not invoke external AI.

This makes the research loop cheap by default and preserves provenance for later NPC groups, gameplay and canon-candidate generation.
