# NOXIA agent infrastructure – Dream CI pilot verification

Date: 2026-10-16
PR: #490, head SHA `d631e111f156163e91e6099a3a66dfa03fb4d79b`.

## GitHub Actions evidence

Eight pull-request workflows have completed: seven successful and one failed.

| Workflow | Run ID | Outcome |
|---|---:|---|
| NPC dream prototype checks | 38863736891 | success |
| Population domain | 38863736957 | failure |
| Spatial domain | 38863737216 | success |
| Core contract | 38863736903 | success |
| Interior domain | 38863737019 | success |
| Transport domain | 38863736906 | success |
| World Development Contract | 38863736972 | success |
| Vehicle domain | 38863736923 | success |

Population job `116851697085` failed at 'Compile authoritative tick orchestration'. Job log shows `lib/game/npcEconomy.ts(1,37): error TS2307: Cannot find module '@/lib/supabase/service' or its corresponding type declarations.` Earlier population checks passed; subsequent invariant and build steps were skipped because of the failure.

The same import exists on PR #488's branch. PR #486 branch independently replaces it with `../supabase/service`, preserving module identity. A core-causality workflow passed on the head SHA of #486, but a full population test result for #486 has not been confirmed. Do not conflate a passing dream check with full integration success.

## Decision

- Keep #490 in draft and preserve strict PR scope (package.json + Dream CI workflow only).
- Validate #486 in the population workflow, then integrate it according to the existing request before rebasing the dream prototype.
- Review and rerun both dream and population suites on the *eventual combined commit*; individual green checks on separate branches cannot prove integration correctness.
- Do not merge #490 or perform migrations/production deploys from this audit.

## Next gate

The pilot has demonstrated source-sha and run-ID traceability, distinct passed/failed/skipped statuses, and effective detection of a cross-branch dependency. This is an actionable demonstration of NOXIA-AGENT-INFRA-0001's evidence contract.
