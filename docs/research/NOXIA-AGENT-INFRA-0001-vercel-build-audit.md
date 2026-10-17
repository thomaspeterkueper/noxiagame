# NOXIA-AGENT-INFRA-0001 – Vercel build audit

Checked 2026-10-16. Read-only evaluation; no deployment or configuration changes.

## Verified

- The root `vercel.json` contains `ignoreCommand: bash scripts/vercel-ignore-build.sh`.
- The same configuration already disables automatic Git deployments for `claude/*` branches.
- The existing ignore script compares the current checkout against `VERCEL_GIT_PREVIOUS_SHA`, which it describes as the previous successfully built commit of that branch.
- If the environment variable is empty, or the corresponding commit is absent from the checkout, the script deliberately allows a build (fail open for deployment).
- If the diff contains no build-relevant paths, the script exits zero, signaling that Vercel should skip the build. It excludes documentation, coordination, GitHub workflows and several other directories from its diff.
- Vercel reported a READY preview deployment for `docs/agent-infra-0001`; its existence alone does not establish why skipping did not occur. It may have been a first-build or missing-base-commit case, but build logs must confirm this.
- Vercel project `noxiagame` is configured for Next.js and Node.js 24.x. Its project inspection showed a recent preview build in progress at the time of inspection.

## Risks and proposed validation

1. Run controlled tests of the ignore script against a docs-only change, a code change, and a mixed code/docs history, *in a disposable or local Git checkout*. Confirm skip/build exit codes; do not change the existing script based on assumptions.
2. Specifically verify whether migration-only and workflow-only changes should bypass Vercel builds given NOXIA's real delivery model. A skipped build must never be mistaken for a successfully applied migration.
3. Inspect a relevant Vercel deployment's build events for the ignored-build decision and a comparison SHA before adjusting the script. Do not attribute savings or root cause without logs.
4. Track preview deployment counts and build-duration distributions for a fixed time window, then compare against Git change types.
5. Keep production/deployment settings unchanged during Phase 0. Any adjustment requires separate reviewed change and regression tests.

## Conclusion

Existing build-skip logic means the first optimization is *validation and observability*, not installing a new tool or duplicating configuration. No proved incremental savings yet.
