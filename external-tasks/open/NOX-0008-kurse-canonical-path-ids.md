# NOX-0008 — Kurse: migrate kurs_id to canonical PATH:SSF:*/PATH:NOXIA:* IDs

## Target System
NOXIA

## Origin
Live gap observed 2026-07-11: a "Sonnensystem" quiz task showed "Kurs nicht gefunden" - traced to `foundation_kurse.kurs_id` being a local, NOXIA-only slug with no connection to the Knowledge Graph's canonical learning-path schema, which already covers this exact case.

## Target Files
`app/api/game/kurse/route.ts`, `app/dashboard/KursRenderer.tsx`, whatever maps a School task's `topic` to a `kurs_id` (not found in current `main` - see note below)

## Reason

The Knowledge Graph already resolved this exact need on 2026-07-08 (`KG-0002`, `exports/kxf-learning-paths-0.1.json`, `records.learning_paths`) - 12 real path records exist, including ones that map directly onto content NOXIA is already trying to serve:

```text
PATH:SSF:AST-PLANET-STRUCTURE-0001      "Planetare Struktur verstehen"
PATH:SSF:MAT-FOUNDATIONS-0001            "Mathematische Grundlagen (L0->L1)"
PATH:NOXIA:GEN-MARS:SCIENCE-FOUNDATION   registered specifically for NOXIA
```

`foundation_kurse.kurs_id` in NOXIA's own Supabase is a separate, local identifier space - not these canonical ids. That mismatch is why a lookup by topic finds nothing: even if a `foundation_kurse` row exists for "Sonnensystem" content, it was never given an id the Knowledge Graph would recognize, and vice versa.

## Requested Change

1. Add a `kg_path_id` column (or repurpose `kurs_id` directly) on `foundation_kurse` storing the canonical `PATH:SSF:*` / `PATH:NOXIA:*` id.

2. Update the School task's topic-to-course lookup to resolve against these canonical ids rather than local slugs - "Sonnensystem" should resolve toward `PATH:SSF:AST-PLANET-STRUCTURE-0001`, arithmetic-flavoured tasks toward `PATH:SSF:MAT-FOUNDATIONS-0001`.

3. Slide content (`foundation_folien`) can stay in NOXIA's own Supabase for now - a separate request (`KG-REQ-20260711-learning-path-slides-schema.md`, filed today) proposes bringing this into the canonical schema too, using NOXIA's existing eight-slide-type design as the reference. Not blocking this migration - the id-mapping fix can land first, content-hosting location can follow.

## Note on the deployment mismatch found during this investigation

`KursRenderer.tsx` and `app/api/game/kurse/route.ts` are not imported anywhere in the current `main` branch's `app/dashboard` files, yet the live site shows `KursRenderer`'s exact error text and UI strings not present in the current `SchoolOverlay.tsx` (e.g. "max. 10 Aufgaben/Stunde" doesn't exist in current `main`). This strongly suggests `noxiagame.vercel.app` is serving a build that predates the current `main` HEAD. Worth checking the Vercel deployment's actual commit before doing this migration, since the live topic-to-course wiring code that actually needs fixing may not be visible in the git history reachable from here.

## Priority
High

## Blocking
This is very likely the direct cause of the "Kurs nicht gefunden" gap reported live.

## Status
Open

## Created
2026-07-11
