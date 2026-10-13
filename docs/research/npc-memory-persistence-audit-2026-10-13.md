# NOXIA NPC memory persistence — code audit (2026-10-13)

**Status:** PARTIAL CODE AUDIT + ISOLATED RETRIEVAL PROTOTYPE. No database inspection, test runner execution or production changes verified.

## Verified source paths
- `lib/game/cognition/npcRelationalMemory.ts`: NpcMemory has confidence, salience, traceId, fresh/consolidated/fading/forgotten states; consolidation and forgetting; reconstruction excludes forgotten traces.
- `lib/game/cognition/relationalWorldRuntime.ts`: vector clocks, parent provenance, independent-source checks and trace reconstruction.
- `lib/game/cognition/personEpistemicPersistence.ts`: `person_epistemic_traces` upsert with ID conflict handling; reconstruction by person/time; sleeping-person consolidation reads up to 512 recent rows across the supplied person list, then upserts `person_epistemic_consolidation`.
- `lib/game/knowledge/testimonyPersistence.ts`: confirmed dialogue creates reported observation, not agreement; uses existing epistemic table.
- `lib/game/knowledge/npcTestimony.ts`: validates conversation event and source trace; delivery does not mean belief.
- `lib/game/cognition/personAffect.ts`: event-driven affect and lazy time decay.
- `lib/game/cognition/personReflex.ts`: deterministic reflex gate.

## Risks requiring investigation
1. Consolidation query uses global `.limit(512)` after filtering multiple sleeping persons. It may omit traces for some persons or older relevant records. This is a **potential coverage risk**, not a demonstrated production incident. Measure distribution and query plan before changing pagination.
2. Reconstructing an entire person's trace history may cost O(N) in memory and time. Audit actual call sites, indexes, cache hit rates and query limits.
3. Event-time tie handling, contradictory evidence, replay idempotence and lineage must survive any compression.
4. Missing consent and visibility checks at a hypothetical retrieval boundary cannot be inferred safe from these isolated files; verify upstream authorization before integrating.
5. Distinguish observation, subjective memory, accepted belief and canonical world truth.

## New isolated research code
`lib/research/memory/epistemicRetrievalAudit.ts` and `.test.ts`: pure retrieval of synthetic or explicitly supplied rows, with person/subject/attribute/time filtering, bounded result count, provenance preservation and reproducible serialized-byte metrics. The `scanned` counter represents in-memory array length, **not database rows scanned or CPU time**. No production DB queries are added.

## Next gates
- Execute Vitest locally/CI and collect logs.
- Inspect DB schema/indexes and actual call sites.
- Reproduce 512-row consolidation coverage case using synthetic rows.
- Design per-person pagination/batching if coverage issue confirmed.
- Only then instrument read paths without increasing hot-path query count.
