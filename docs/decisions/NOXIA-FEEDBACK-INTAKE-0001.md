# NOXIA Feedback Intake 0001 — authenticated persistence contract (draft)

Status: proposed; **not deployed**. A versioned, **unapplied** schema migration now exists at `supabase/migrations/20261031080000_player_feedback_submissions.sql`. Scope: direct player feedback and explicitly submitted NPC-conversation proposals.

## Verified prerequisite (2026-10-31)
Read-only inspection of the public Supabase schema found **no** table whose name contains `feedback` or `proposal`. Therefore the existing local feedback draft UI must not claim successful submission. No production schema change is authorized by this document.

## Submission contract
- POST `/api/game/feedback` requires a valid server-verified Supabase user, body validated with `validateFeedback`, bounded request size, and server-enforced rate limiting.
- For direct feedback, source kind `direct`. For conversation feedback, the server must resolve `npc_conversation_log:<id>` using the authenticated player's mapped profile, verify ownership, and only then call `prepareFeedbackSubmission(..., {kind:'conversation', sourceRef, ownerVerified:true})`. Never trust client-supplied `ownerVerified`.
- Require an idempotency key bound to owner and payload. Generate UUID, owner ID, creation time, and initial `submitted_for_review` status server-side. Reject duplicate/conflicting keys deterministically.
- Store private provenance separately from any publishable text. Client location hints are **unverified**. Public visibility requires explicit consent and human moderation; consent is not publication.
- GET `/api/game/feedback` lists only the authenticated owner's submissions and statuses. Never expose private NPC transcripts or another player's submissions.
- No feedback endpoint can emit Core events, alter parcels, grant ownership, approve civic initiatives, or execute engineering tasks.

## Read-only receipt endpoint (staged, not deployed)
A GET-only endpoint now exists at `app/api/game/feedback/route.ts`. It requires a verified Bearer JWT and uses a fresh Supabase client with the **anon key plus caller JWT**, never the service-role client, to select only `id,title,status,created_at`. Owner isolation is enforced by the staged table's `auth.uid()` RLS policy; the caller does not receive SELECT privilege on `owner_user_id`, so the query must not filter on that private column. Results are limited to 1–50, projected through the private-field-stripping receipt contract and returned with `Cache-Control: private, no-store`. Invalid limits return 400, unauthenticated calls 401, missing schema or database errors 503; the route does not insert or mutate world state. The CI guard for this route is **static** and cannot prove runtime JWT isolation. Before release: execute the migration in an isolated environment, test two distinct authenticated accounts, verify the full Next.js build, and then separately authorize deployment. There is **no POST endpoint yet**, and the draft form still cannot submit feedback.

## Review status contract (implemented as pure logic, not yet persisted)
The status lifecycle in `lib/game/evolution/feedbackReviewStatus.ts` is `submitted_for_review` → `under_review` → `needs_information` / `accepted_for_planning` / `declined` / `closed`. `needs_information` can return to `under_review`; `accepted_for_planning` can close. `declined` and `closed` are terminal. Status transitions are **not** permission checks: only an authenticated, audited moderation service may write status changes. Even `accepted_for_planning` is neither a civic approval nor permission to change the world. Unknown status values fail closed.

## Required persistence and security review
Proposed relation `player_feedback_submissions`: `id uuid`, `owner_user_id uuid`, `category`, `title`, `description`, `location_hint`, `requested_visibility`, `publication_consent`, `source_kind`, `private_source_ref`, `status`, `created_at`, `updated_at`, `idempotency_key`, `payload_fingerprint`. The staged migration binds `owner_user_id` to the verified Supabase Auth UUID (`auth.uid()`), not to a client-supplied profile ID. It enforces field lengths/check constraints, uniqueness `(owner_user_id,idempotency_key)` and an owner/creation-time index.

RLS is enabled in the staged migration. Authenticated clients get **SELECT on receipt columns only** (`id`, `title`, `status`, `created_at`), with an owner-only RLS policy; anonymous clients have no grants. INSERT/UPDATE/DELETE are **service-role only**, never direct client writes, so clients cannot spoof owner, provenance or status. Service-side moderation still needs separate, audited authorization and transition enforcement. Verify Data API grants independently of RLS. Add rate limiting, retention policy, privacy review and server-side moderation before live intake. A read-only metadata test exists at `supabase/tests/player_feedback_submissions.test.sql`; the CI smoke check at `scripts/test-player-feedback-migration.cjs` checks text invariants only and does **not** execute SQL or prove JWT/RLS isolation.

## Acceptance tests
1. Unauthenticated POST/GET rejected.
2. Player A cannot read or submit as Player B; spoofed conversation ID rejected.
3. Duplicate key yields same receipt; conflicting payload rejected.
4. Public intent without explicit consent rejected; private provenance never appears in public projections.
5. Oversize/invalid input rejected; rate limiting enforced.
6. Submitted feedback is review-only; no world state mutation.
7. Full Next.js build, RLS integration, browser test and CI green.

## Delivery order
1. **Staged for review:** Auth UUID ownership model and versioned migration in repository (no production apply). Review with a database/security owner and run isolated SQL + two-user RLS tests before authorization.
2. **Read-only GET staged** with caller JWT + RLS and private receipts. Still implement POST with bounded input, rate limiting, idempotency and server-side conversation ownership verification against the approved schema.
3. Add persistent status list in /earth/feedback and integrate #578's conversation drafts.
4. Review and merge/deploy separately, only with explicit authorization.

## Existing NPC wish processing is not an explicit feedback inbox
`supabase/migrations/20261029110000_player_feature_wishes.sql` already provides aggregated NPC conversation-derived *feature wishes* for internal review. That existing pipeline does not authenticate or persist an explicit player's submitted feedback receipt. Do not merge private NPC wish examples into public feedback or treat their recommendations as civic votes. The new table stores only explicit submissions, with separate private provenance and a distinct moderation lifecycle.
