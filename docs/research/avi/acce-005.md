# ACCE-005 — Uncertainty-Aware Reconstruction Gate

**Status:** executable diagnostic reference experiment  
**Date:** 2026-10-08

ACCE-003 and ACCE-004 already contain newer NOXIA work on embodied historical carriers, so this experiment uses the next free identifier.

## Question
Can the AVI workflow distinguish a false anomaly caused by collapsing P(Omega|D,M_std) to a point estimate from a residual that survives correct posterior-predictive marginalization?

## Preregistration
P(Omega|D,M_std)=Normal(10,4), measurement variance=1, hence P_std(O|D,M_std)=Normal(10,5). Statistic: absolute posterior-predictive z; threshold=2. Seed metadata=20261008. The analytic calculation is deterministic; the seed reserves reproducibility for later sampled reconstructions.

## Controls
For O=13, the wrong point treatment gives z=3, while correct marginalization gives 3/sqrt(5)≈1.342: **STANDARD_CLOSURE**.

For O=16, correct marginalization still gives 6/sqrt(5)≈2.683: **UNRESOLVED_CLOSURE_DEFECT**.

The latter opens only an E1/E2 audit. It does not admit Z.

## Methodological sequence
ACCE-001: hidden-state recovery.  
ACCE-002: carrier-class localization.  
ACCE-003/004: embodied/path-dependent present carriers.  
ACCE-005: posterior uncertainty and false-discovery control.

## Next gate
Test a correlated multivariate state posterior across multiple observation channels. Ignoring covariance should be capable of generating a deliberately constructed false cross-channel signal; preserving covariance must remove it.
