# NOX-0007 — School: calc tasks never map to mathematics, and two fake SSF module IDs are hardcoded

## Target System
NOXIA

## Origin
Player-observed gap (2026-07-11): a simple addition/subtraction task in the School feature shows "Kein passendes SSF-Modul gefunden" - traced to the actual code, two separate issues found in the same file.

## Target File
`app/dashboard/SchoolOverlay.tsx`

## Reason

**1. `TOPIC_DOMAIN` never maps to mathematics.**

```ts
const TOPIC_DOMAIN: Record<string, string> = {
  'Handel': 'economics', 'Ressourcen': 'economics',
  'Navigation': 'physics', 'Physik': 'physics', 'Sonnensystem': 'physics',
  'Energie': 'physics', 'Bevölkerung': 'biology', 'Geschichte': 'history',
}
```

Calc tasks (`kind: 'calc'`) are pure arithmetic word problems - the skill being tested is calculation, not trade theory or physics. But their `topic` field comes from the same set used for quiz tasks ("Handel", "Ressourcen", etc. - see `route.ts`'s `topic` enum), and none of those map to a math domain. A calc task about "80 tons at 95 vs 155 Cr/t" gets `topic: "Handel"` -> `domain: "economics"` -> filtered against SSF modules that have nothing to do with economics. It was never going to find a match, regardless of what SSF has built.

**2. Two SSF module IDs are hardcoded directly in this file, never registered anywhere:**

```ts
{ id: 'LRN:SSF:ECO-L0-0001', name: 'Was ist Kredit?', ... }
{ id: 'LRN:SSF:ECO-L0-0002', name: 'Was ist Zinseszins?', requires: 'LRN:SSF:ECO-L0-0001', ... }
```

These look like real SSF modules (correct `LRN:SSF:` id format, plausible content, a `requires` chain) but do not exist in the Knowledge Graph or SSF's actual module export. This bypasses the whole KG/SSF pipeline this ecosystem is built around - the same "no repository invents another repository's canonical objects" rule `kueper-ecosystem`'s own `docs/repository-roles.md` states explicitly (`NOXIA darf PHY-L0-000001 verwenden, aber nicht definieren, was dieses Modul fachlich bedeutet` - defining two entirely new ones is further still).

The content itself (credit, compound interest) is genuinely reasonable and fits the MINT-plus economics gap already flagged elsewhere (`KG-0011`'s scope, `KG-REQ-20260710-che-1101-source-gap.md`'s reasoning about kueper-com as the source for this kind of content) - the problem is where it was defined, not that it exists.

## Requested Change

1. Add a mathematics mapping to `TOPIC_DOMAIN` (or, better, base the domain lookup on `task.kind === 'calc'` directly rather than only on `topic`, since a calc task's actual skill is arithmetic regardless of its trade-flavored topic label).

2. For the two hardcoded `LRN:SSF:ECO-L0-*` modules: either (a) submit them as a real `entity_request` to the Knowledge Graph so they become genuine, registered modules SSF can serve - the content is good enough to be worth keeping - or (b) remove them from this file until that happens. Either is fine; leaving them as-is, silently presented as real SSF modules, is not.

## Priority
High for item 1 (directly caused the observed player-facing gap). Medium for item 2 (not currently causing visible breakage, but is a real data-integrity issue - a player who "completes" `LRN:SSF:ECO-L0-0001` today is not actually completing anything the Knowledge Graph or SSF knows about).

## Blocking
Item 1 blocks `KG-REQ-20260711-mat-l0-arithmetic-content.md` (filed separately) from actually being reachable in-game even once that module has real content - the domain mapping has to route there first.

## Status
Open

## Created
2026-07-11

## Resolution (partial)

Item 1 (TOPIC_DOMAIN never mapped to mathematics) - fixed 2026-07-12, commit
f1352e9. `RightPanel` now routes any `kind: 'calc'` task to the mathematics
domain directly, before consulting `TOPIC_DOMAIN` at all - the topic label
("Handel", "Ressourcen", ...) no longer determines the domain for calc
tasks, since the actual skill tested is arithmetic regardless of the task's
trade framing.

Item 2 (hardcoded `LRN:SSF:ECO-L0-0001`/`0002`) - deliberately not touched.
`completedModules` is loaded from a persisted source (`data.map(r =>
r.module_id)`), meaning real players may already have completion records
keyed to these exact ids. Renaming the id namespace without knowing whether
that data exists risks silently orphaning real progress. Needs a decision
with visibility into the actual Supabase table before either renaming or
submitting these as a real `entity_request` - left open rather than guessed
at.
