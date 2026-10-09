# NOXIA Habit Persistence — gated integration

The pure habit scorer was merged via PR #462. This change adds passive, service-role-only storage and a batch-loading adapter. **It does not activate live learning or scoring.**

## Why activation is gated

The population engine currently records an action decision and advances needs even when the action executor reports `not_executed_here`. That is not an authoritative success signal. Counting such ticks as successes would teach fabricated competence and corrupt research measurements.

## Activation prerequisites

1. Identify an authoritative outcome for each action family (work, travel, local interaction, rest, needs) from its owning adapter. Distinguish *attempted*, *executed*, *beneficial* and *harmful*.
2. Make outcome persistence idempotent under tick replay, ideally with a unique event/decision key and atomic upsert or RPC. Current adapter only rejects stale ticks based on its supplied prior state; it is not concurrency-safe.
3. Build stable, low-cardinality context keys from location role, circadian phase, relevant need pressure and affordances, not raw tick or coordinate.
4. Measure baseline-vs-habit actions, DB reads/writes, tick latency, and decision quality. Habit bias must not be mistaken for saved LLM tokens until an actual cognition tier is skipped.
5. Test harmful habits, extinction, context switches, sleep emergencies, unavailable actions and simultaneous updates.

Migration is deliberately passive, RLS enabled and has no authenticated/anonymous access. Rollout only after verification of the schema and runtime permissions.
