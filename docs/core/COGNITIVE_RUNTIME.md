# NOXIA Core — Cognitive Runtime Slice 01

Status: initial implementation for #236, supporting #235 and #234.

The runtime extends the existing epistemic observation boundary rather than bypassing it:

`WorldEvent → sensor projection → PersonObservation → CognitiveTrigger → L0/L1/L2 decision → optional L4 EscalationRequest`

## Authority

World events belong to authoritative domain systems. Agents never receive the event payload wholesale. Sensor/domain adapters explicitly project observable facts into `PersonObservation`. Existing `knowledgeFromObservation` remains the bridge into person knowledge.

## Budget

The initial budget policy is deterministic and has no provider dependency:

- L0: no cognitive action
- L1: known rule/protocol
- L2: experiment or multi-step planning
- L3: reserved for future local inference
- L4: create a persistent escalation request only

No LLM call exists in this slice.

## First vertical scenario

A greenhouse lighting phase shift is measured by a chronobiology NPC. Small deviations use existing protocols. Novel deviations enter an experiment path. Large and uncertain observations create an L4 request without executing external inference.

The important invariant is epistemic: hidden causes in authoritative `WorldEvent.payload` do not become agent knowledge unless a sensor/action/communication explicitly observes them.

## Next

Persist Hypothesis, ExperimentPlan and TemporalProtocol revisions, then connect the slice to the existing population tick/action-intent boundary. Provider adapters remain out of scope until this deterministic path is stable.
