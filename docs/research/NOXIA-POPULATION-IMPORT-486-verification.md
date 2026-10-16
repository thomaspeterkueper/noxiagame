# Population import fix – CI verification record

Date: 2026-10-16
PR: #486.

The single code change replaces the TypeScript alias import of the Supabase service in `lib/game/npcEconomy.ts` with the equivalent relative import to permit standalone `tsc` compilation without tsconfig alias mapping.

Validation required before integration: Population domain workflow, relevant Core checks, and confirmation that no gameplay or database migration is included. The successful Core causality check on the previous SHA does not establish Population domain success.

This documentation commit requests a refreshed PR check run; results must be inspected and recorded before merging. No runtime or schema change is introduced by this file.
