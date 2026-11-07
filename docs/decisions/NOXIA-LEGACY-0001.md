# NOXIA-LEGACY-0001: Hybrid Identity

Status: draft (2026-11-03)

## Decision
Historical Self is a versioned, source-based reconstruction. Evolving Self is a separate autonomous NPC simulation. The evolving NPC must never write to the historical archive. Both must be identified to players as AI representations.

## Consent
Separate permissions for archive, conversation, autonomous participation and posthumous access. A manuscript or personal record is not public by default. Revocation must disable reads, caches, embeddings and agent activity. Human review is required before publicly importing material about others.

## First milestone
Introduce typed identity contracts, source approval filters, provenance-bound historical snapshots, evolving-memory isolation and automated tests. No public pilot, production migration or posthumous behavior is enabled in this milestone.

## Source discovery
Candidate title from Google Drive: Die Ohnmacht des Propheten. Additional candidate: Thomas_Peter_Kueper_Biografie.docx. These are discovery pointers only; no manuscript contents are imported.

## Next
Review current NPC persistence and authorization. Add Supabase migration, RLS and consent administration; connect the evolving instance to existing NPC cognition and testimony. Then build a private opt-in preview and source review UI.
