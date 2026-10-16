# NOXIA Dream consolidation: verified implementation and CI review

Date: 2026-10-16. Documentation-only review; no merges or production changes.
Upstream request: `external-tasks/open/NOXIA-REQ-20261016-dream-model-consolidation.md`.

## Verified actual code

- PR #484 branch `claude/creative-from-452`: `lib/game/cognition/dreamRecombination.ts` exports `DreamAssociation` with `sourceMemoryIds`, `sourceTraceIds`, `sourcePatternKeys`, `motifs`, strength, novelty, `provenance: dream_recombination`, `canonical: false`. Pure deterministic generator `recombineDuringDream` only returns ephemeral candidates.
- PR #488 branch `feat/npc-dream-knowledge-prototype-20261016`: `lib/game/knowledge/dreamKnowledge.ts` independently defines `DreamEpisode` and `synthesizeNpcDream` with external `DreamSource` including `text`, `sourceUri`, `availableFromYear`. Sources are selected by stable hash, not topical matching; source prose is copied into motifs up to `maxTextLength` (default 180). In-world eligibility currently uses `availableFromYear <= worldYear` and `observedAtTick <= tick`, not world projection. It remains ephemeral, with no persistence in this module.
- No requirement to infer human nightmare causation from the in-game `distressScore` heuristic.

## Verified actual CI

- On PR #488 branch, `.github/workflows/npc-dream-checks.yml` uses `pnpm/action-setup@v4` version 10, `actions/setup-node@v4` Node 22 with pnpm cache, `pnpm install --frozen-lockfile`, manual `tsc` compilation of eight dream-related test entrypoints, eight node executions, and `pnpm run test:knowledge-transmission`.
- `.github/workflows/noxia-core-causality.yml` on main uses Node 24 and `npm run test:core-invariants` with path-filtered triggers, `contents: read`, timeout eight minutes.
- Vercel project uses Node 24. Alignment to Node 24 and a single package-manager policy needs an independent reviewed code change; the package manager chosen should be confirmed against existing lockfile and app scripts rather than assumed.
- GitHub comparison `main...feat/npc-dream-knowledge-prototype-20261016`: branch diverged, ahead 26 and behind 1, changes include 17 files. Verify final diff and rebase only after #486 and #483-#485 safely land.

## Exact integration gates

0. Review test evidence for #486 and stacked #483, #484, #485; update dependent bases after each merge. Never merge solely because Vercel preview succeeded.
1. Make cognition `DreamAssociation` authoritative. Migrate/adapt external-source metadata as additions; do not maintain a second subjective dream identity. Ensure downstream inquiry/decision/intent/admission/bridge code consumes the new type.
2. Rank relevant source candidates by overlap against abstract keys derived from selected memories/patterns. Stable hash only resolves ties; any context-free impulse must be explicitly marked and bounded. Test suitable > unsuitable under same tick/seed.
3. Replace prose-carrying motifs with abstract identifiers. Add regression checks for eight consecutive words copied from source text. Note that free-text memory values in `memoryMotifs` may themselves need a stricter semantic-key policy for consistent provenance.
4. Add an explicit distinction between projected in-world accessible knowledge and noncanonical inspiration; prevent unprojected modern real-world facts from entering canonical NPC epistemic state, regardless of publication date.
5. Connect existing sleep and relational-memory pathways, ensure retention limits and bounded later-tick behavior changes only for recalled dreams. Feature flag defaults off; review any schema changes separately.

## Additional risks

- The existing `DreamAssociation` uses text-valued motifs from remembered strings and feature values. A prohibition on source prose must not only patch `dreamKnowledge`; define a canonical motif-key normalization contract across both code paths.
- A successful standalone `tsc` or Node test is not enough to prove feature compatibility in `npc-conversation` or persistence. Specify integration tests at feature boundaries.
- Existing CI path filters enumerate prototype filenames; new files may go unchecked unless glob patterns and tests are revised.
- No code merge or DB migration was made in this audit.
