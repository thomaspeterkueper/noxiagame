# NOXIA-AGENT-INFRA-0001 – CI and migration safeguards

Status: Phase-0 evidence and pilot proposal
Date: 2026-10-16
Scope: documentation-only; no runtime, database, CI or Vercel settings changed.

## Confirmed findings

- The GitHub Actions workflow run `38726813250` for commit `13d3139623d4028901be50622545a949398f01da` completed successfully.
- The workflow is named `NOXIA core causality guard`; job `core-invariants` completed successfully. Visible steps: checkout, Node 24, existing core invariants.
- This is evidence that an independent GitHub Actions check ran for this commit. It is **not** evidence that all NPC population, database migration or deployment checks passed.
- `vercel.json` configures `scripts/vercel-ignore-build.sh`. Its excluded paths include `.github` and `supabase`. Thus a change confined to CI configuration or migrations can be eligible for a skipped Vercel build when a suitable previous commit is available.
- The Vercel build logs of deployment `dpl_HVdC1Lt2wxBiNdyYiPLRrw3BQkff` confirmed the first-preview fallback `Kein Vergleichs-Commit bekannt: Build läuft.`, rather than any failure to call the script.

## Required proof boundaries

1. **Code tested:** record the exact commit SHA, test command/workflow, conclusion and timestamp.
2. **Migration checked:** identify migration files, schema effects, required roles/RLS, rollback or forward-repair strategy, independent validation and the actual environment. A Git diff or skipped build cannot stand in for database application evidence.
3. **Deployment successful:** record deployed SHA, target (preview/production), resulting deployment status and health verification; do not infer production success from preview readiness.

## Proposed phase-1 guardrails

- Add path-sensitive PR checks for `supabase/migrations/**` that run independently from Vercel preview skipping.
- Validate migration filename/order, syntax where feasible, dependencies, and high-risk DDL/RLS/security policies before allowing integration. Avoid running production migrations from untrusted PR contexts.
- Keep core-invariant checks mandatory for game-state/tick/economy/ownership changes.
- Keep documentation-only PRs eligible for lightweight checks, without weakening critical change safeguards.
- Verify actual branch protection and full workflow catalog before designating any check as mandatory.
- Record CI run IDs and source SHA in the agent task contract; failed and missing checks must not be conflated.

## Unverified / deferred

- The full list of workflow files, branch protection rules and mandatory checks has not yet been enumerated.
- No successful migration-specific CI run has been verified during this audit.
- Cost per build, GitHub Actions minutes and deployment duration baseline have not been measured.
- No claims of savings or overall CI coverage are justified yet.

## Recommended next practical pilot

A documentation-only PR-level evidence checklist first, then a separate narrowly scoped code PR for automated path-sensitive checks once the exact existing CI patterns and deployment responsibilities are verified. Do not merge the draft architecture PR without its normal review.
