# Agent infrastructure pilot: dream-model consolidation coordination

Date: 2026-10-16
Reference: `external-tasks/open/NOXIA-REQ-20261016-dream-model-consolidation.md` on `main`.
Status: coordination note only; no NPC code, migration or deploy change.

## Dependency and ownership contract

1. Integration gate: independently verify PR #486 then PR #483, #484, #485 in their declared stacked order. Rebase/retarget and test after each step. No automatic merge based solely on a green unrelated check.
2. Model gate: `DreamAssociation` in `lib/game/cognition/dreamRecombination.ts` is the baseline; retire or adapt parallel `DreamEpisode` in the knowledge prototype, preserving provenance, distress and later inquiry/decision/intent/admission/bridge semantics.
3. Motif gate: rank eligible sources by overlap with selected memories or patterns; deterministic tie-breaking. Allow marked out-of-context impulses only under an explicit bounded rule.
4. Provenance gate: no source prose in persisted motifs, only source IDs and abstract motif keys; test against verbatim 8-word sequences.
5. Lore gate: real-world publications do not become in-world facts merely because their dates precede the NPC year. Require an in-world knowledge projection, or mark as noncanonical inspiration.
6. Persistence gate: integrate existing sleep, episodic and relational-memory paths; selective recall and bounded later-tick impact; feature default off. Any schema change requires separate migration review.
7. CI gate: compare `npc-dream-checks.yml` (reported Node 22/pnpm) with existing core guard (verified Node 24/npm) and Vercel Node 24. Confirm real workflow contents before changing. Prefer one `test:dreams` script and robust paths if tests validate the proposed change.

## Branch divergence confirmation

GitHub `compare main...docs/agent-infra-0001` returned status `diverged`, branch ahead by 7 commits and behind by 2, with merge base `583f76f2ca06dd3c2b7d03112c7a0ff61cbf1d8e`. The branch-only changes are seven added architecture/audit documents; the two main-only changes are added dream-related external task requests. No overlapping changed paths were present in that comparison. The branch **does** have a common ancestor; an ordinary merge is not evidenced to delete either newly added request. Final diff/merge readiness must still be checked after updating the branch.

## Pilot acceptance evidence

For each stage record input SHA, changed paths, owner, tests and their run identifiers, conflict report, provenance constraints, observed effect and reason for any skip. Preserve the user's stated sequencing and do not launch live-web NPC fetches or additional persistence paths.

## Next action

Align task ownership and CI in a reviewable branch, then coordinate a safe integration of the existing stacked PRs before implementing the dream changes. This note does not authorize merging or production migration.
