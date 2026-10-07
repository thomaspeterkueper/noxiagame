# ACCE-004 — Layered Biographical Closure Curve

**Status:** executable diagnostic reference experiment  
**Date:** 2026-10-07

## Question

When two agents with different biographies respond differently despite the same reduced visible situation, how much of the response difference is closed by adding known present-state carriers one layer at a time?

## Present carriers

ACCE-004 uses only state classes already implemented in NOXIA:

1. affect (emotion, mood, pain-derived salience),
2. reflex adaptation (habituation/sensitization),
3. consolidated-memory attention (salience/uncertainty).

The historical episode list is not a predictor. The experiment asks where history is presently embodied.

## Protocol

A synthetic response observable is built from the three carrier classes. Reconstruction starts with the reduced visible state and then adds carriers cumulatively:

visible -> affect -> affect+reflex -> affect+reflex+memory

At each stage the remaining closure defect is measured. The coefficients are diagnostic fixtures, not empirical psychological weights.

## Gate

For the constructed reference case, each restored carrier must reduce the defect and the complete known present state must close it exactly. Failure means either an implementation defect or a missing carrier in the constructed model.

A residual after all known present carriers are restored is **not automatically evidence for irreducible history**. It first triggers an audit for omitted present carriers such as physiology, learned policy/habit, relationships, needs, skills, environment or measurement/channel state.

## Scientific meaning

ACCE-004 operationalizes a biographical closure curve D_n. It turns the broad statement “history matters” into the more discriminating question “through which present structures does history still act?”

This supports a conservative ontology rule:

> Do not promote history itself to an additional state carrier while presently embodied traces can restore predictive closure.

## Next gate

Add a real habit/learned-policy carrier when NOXIA has an authoritative persistent runtime for it, then repeat the closure audit on observed NPC trajectories rather than a synthetic response observable.
