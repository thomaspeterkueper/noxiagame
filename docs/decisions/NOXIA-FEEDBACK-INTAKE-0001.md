# NOXIA Feedback Intake 0001 — authenticated persistence contract (draft)

Status: proposed; **not deployed**. Scope: direct player feedback and explicitly submitted NPC-conversation proposals.

## Verified prerequisite (2026-10-31)
Read-only inspection of the public Supabase schema found **no** table whose name contains `feedback` or `proposal`. Therefore the existing local feedback draft UI must not claim successful submission. No production schema change is authorized by this document.

## Submission contract
- POST `/api/game/feedback` requires a valid server-verified Supabase user, body validated with `validateFeedback`, bounded request size, and server-enforced rate limiting.
- For direct feedback, source kind `direct`. For conversation feedback, the server must resolve `npc_conversation_log:<id>` using the authenticated player's mapped profile, verify ownership, and only then call `prepareFeedbackSubmission(..., {kind:'conversation', sourceRef, ownerVerified:true})`. Never trust client-supplied `ownerVerified`.
- Require an idempotency key bound to owner and payload. Generate UUID, owner ID, creation time, and initial `submitted_for_review` status server-side. Reject duplicate/conflicting keys deterministically.
- Store private provenance separately from any publishable text. Client location hints are **unverified**. Public visibility requires explicit consent and human moderation; consent is not publication.
- GET `/api/game/feedback` lists only the authenticated owner's submissions and statuses. Never expose private NPC transcripts or another player's submissions.
- No feedback endpoint can emit Core events, alter parcels, grant ownership, approve civic initiatives, or execute engineering tasks.

## Review status contract (implemented as pure logic, not yet persisted)
The status lifecycle in `lib/game/evolution/feedbackReviewStatus.ts` is `submitted_for_review` → `under_review` → `needs_information` / `accepted_for_planning` / `declined` / `closed`. `needs_information` can return to `under_review`; `accepted_for_planning` can close. `declined` and `closed` are terminal. Status transitions are **not** permission checks: only an authenticated, audited moderation service may write status changes. Even `accepted_for_planning` is neither a civic approval nor permission to change the world. Unknown status values fail closed.

## Required persistence and security review
Proposed relation `player_feedback_submissions`: `id uuid`, `owner_user_id uuid`, `category`, `title`, `description`, `location_hint`, `requested_visibility`, `publication_consent`, `source_kind`, `private_source_ref`, `status`, `created_at`, `updated_at`, `idempotency_key`. Enforce field lengths/check constraints, uniqueness `(owner_user_id,idempotency_key)`, indexes for owner + created_at. Decide whether owner should be auth.uid or mapped profile **before** migration.

Enable RLS, with SELECT/INSERT restricted to authenticated owner; never allow client UPDATE of status or owner. Service-side moderation must have separate, audited authorization. Verify Data API grants independently of RLS. Add rate limiting, retention policy, privacy review and server-side moderation before live intake.

## Acceptance tests
1. Unauthenticated POST/GET rejected.
2. Player A cannot read or submit as Player B; spoofed conversation ID rejected.
3. Duplicate key yields same receipt; conflicting payload rejected.
4. Public intent without explicit consent rejected; private provenance never appears in public projections.
5. Oversize/invalid input rejected; rate limiting enforced.
6. Submitted feedback is review-only; no world state mutation.
7. Full Next.js build, RLS integration, browser test and CI green.

## Delivery order
1. Approve ownership model and migration design; create versioned migration in repository (no production apply).
2. Implement authenticated API and server-side conversation ownership verification against approved schema.
3. Add persistent status list in /earth/feedback and integrate #578's conversation drafts.
4. Review and merge/deploy separately, only with explicit authorization.
