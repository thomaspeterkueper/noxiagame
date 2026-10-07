# ACCE-002 — Layered Standard-State Diagnosis

**Status:** executable diagnostic reference experiment  
**Date:** 2026-10-07

## Question

Can the AVI-Core workflow determine which class of standard information is missing when a closure defect appears, rather than merely noticing that the reduced state is incomplete?

## State decomposition

ACCE-002 operationalizes four classes already required by the AVI Core:

1. internal state,
2. environment/boundary state,
3. global state,
4. channel/measurement state.

The visible base variable is x. The synthetic observable is the sum of x and the four controlled standard contributions.

## Protocol

Four independent cases are generated. In each case exactly one known standard carrier differs between A and B and is omitted from the reconstruction. This produces a non-zero closure defect. Candidate carrier classes are then restored one at a time.

A diagnostic PASS requires:

- a defect under the incomplete reconstruction;
- identification of the actually omitted class;
- exact restoration of closure after adding that class;
- refusal to admit an ontology extension.

Expected defects are deliberately distinct: internal=2, environment=3, global=5, channel=7.

## Scientific meaning

ACCE-001 tested the binary rule “complete the standard state before inventing Z”.

ACCE-002 tests the stronger rule “diagnose where standard closure is missing”. It therefore exercises the path

```
Omega_reduced
  -> internal audit
  -> environment/boundary audit
  -> global audit
  -> channel audit
  -> closure restored OR unresolved defect
```

A PASS is methodological simulation evidence only. It does not show that nature contains an AVI-specific state.

## Next gate

A future ACCE-003 should make diagnosis non-trivial by combining multiple omitted carriers, uncertainty/noise and competing reconstructions. Only after the diagnostic pipeline survives such ambiguity should an AVI-CANDIDATE be introduced.
