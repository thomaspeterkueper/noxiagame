# EXTERNAL TASK — Mars Settlement Integrated Simulation & Gameplay

- **Origin:** Mars Settlement Systems Kernel
- **Target:** NOXIA Game
- **Date:** 2026-09-27
- **Status:** open

## Goal
Turn the Mars settlement from a collection of buildings/resources into a network of coupled systems while keeping the player interface legible.

## Player model
Use three layers:
1. **Overview:** settlement health, reserves, critical warnings.
2. **Networks:** power, water, atmosphere, logistics, biological loops.
3. **Diagnostics:** individual nodes/processes, measured values, uncertainty and faults.

Do not require routine micromanagement of every valve/pump. Automation handles normal operation; the player designs capacity, redundancy, priorities and responses to exceptional states.

## Settlement phases
### Phase A — Outpost
High imports, physicochemical ECLSS, packaged food, simple waste handling, little biological closure.

### Phase B — Permanent base
Local water extraction, larger power/storage, controlled agriculture, repair workshop, first nutrient recovery and robots.

### Phase C — Settlement
Coupled agriculture/waste/soil ecology, adaptive industry, local fabrication, larger storage/buffers, partial N/P recovery, diversified energy.

### Phase D — Mature settlement
High but never magical closure, robust living infrastructure, local supply chains, distributed production/robotics and ecological management.

Ecopoiesis beyond contained/managed environments remains a separate long-timescale progression.

## Core gameplay
Every building/process exposes inputs, outputs, capacities, priority, condition and confidence of monitoring. Networks determine whether nominal capacity can actually be delivered.

Flexible loads include electrolysis, charging, water processing and selected industry. Critical loads include life-support control, minimum thermal control and emergency communications.

## Failure gameplay
Failures propagate causally. Example:
dust event -> solar deficit -> battery reserve falls -> noncritical loads shed -> greenhouse lighting reduced -> crop output delayed -> food buffer declines.

Player interventions should include load shedding, rerouting, isolation, repair, imports, temporary operating modes and schedule changes.

## No fake single self-sufficiency number
Show a closure/autonomy vector and highlight the weakest dependency.

## Learning mode
Provide an optional 'Mars Systems Lab' using the same simulation:
- survive 30 sols with imported supplies;
- add local water;
- introduce agriculture;
- close organic/nutrient loops;
- experience a coupled failure;
- compare a fragile optimized design with a buffered redundant design.

Teach stocks vs flows, bottlenecks, resilience, closure and feedback.
