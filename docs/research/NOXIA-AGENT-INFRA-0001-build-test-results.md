# NOXIA Agent Infra – Build-skip verification

Date: 2026-10-16. Phase 0 only, no production config or schema changes.

## Confirmed Vercel log evidence

The first preview build for `docs/agent-infra-0001` (commit `3d567d2`, deployment `dpl_HVdC1Lt2wxBiNdyYiPLRrw3BQkff`) executed `bash scripts/vercel-ignore-build.sh`, which printed `Kein Vergleichs-Commit bekannt: Build läuft.` Vercel then ran `vercel build`. The preview build was not an unexplained bypass: the first-build fallback was explicitly invoked.

## Reproducible local tests

A disposable local Git repository was initialized with a minimal copy of the existing script's decision logic and the *same* `git diff` exclusions. Five scenarios were run. Here `0` means Vercel should skip and `1` means build:

| Scenario | Exit code | Expected | Outcome |
|---|---:|---:|---|
| Previous SHA absent | 1 | Build | Pass |
| Previous SHA invalid | 1 | Build | Pass |
| Docs-only commit vs previous SHA | 0 | Skip | Pass |
| Code-only commit | 1 | Build | Pass |
| Mixed docs+code range | 1 | Build | Pass |

This validates the decision logic in a disposable simulation, not the complete Vercel runtime or all CI workflows. The full script's informational echo output and Vercel's integration were not end-to-end tested here.

## Decision and next actions

- Retain fail-open behavior when no comparable commit is present. Avoid silently skipping important code changes.
- Keep current production configuration unchanged during Phase 0.
- Review whether excluding `supabase/` and `.github/` from build triggering aligns with migration and CI policies. Migration deployment is *not* implied by a Vercel skip.
- Collect time-windowed build counts and billing/usage figures before claiming resource or cost savings.
- Do not independently merge draft PR #487 or any stacked NPC PRs without appropriate review.
