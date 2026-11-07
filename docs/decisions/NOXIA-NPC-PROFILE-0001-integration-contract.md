# NPC profile integration — staged contract

Status: Draft, no production migration.

## Source of truth
- `people.id` is the stable identity. The existing Population Core owns writes and ticks; no parallel NPC store.
- `people.traits` is read by the current population engine. Verify the live migration introducing this column before wiring any write path.
- Named persons retain `personBrain` decision ownership, unnamed persons use the population decision engine (NOXIA-LIVING-0005).
- Existing traits and literary canon bindings must never be overwritten by an astrology-derived seed.

## Proposed safe creation flow
1. Assign the person ID and world seed in the authorized person-creation transaction.
2. Read persisted personality traits; if they exist, preserve them unchanged.
3. If absent, compute `narrativeTraitBaseline` as a **fictional author-design default**. Missing birth facts stay unknown.
4. Submit traits as a conditional create-only Core write, with transactionally enforced idempotency and audit provenance. This step **is not implemented** in PR #582.
5. Only an authorized, persisted experience event may propose a bounded trait delta; `proposeExperiencedTraitChange` does **not** write, deduplicate, or validate event authority.
6. Re-read persisted facts for profile projections; never derive world truth from rumours, self reports, or LLM text.

## Confidentiality and science
- Cultural-DNA templates, authored archetypes and private notes stay internal; public NPC profiles display only approved facts.
- Astrology is narrative character design, not empirical causation, immutable destiny, or a rule for cultural stereotyping.
- Health, physiology, personal memories, and relationships need explicit access controls at the API, not only client-side projection.

## Review gates
- Confirm actual `people.traits` schema, create path and role-based access.
- Verify CI and direct tests.
- Add database transaction tests for concurrent create, replayed event IDs, restart/persistence, and access control.
- Only then connect to NPC Observatory. Do not merge or deploy until checks pass.
