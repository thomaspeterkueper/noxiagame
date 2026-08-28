# NOXIA_TESTER_INTELLIGENT_01 v0.1

Bounded autonomous gameplay tester for disposable `tester-*` worlds.

## Loop
`Observe → Goal/Plan → Action → Result` with at most 8 cycles per run and 20 retained observations/results/fingerprints.

## Authority boundary
`AuthoritativeTesterAdapter` never writes game tables. Its `AuthoritativeGamePort` must be wired to the same NOXIA application services used by human actions (travel, trade, build, learn). Direct Supabase gameplay mutation is intentionally not provided.

## Persistence
`noxia_tester_state` stores bounded state service-role-only. Apply `supabase/migrations/20260828_noxia_tester_state.sql` before persistent execution.

## Reporting
Only `BUG` and `DEAD_END` are emitted in v0.1. Reports contain deterministic fingerprint, reproduction, expected/actual result, confidence and evidence. Duplicate fingerprints are suppressed. The tester cannot merge code, alter balance, invent canonical content or implement proposals.

## Deterministic harness
`runDeterministicTesterHarness()` demonstrates one normal progression cycle and one deduplicable `DEAD_END` anomaly cycle without an LLM/provider. `TesterPlanner` is the provider-neutral planner boundary.

## Remaining integration point
Wire `AuthoritativeGamePort` to the existing authenticated NOXIA game services in a dedicated tester runner. Do not bypass those services with direct table writes.
