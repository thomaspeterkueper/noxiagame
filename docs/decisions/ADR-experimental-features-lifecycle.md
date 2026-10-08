# ADR: Experimental features — develop now, activate deliberately

Status: Accepted (2026-10-08)
Scope: noχ¹ᐃ gameplay, AI/NPC, physics, economy, simulation, rendering, research integrations.

## Decision

A feature may be designed, implemented, unit-tested, and validated in an isolated harness well before it becomes part of active gameplay. **Having code in main does not authorize running it.**

Lifecycle:
1. **Idea** — hypothesis, owner, required inputs and expected benefits documented.
2. **Specified** — interfaces, dependencies, provenance, performance budget, uncertainties and acceptance tests.
3. **Implemented, inactive** — code present; no active calls or player-facing effects.
4. **Sandbox validated** — synthetic and reference-scenario tests, replay, regression and cost measurements.
5. **Shadow / observation** — *separately authorized*, read-only execution against selected real world snapshots; no gameplay writes or decisions.
6. **Limited rollout** — explicit operator permission, restricted scope, monitoring and rollback.
7. **Active** — approved and observable in normal simulation.
8. **Retired / archived** — code disengaged with migration strategy where appropriate.

Default for new experimental features is **OFF**. Flags must fail closed when absent, invalid or unsupported. Dangerous or costly features may remain at stages 2–4 indefinitely.

## Runtime safeguards

- Keep pure/domain evaluation separate from tick scheduler, persistence, external API calls, and UI projection.
- Require an explicit feature-level gate at the integration boundary; an import, database migration, default setting or deploy must not enable the feature.
- Gate high-risk sub-capabilities independently (e.g. experimental homogeneous Mars cloud nucleation).
- A staged rollout needs a recorded operator decision, scope (environment/region/actor), version, owner and rollback method.
- Sandbox and shadow paths must never mutate canonical gameplay state, create billable autonomous loops, or appear as authoritative player information.
- Shadow execution itself requires explicit permission because it consumes resources; keep it OFF until approved.
- Isolation must preserve a single source of truth. No parallel worldstate or hidden database writes.
- Flag removal/replacement requires an audit of all call sites; never use a broad implicit enable-default.
- Avoid introducing new services, schema changes, background tasks or recurring costs merely to hold an inactive module.

## Evidence and quality bar

For every experimental feature keep a small manifest documenting:
- identifier, owner/domain, purpose and lifecycle stage;
- entrypoint and relevant call sites, dependencies, feature flag and its OFF default;
- test/replay coverage, data sources and uncertainty, measured CPU/DB/API/LLM cost;
- activation conditions, required compatibility/migrations, monitoring and rollback;
- scientific status: observed fact vs interpretation vs exploratory mechanism.

Promotion is **manual** after review; no automatic progression based only on test pass.

## Initial candidate inventory (not an implementation audit)

- Mars atmospheric cloud events: code plus default-off runtime gate already committed; scientific calibration, full integration and test execution pending.
- Further NPC cognition, dreams, senses, affect, cultures and religions; advanced economies, robotics, X-technology and speculative physical systems: evaluate **individually** against their current repository state before assigning a stage. Existing live behavior must not be disabled on the basis of this document.
- AVI/OTA/SSF research remains an evidence source, not automatic permission to alter game balancing.

## Checklist for each new module

1. Inventory existing code and deployed behavior; avoid duplicates.
2. Record purpose, limits, proposed stage and dependencies.
3. Build an isolated pure core and unit tests where possible.
4. Add a default-off integration flag and verify fail-closed behavior.
5. Measure replay stability and resource usage outside production.
6. Ask for explicit authorization before shadow or production activation.

This ADR defines policy, not a global flag registry or a live feature migration. Add a lightweight registry only after auditing existing flag conventions and lifecycle machinery.
