# NOXIA-LEGACY-0002: Standalone interactive journal

Status: initial implementation draft, 2026-11-03.

## Decision
Living Legacy is a standalone product domain, not a NOXIAGAME-only feature. Two clients share one opt-in, access-controlled domain service: (1) a private interactive life journal; (2) an in-world historical/evolving character when explicitly enabled. Game usage is optional.

## Core experiences
- Write an entry, record or transcribe a story, add a photograph caption, or run a guided interview.
- Explore a personal timeline, ask the journal questions, request a summary, review uncertain or contradictory recollections.
- Family invitation is optional: an invitee must accept, and access can be revoked. Entries are private by default; delegated editing does not imply permission to read every entry.
- The journal owner can separately approve eligible excerpts as legacy sources. Never treat importing, possessing or reading a document as authorization to publish it or train an in-game character.
- The guided interview must be supportive, never insist on disclosure, and allow skipping questions. Accessibility: large readable controls, minimal onboarding, save/continue later, voice-first mode where available.

## Architecture
Standalone client route (proposed): /legacy. API must authenticate the caller, enforce database RLS and authorization, and persist transcripts and media references in private storage. Pure journal rules live at lib/game/legacy/journal.ts initially; move them to an app-neutral package if a second deployment is introduced. A NOXIA NPC consumes only approved, provenance-tracked extracts through a controlled adapter, with separate historical/evolving identities.

## First family pilot
A private journal belongs to the participant, not to the inviting relative. Obtain informed opt-in from the participant, separately from family invitation and any NPC, voice-clone or posthumous consent. No automatic publishing, no game character, no voice cloning, no posthumous settings enabled by default. Review details of other persons before wider sharing.

## Shipping gates
1. Database schema, RLS and server-side checks for all journal operations.
2. Reliable private storage, data export/deletion, audit trail, and consent lifecycle.
3. Basic interactive journal UI, clear privacy controls, and accessibility checks.
4. Isolated beta test with explicit invitation; no public activation.
5. Then source review and optional NOXIA game adapter.
