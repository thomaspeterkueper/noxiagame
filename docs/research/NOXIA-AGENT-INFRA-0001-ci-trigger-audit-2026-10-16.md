# NOXIA-AGENT-INFRA-0001 – CI trigger audit and phase-1 pilot specification

Date: 2026-10-16
Status: Phase-0 partial inventory, no runtime/configuration changes
Source: current `main` workflow and coordination template as read by GitHub connector

## Confirmed workflow details

Path: `.github/workflows/noxia-core-causality.yml`
Name: `NOXIA core causality guard`

- `pull_request` runs are path-filtered for `lib/game/**`, `lib/world/**`, `scripts/check-core-*.mjs`, a physics architecture decision, and the workflow file itself.
- `push` runs on `main` are likewise path-filtered for game/world code, core scripts and its workflow file.
- Manual `workflow_dispatch` exists.
- Explicit permissions: `contents: read`.
- Job `core-invariants`: `ubuntu-latest`, Node 24, `npm run test:core-invariants`, 8-minute timeout.
- Concurrency group keyed to GitHub ref, `cancel-in-progress: true`.
- A prior workflow run for PR #486 completed successfully; this does not establish broader test coverage.

**Important limitation:** Because the workflow is path-filtered, its check may not be created for documentation-only, migrations-only, or unrelated app-path PRs. Do not simply make this check universally required without first adjusting check generation; pending/missing checks can block merges.

## Existing coordination template

`coordination/TASK-TEMPLATE.md` provides title, source/target area, status, priority, claimed owner, dependencies, touched paths, acceptance criteria and result references. It does not yet require immutable input SHA, restricted write scope, risk class, proof for schema changes, or an evidence timestamp. Extend compatibly instead of replacing the existing task model.

## Workflow catalog limitations

The connector exposes workflow runs and can fetch workflow files by exact path, but the audit has not yet verified a complete repository directory listing of `.github/workflows/`, nor current GitHub branch rulesets/protection. Thus no claim of complete CI inventory or migration-specific CI coverage is made. Several guessed workflow paths returned 404, which is not proof that the capability is absent.

## Pilot specification: safe agent task review

Create a **documentation-only** example task on `docs/agent-infra-0001`, referencing this proposal and `coordination/TASK-TEMPLATE.md`.

Required evidence fields for the eventual template extension:

1. `input_sha`: exact parent commit used when preparing the change.
2. `owner_area` and `write_scope`: concrete directories/files that the agent is allowed to modify.
3. `read_scope`: code and data required for the task.
4. `depends_on`: branch/PR dependencies, with conflicts documented.
5. `risk_class`: documentation, code, migration, runtime data, production.
6. `test_evidence`: command, workflow run ID, SHA, status and timestamp.
7. `db_evidence`: migration files, environment, rollback/forward-repair plan and explicit approval.
8. `deployment_evidence`: environment, deployed SHA, deployment status and health check.
9. `resource_baseline`: measured duration/usage/cost source where available; otherwise `not measured`.
10. `excluded_actions`: prohibited operations including production changes or direct merging.

### Acceptance gates

- A task cannot be called completed with tests merely asserted; exact provenance is needed.
- An absent check, skipped check, failed check and passed check are four different outcomes.
- Docs-only changes must not be confused with schema validation.
- No further tooling/server purchases without measurable benefit.
- Production changes and branch merges require separate approval.

## Next pending evidence

- Enumerate all actual workflows and branch protection via an interface with directory/rules access.
- Establish time-windowed Vercel/GitHub consumption metrics.
- Check migration-specific CI; if absent, propose a *separate* minimal PR to add it.
- Review the pilot task and promote Phase 0 only after risk and baseline criteria are documented.
