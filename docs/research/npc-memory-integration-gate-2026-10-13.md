# NOXIA memory integration gate — 2026-10-13

Status: actionable plan, no production change.

## Verified facts
The live NOXIA Supabase public schema has npc_player_conversation_memory, with unique key (npc_person_id, player_profile_id) and time-based indexes for NPC and player. The public tables person_epistemic_traces and person_epistemic_consolidation were not found on the connected database. Research source personEpistemicPersistence.ts references those absent tables. Therefore do not assume the experimental epistemic pipeline is currently deployed.

## Next actions in order
1. Trace all production call sites of npc_player_conversation_memory and epistemic persistence. Classify reads/writes and authorization boundaries; do not infer deployed usage from file presence.
2. Inspect migration history and schema for any proposed epistemic tables. Confirm whether migrations are unapplied, superseded, or intentionally experimental. Do not create parallel production tables automatically.
3. Test actual conversation-memory behavior for two different players and two NPCs, including reload, conversation continuation, and access isolation; use non-sensitive test accounts.
4. Verify indexes and query plans against measured cardinality, query latency and payload bytes; avoid extra hot-path queries.
5. If epistemic persistence is to be deployed, design migration and backfill separately, with RLS/permissions, retention/deletion, observability, idempotence and rollback plan.
6. Address shared 512-row sleep consolidation cap only after deployment and call-path checks; the synthetic starvation test is not a production incident.

## Release gates
No player/NPC cross-visibility; no loss of existing dialogue memory; no increase in database request rate without quantified benefit; rollback tested; migrations reviewed; baseline and post-change measurements captured.

## Current verification limits
Live Supabase metadata queries for additional details were blocked by tool security checks. Do not claim counts, timings, or schema beyond verified facts. No live changes authorized by this document.
