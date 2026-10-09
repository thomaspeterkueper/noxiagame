# NOXIA-LIVING-0007 — Physiological regulation and social belonging
Status: experimental, inactive; no production writes.

## Model
Abstract dimensionless regulation channels (0–1), not measurements of hormones or enzymes. Stress, energy, recovery, arousal, inflammation, social safety, belonging and loneliness are separate variables. Belonging is the durable experience of meaningful acceptance; loneliness is a subjective discrepancy between desired and experienced connection. **They are not mathematical opposites**: an NPC may be lonely within a group or experience solitude without loneliness.

## Causal inputs
Authoritative injury, sleep, food, threat and observed social interactions. Physical proximity alone does not imply meaningful contact. Rejection and support can coexist. The model must not infer social bonds solely from dialogue sentiment or NPC location.

## Timescales
Fast arousal/stress, intermediate recovery and social safety, slow belonging/loneliness. Lazy decay on events and read, not continuous per-tick database updates. No LLM in the regulation loop.

## Integration gates
1. Pass deterministic tests and inspect existing affect/reflex modules for duplication.
2. Link observed population events to regulation, then use derived modifiers in health/needs; do not write affect twice.
3. Only after concurrency and replay tests consider persistence and migration.
4. Measure per-1000-NPC writes, CPU and social behavior in multi-day shadow runs.
