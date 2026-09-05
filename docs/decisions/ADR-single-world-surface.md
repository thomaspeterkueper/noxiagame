# ADR — Single World Surface

**Status:** Accepted  
**Date:** 2026-09-05  
**Scope:** NOXIA dashboard, colony world rendering, planning/building interaction

## Context

NOXIA currently contains several overlapping representations of the same colony/world context:

- the legacy `ColonyGrid` 32×24 tile planning/build surface,
- `DashboardPrimaryColony` + `WalkableColony` as the primary colony surface,
- `/dashboard/spatial-build-test` as a continuous metric build prototype.

These paths duplicate camera, selection, placement, rendering and navigation concerns. They also make features easy to implement in one surface while leaving another surface behind.

The spatial build model introduced on main already provides a safer long-term world basis: continuous metric coordinates (`x_m`, `y_m`, `z_m`), footprints, `world_frames`, and explicit `placement_mode`. Legacy tile positions remain compatibility data and are deliberately not converted to invented physical metre coordinates.

## Decision

NOXIA will use **one canonical World Surface per world/location context**.

The player does not switch between separate colony maps. The same world state is projected through selectable render modes, comparable to changing the presentation of one map application.

### 1. One world, multiple projections

The canonical surface has a projection setting:

- `topdown` — orthogonal 2D view for planning, infrastructure, building and overview,
- `isometric` — isometric view of the same entities at the same world positions.

Changing projection MUST NOT create or load another world representation. Selection, camera focus, active location, overlays and gameplay identity stay attached to the same surface.

`planning` and `colony` are therefore not separate persistent or spatial worlds. Any remaining mode names using those terms are transitional UI compatibility only.

### 2. Shared camera

The World Surface owns one logical camera state, including at minimum:

- world-space center/focus,
- zoom/scale,
- selected entity or world point.

A projection may derive screen coordinates differently, but switching `topdown ↔ isometric` preserves the logical world-space focus and selection.

### 3. Shared interaction and information layers

Building selection, placement, navigation and information overlays belong to the World Surface and are independent from the renderer where possible.

Examples of optional layers:

- resources and scanner discoveries,
- utilities and infrastructure,
- ownership,
- population/residents,
- logistics or traffic,
- science/knowledge information.

A layer changes what is shown, not which world is loaded.

### 4. Spatial source of truth

For new world placement, continuous metric coordinates are the preferred spatial representation.

`placement_mode = 'world'` with metric coordinates and footprints is the forward model. `legacy_tile` remains supported only as compatibility data while old content is migrated or adapted.

NOXIA MUST NOT manufacture physical coordinates by multiplying legacy `tile_row` / `tile_col` by an arbitrary scale. Unknown physical positions remain unknown until a valid migration or placement rule exists.

### 5. Renderers are projections

Renderers do not own persistent simulation truth.

A top-down renderer and an isometric renderer consume the same world projection/read model. They may keep renderer-local ephemeral state, but entity identity, placement, ownership and gameplay state originate from the canonical world state.

### 6. Interior is a real context change

Entering a building interior is different from changing map projection and may remain a distinct spatial context/mode.

`BuildingInterior` is the intended dispatcher for building interiors. Special interiors such as `ScannerMicroScene` remain valid and must be reachable from the canonical World Surface before legacy interior entry paths are removed.

### 7. Genuine scale/context changes may have separate surfaces

A ship interior, cockpit, solar-system navigation, or a station interior may use dedicated surfaces when they represent a genuinely different spatial context or scale.

They MUST NOT become alternate representations of the same colony ground world.

### 8. Dashboard ownership

`DashboardClient` owns global dashboard chrome and cross-cutting overlays. It must not maintain a second colony map underneath the canonical World Surface.

`DashboardPrimaryColony` is transitional and may evolve into or be replaced by the canonical `WorldSurface` host.

### 9. New-feature rule

New colony/world gameplay must target the canonical World Surface or shared world-domain services. No new standalone colony map, test map, planning map or alternate world renderer may become a production gameplay path.

Experiments may exist temporarily, but must be explicitly marked as prototypes and either be merged into the World Surface or removed.

## Migration strategy

Migration is incremental:

1. document and freeze the target architecture,
2. extract reusable camera/spatial/build logic from existing implementations,
3. centralize world read-model and interaction state,
4. provide top-down and isometric projections over that shared state,
5. route building interiors through one dispatcher,
6. remove duplicate colony surfaces only after their required functionality has moved,
7. retain legacy tile compatibility until data migration is safe.

## Consequences

This decision intentionally favors one coherent game surface over preserving historical component boundaries. Some large legacy files will shrink substantially or disappear. Applied database migrations remain repository history even when the UI that originally motivated them is retired.
