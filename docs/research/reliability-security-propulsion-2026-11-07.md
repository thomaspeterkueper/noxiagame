# Reliability Research: Security Agents and Reusable Propulsion

Status: research proposal (2026-11-07); not an implementation or validated finding.

## Shared evaluation contract
Each claim records source, date, operating envelope, method, reproducible evidence, uncertainty, failure mode, independent verification and review owner. Separate simulation, laboratory demonstration and operational proof.

## Track A: AI-assisted security
Scope: repository dependencies, static analysis, configuration, tests and authorization boundaries. Pipeline: inventory -> read-only findings -> severity triage -> isolated reproduction -> proposed patch -> regression test -> human-approved deployment. Never run exploits on production or external targets without explicit authorization. Metrics: verified true-positive rate, false-positive rate, remediation time, regression pass rate, boundary violations and audit completeness. First experiment: evaluate existing CI checks against a deliberately vulnerable isolated fixture, with no live exploitation.

## Track B: reusable propulsion
Scope: conventional methane/oxygen rocket engines, not hypothetical X-drive mechanisms. Model restart count, ignition success, throttle envelope, thermal cycles, component wear, inspection and turnaround costs. Record distributions and confidence intervals rather than fixed success assumptions. First experiment: simulation with explicitly synthetic parameters, sensitivity analysis, and a validation plan against published test data.

## NOXIA transfer
Introduce a generic lifecycle: prototype -> bench test -> repeated-cycle qualification -> limited operation -> maintenance -> retirement. Display evidence level and uncertainty in the simulation. X-drive remains fictional and must be labeled separately.

## Next steps
1. Inventory current security workflows and propulsion simulation modules.
2. Create fixture-based security evaluation and propulsion reliability schema.
3. Add tests and provenance records before connecting to live systems.
4. Review sources and performance thresholds before implementation.
