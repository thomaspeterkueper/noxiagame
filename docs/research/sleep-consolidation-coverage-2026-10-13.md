# Sleep consolidation coverage: global limit regression
Date: 2026-10-13. Status: synthetic failure mode REPRODUCED; production incidence UNKNOWN.

Source audited: lib/game/cognition/personEpistemicPersistence.ts, consolidateSleepingEpistemicTraces. The query filters all sleeping person IDs, sorts descending by observed_tick and applies a shared limit(512). The limit is across persons, not per person.

A deterministic 600-row synthetic fixture models 550 more recent observations for person A and 50 older observations for person B. Applying the existing ordering/limit returns 512 for A, 0 for B. This is a reproducible logical coverage problem, not evidence that this exact distribution occurs in production.

Research files:
- lib/research/memory/sleepConsolidationCoverage.ts
- lib/research/memory/sleepConsolidationCoverage.test.ts

Remediation options to evaluate:
1. Batched keyset pagination by (observed_tick,id), with stable snapshot boundary and upper work budget; no silent truncation.
2. Per-person fair scheduling with a persisted cursor, retaining backpressure and avoiding one query per NPC.
3. SQL window partitioning by person if supported and benchmarked, with capped per-person rows and explicit carry-over.
Do NOT simply remove limit(512) or add one database request per NPC. Establish query plan, index coverage, row volumes, retry semantics and per-tick resource budget first.

Suggested metrics: eligible people, people with eligible traces, people consolidated, total rows available/processed/deferred, oldest deferred age, fairness across persons, query count, DB duration and payload bytes. Distinguish deferred from lost. Validate idempotent upserts and zero-row people.

Verification: the fixture's sorting/limit was run locally with Node and returned A=512, B=0. The committed Vitest suite has not been run here; do not claim CI green. No production tables or behavior changed.
