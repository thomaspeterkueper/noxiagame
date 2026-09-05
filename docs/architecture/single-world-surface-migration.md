# Single World Surface — Migration and cleanup map

**Date:** 2026-09-05  
**Status:** Active migration plan  
**Decision:** `docs/decisions/ADR-single-world-surface.md`

## Goal

Consolidate the colony/world experience into one World Surface with shared world state, camera, selection and interactions. `topdown` and `isometric` are projections of that one surface, not separate maps.

Cleanup is performed alongside migration. A file is deleted only when its unique behavior has either moved to the canonical path or has been confirmed obsolete.

## Current generations

### A. Legacy tile surface

`app/dashboard/ColonyGrid.tsx`

Owns the 32×24 renderer, grid pan/zoom, tile-based placement UI, overlays, an extra `WalkableColony` entry path and a separate `interiorEntity` flow.

**Disposition:** MIGRATE, THEN DELETE.

Extract or replace:
- top-down presentation,
- build selection/placement interactions,
- scanner-focus navigation,
- relevant building action dispatch.

Do not preserve its ownership of a second world surface, `showWalking`, or its separate interior flow.

### B. Primary walkable/isometric surface

`app/dashboard/DashboardPrimaryColony.tsx`  
`app/dashboard/WalkableColony.tsx`

Already acts as the primary playable colony surface and uses the state/runtime boundary established in the architecture ADRs.

**Disposition:** REFACTOR INTO CANONICAL WORLD SURFACE.

`WalkableColony` should become an isometric projection/interaction renderer over shared spatial state rather than an independent world owner.

### C. Metric spatial prototype

`app/dashboard/spatial-build-test/page.tsx`

Contains useful continuous-coordinate camera and build-placement behavior but is a standalone third map.

**Disposition:** CANNIBALIZE, THEN DELETE.

Keep/reuse concepts:
- metric world-space pan/zoom,
- pointer-to-world coordinate conversion,
- footprint display,
- spatial build API integration.

Do not promote this route into a second production UI.

## Keep as core

- `app/api/game/build/spatial/route.ts` — server-authoritative metric build boundary.
- `lib/game/spatial/geometry.ts` — reusable collision/geometry domain logic.
- `lib/game/spatial/geometry.test.ts` — geometry regression tests.
- `lib/game/spatial/footprints.ts` — canonical building footprint data/helper.
- `lib/game/spatial/types.ts` — spatial domain types where still applicable.
- `supabase/migrations/20260905063200_spatial_build_model.sql` — applied schema history and forward spatial model.
- `app/dashboard/BuildingInterior.tsx` — intended central interior dispatcher.
- `app/dashboard/ScannerMicroScene.tsx` — valid specialized scanner interior.
- `app/dashboard/ColonyConversationLayer.tsx` — candidate shared world overlay, subject to normal refactor.
- persistent simulation/runtime stores and server APIs already covered by the state/runtime ADR.

Applied migrations are not cleanup candidates merely because an old UI is removed.

## Refactor

### `app/dashboard/DashboardClient.tsx`

Current problem: global dashboard shell plus a second colony renderer/data path. It fetches world/build data separately and renders `ColonyGrid` for ordinary colonies.

Target: global chrome, travel, social, market, ship and cross-cutting overlays. The canonical World Surface is mounted explicitly once.

### `app/dashboard/DashboardPrimaryColony.tsx`

Target: evolve into `WorldSurface` host or be replaced by one. It should own/coordinate shared projection, camera, selection and world overlays, not encode `planning` versus `colony` as separate worlds.

### `lib/store/gameModeStore.ts`

Current model mixes projection with spatial context:
`colony | planning | interior`.

Target separation:
- spatial context, e.g. `world | interior`,
- projection, e.g. `topdown | isometric`,
- shared camera/selection state in a suitable world-surface store.

Do not perform this split until current consumers are mapped.

### `app/dashboard/page.tsx`

Current file contains many CSS selectors coupled to incidental DashboardClient child order (`nth-child`, `:has`, `.grid-pan-container`).

Target: explicit component composition and component-owned styling. Delete structural selector hacks as their target legacy structures are removed.

### `app/dashboard/BuildingInterior.tsx`

Target: become the only building-interior dispatcher reached from the World Surface. Before legacy ColonyGrid interior state is removed, wire the primary path through this dispatcher so ScannerMicroScene and other valid interiors remain reachable.

## Safe delete now

### `app/dashboard/DashboardQuickChrome.tsx`

This component is now only a wrapper around `DashboardPrimaryColony` and has no remaining behavior.

Action:
1. import/render `DashboardPrimaryColony` directly from `app/dashboard/page.tsx`,
2. delete `DashboardQuickChrome.tsx`.

## Delete after migration

- `app/dashboard/spatial-build-test/page.tsx` — after its useful metric camera/build behavior is integrated.
- `app/dashboard/ColonyGrid.tsx` — after top-down/build/interaction behavior is migrated.
- grid-only helpers/assets under `lib/grid/*` only after import/reference audit confirms they are no longer used elsewhere.
- `LegacyBuildingInterior.tsx` only after every behavior still required by production has a canonical interior implementation or dispatcher path.
- old dashboard CSS rules tied to `.grid-pan-container` and incidental DOM order as soon as their consumers disappear.

## Must not delete yet

- `ColonyGrid.tsx`: scanner interior access and current production build UI still depend on it.
- `spatial-build-test/page.tsx`: currently the clearest working reference implementation of metric pan/zoom and metric build placement.
- `BuildingInterior.tsx` / `ScannerMicroScene.tsx`: unique functionality.
- spatial API/library/schema: these are the preferred forward spatial foundation, not obsolete prototype remnants.

## Implementation sequence

1. Remove the now-empty `DashboardQuickChrome` wrapper.
2. Introduce shared World Surface state types: projection, metric camera/focus, selection, layers.
3. Build one host around the existing metric spatial read model; do not create a new standalone route.
4. Move top-down rendering/placement behavior from `ColonyGrid` and `spatial-build-test` into that host/projection.
5. Adapt `WalkableColony` into the isometric projection of the same state.
6. Route entity opening through `BuildingInterior` from the shared surface.
7. Remove `ColonyGrid` walking/interior state, then remove `ColonyGrid` when no unique build behavior remains.
8. Delete `spatial-build-test` once its functionality has no unique dependency.
9. Simplify `DashboardClient` and remove structural CSS debt from `page.tsx`.
10. Run a final import/dead-file audit and remove unreferenced grid-era helpers.

## Cleanup rule

For every candidate deletion ask:

> Does this file still own unique domain behavior, interaction behavior, or a production path that has not yet moved?

If yes, migrate first. If no, delete it rather than keeping parallel compatibility UI indefinitely.
