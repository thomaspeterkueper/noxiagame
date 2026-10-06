# AVI executable-physics interface

Status: architecture contract
Date: 2026-10-06
Upstream: thomaspeterkueper/avi-modell/docs/avi-noxia-executable-interface-v0.1.md

## Role of NOXIA

NOXIA can act as an executable laboratory for selected AVI hypotheses, while remaining a game/simulation platform. It must not treat AVI assumptions as empirical truth merely because they are implemented.

The runtime must preserve four separations:
- canonical simulated world state;
- observations available to a sensor/NPC/player;
- beliefs/models inferred by agents;
- real-world evidence imported from research.

## Physics model classes

Any future AVI-facing simulation module must identify its model class:
- BASELINE
- AVI-CANDIDATE
- PHENOMENOLOGICAL
- FICTIONAL

UI, logs, experiment output and exported research data should retain this label where scientific interpretation is possible.

## Executable experiment boundary

A module is eligible for AVI experimentation only when its upstream specification defines state variables, rules/constraints, parameters/units, boundary conditions, observables, validity domain, baseline and a discrimination/failure criterion.

Prefer paired execution:

baseline(initial conditions, parameters)
vs.
aviCandidate(same initial conditions, declared AVI parameters)

Then compare predeclared observables.

## Observation architecture

Do not expose raw canonical state as an agent's knowledge. Measurements should pass through an observation model with uncertainty, instrument capability and disturbance/integrity metadata. This directly applies the Integrity of Observation principle.

## Temporal/path-dependent architecture

Where the selected physics requires it, retain sufficient history to test Timescale Engineering and Trajectory Engineering. Endpoint-only state reduction is invalid when history changes the predicted outcome.

## Scientific guardrail

A NOXIA result is SIMULATION EVIDENCE about a model implementation, not EMPIRICAL EVIDENCE about nature.

Useful outputs include:
- model divergence maps;
- sensitivity surfaces;
- emergent signatures;
- numerical failure regions;
- candidate real-world observations/experiments.

These should be routed outward as hypotheses/tasks, never as confirmed discoveries.

## Implementation sequence

1. Select one AVI hypothesis that passes the upstream eligibility gate.
2. Define a machine-readable experiment manifest.
3. Implement baseline and AVI candidate behind the same interface.
4. Add deterministic/reproducible test cases.
5. Compare discriminating observables.
6. Export results with provenance/model-class metadata.
7. Route promising signatures to the observational evidence pipeline.

This contract should be extended only after the first end-to-end experiment works.
