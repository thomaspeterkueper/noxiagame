# ACCE-001 — AVI Core Closure Experiment 001

Status: executable reference experiment
Date: 2026-10-06

## Question

Can the AVI-Core workflow distinguish an apparent history/state anomaly from an intentionally hidden but standard state variable?

## Construction

Two histories end with the same reduced visible state x=10 but different hidden standard carrier h:

- A: (x,h)=(10,-2)
- B: (x,h)=(10,+2)

The observable is q=x+h.

If reconstruction incorrectly treats x as the complete state, the cases look same-state while q differs: q_A=8 and q_B=12. The apparent closure defect is 4.

When h is restored to Omega_std, both outcomes are predicted exactly and the residual closure defect is 0.

## Interpretation

PASS means the executable workflow refuses an ontology extension when standard-state completion explains the anomaly.

It does not support a new AVI degree of freedom and is not empirical evidence. Its evidence class is SIMULATION_EVIDENCE.

## Gate

Only after this reference behavior is stable should a genuine AVI-CANDIDATE model be added. Candidate models must use the AVI-NOXIA interface contract and include a baseline, null embedding and a predeclared discrimination/falsification criterion.
