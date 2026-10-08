# Experimental feature registry — operating rules

Source of truth: [experimental-feature-registry.json](./experimental-feature-registry.json).
Governance: [ADR-experimental-features-lifecycle](../decisions/ADR-experimental-features-lifecycle.md).

The register records evidence, **not** runtime activation. Editing its stages or flags never changes production behavior.

## Status vocabulary
- `candidate-unverified`: conceptual candidate; repository and production behavior not comprehensively audited.
- `audit-required`: related source exists but runtime/deployment impact is not confirmed.
- `implemented-inactive`: isolated implementation has a default-off boundary; production callers still require auditing.
- Future transitions to `sandbox-validated`, `shadow-authorized`, `pilot-authorized`, `active`, `retired` require direct evidence and an operator decision.

## Maintenance
1. Before claiming inactivity, inspect current main code, invocation chains, environmental configuration, migrations, deployment and observability.
2. Split mature/live behavior and optional experimental extensions into separate registry identifiers.
3. Record owner, boundaries, tests actually run, measured resource budgets, activation authority and rollback before promotion.
4. `testsExecuted: false` means code was written without execution evidence; `null` means unknown. Do not infer success from an authored test file.
5. Do not use a global kill switch that affects existing gameplay.
6. Do not schedule shadow evaluations or create cost-bearing jobs without explicit authorization.
7. Reconcile this inventory periodically with GitHub and deployed configuration. It is an initial partial inventory, not an exhaustive census.

## Initial findings (2026-10-08)
- Mars clouds: cloud evaluation, tests and default-off wrapper exist; no production integration established.
- Population: personBrain has sleeping logic; population engine imports affect processing; further live-path audit required.
- NPC economy: code includes transfers and payroll routines. Never disable these to achieve experimental isolation.

## Activation record required
For any future experimental promotion, attach: feature ID; version and commit; approved scope; approving actor and date; evidence/test report; performance budget; observability and rollback plan. Approval belongs to the owner/operator, never to automated registry updates.
