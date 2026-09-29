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


## Magnetobiology vertical slice

The magnetobiology path reuses the same runtime contracts instead of creating a domain-specific research engine.

`learning unlock → research capability gate → Hypothesis → ExperimentPlan → ResearchFinding → EvidenceAssessment`

The experiment records magnetic exposure and organism context explicitly. Findings support four outcomes: `supports`, `contradicts`, `null`, and `inconclusive`.

Evidence policy for this slice is deliberately conservative:
- a null finding is persisted and does not unlock a protocol revision;
- one supporting finding is `provisional`;
- two informative supporting findings reach `replicated` for protocol-review eligibility;
- contradictory evidence prevents automatic positive interpretation;
- protocol-review eligibility is not itself a human-health, ageing, therapeutic, or habitat-effect claim.

The current command bridge is deterministic and performs no external model call. It preserves OTA provenance from `OTA-SCI-0096-2026-DE`.
