# NOXIA Feedback Integration Gate 0002

Status: BLOCKED until disposable DB test. Applies to PR #544 and #578. No deploy or migration authorization.

Identity invariant: verify in actual schema that npc_conversation_log.player_profile_id is the same Supabase Auth UUID returned by verifiedBearerUserId(req). If it is a separate profile FK, require a server-side mapping. Never accept owner IDs from the browser. The static identity test cannot prove database identity.

Two-user local Supabase acceptance matrix (A and B):
- A referencing own conversation: 201, review-only receipt, private source not returned.
- A referencing B's conversation and vice versa: 422, no inserted row or existence oracle.
- Missing conversation: same generic rejection.
- Client-supplied ownerVerified: reject 400.
- Same idempotency key and payload: original receipt, one row.
- Same key with different source or payload: 409, one row.
- Parallel same-key requests: one row, consistent receipt.
- More than five new submissions per hour: 429; old-key replay remains available.
- A and B can read only own receipt fields, not descriptions, owner IDs or private provenance.
- Authenticated direct SQL insert/update/delete denied.
- Every accepted row stays submitted_for_review; no civic vote, approval or Core event.

Run tests only on a disposable local database with real conversation fixtures and two confirmed users; clean up on success and failure. The existing local RLS harness covers direct feedback only and must be extended. Then run combined TypeScript/Next.js build, browser interaction and privacy review. Keep branches separate until conflict resolution and human migration review. No automatic merge, deploy, production DB migration or world write.

## Schema verification (2026-11-01, read-only)

Verified against connected NOXIA Supabase project using information_schema and pg_constraint, without reading conversation content or modifying data:
- public.npc_conversation_log.id is bigint PK.
- public.npc_conversation_log.player_profile_id is NOT NULL uuid, FK REFERENCES auth.users(id) ON DELETE CASCADE.
- public.profiles.id is uuid, FK REFERENCES auth.users(id) ON DELETE CASCADE.
- Conversation hint columns wish_kind, wish_object, wish_npc_denied, opening and outcome exist.

Therefore the direct verifiedBearerUserId-to-player_profile_id comparison matches the deployed schema. The **schema identity blocker is resolved**, but local two-user ownership/HTTP/RLS tests and combined UI build are still outstanding. This read-only schema inspection is NOT a production migration or integration-test success.

## Deployment observation (2026-11-01, read-only)

Production schema: npc_conversation_log has an identity bigint id and RLS enabled. The feedback table player_feedback_submissions is not present in the connected NOXIA production database. This is expected for an unapplied staged migration and means production HTTP feedback POST cannot be acceptance-tested yet. The local disposable database must include both the conversation schema and reviewed feedback migration. Never apply the migration merely to satisfy a test.

The last committed local harness invokes the production provenance verifier after creating two conversation fixtures. Existing GitHub static CI passing does not execute that harness or validate production data access. Do not mark integration complete until the local harness and combined build actually run.
