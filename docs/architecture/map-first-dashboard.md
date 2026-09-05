# NOXIA Map-first Dashboard

Status: proposed/implemented as dashboard shell baseline

## Principle

The world surface is the primary workspace. NOXIA is no longer laid out as a dashboard page with a map placed inside a content column. Instead, the map/world renderer owns the viewport below the global top bar and dashboard information is layered above it as HUD.

## Ownership boundary

This document covers dashboard chrome and floating UI only.

The Grid / Map / Terrain workstream tracked in issue #69 owns:

- map and terrain renderer
- grid/terrain visualization
- georeferencing and DEM integration
- map camera, terrain LOD and renderer-specific interaction
- terrain-aware placement visualization

The Dashboard/HUD workstream owns:

- global top bar
- floating information windows
- location dock
- player/ship/feed presentation
- z-index/layering contract for application overlays
- responsive HUD behavior

Neither workstream should silently absorb the other's responsibilities.

## Desktop composition

1. Global top bar, 54 px high.
2. World surface fills the remaining viewport.
3. Resource/build state floats above the upper map area; it does not reserve a row.
4. Player, active ship/cargo and feed are compact floating windows on the right.
5. Player-owned/current locations form a horizontal floating dock near the lower-left edge.
6. Large tasks such as market, shipyard, profile, journeys, ship interiors and founding continue to use overlays/drawers instead of permanent columns.

## HUD window contract

`DashboardHudManager` currently upgrades the existing player, ship/cargo and feed cards into one common window behavior without requiring a large rewrite of `DashboardClient`. This is a transition bridge; future HUD panels should follow the same semantic window contract directly rather than add more selector-specific layout rules.

Managed window ids are stable semantic ids:

- `profile`
- `ship`
- `feed`

Each managed window supports:

- collapse and expand
- pin to the canonical right-side rail
- unpin and drag freely above the map
- reset to its canonical default position
- persistent layout in browser local storage (`noxia:hud-layout:v1`)
- viewport clamping so saved windows cannot remain permanently off-screen after a resize

The default state is pinned. Dragging is available only after explicitly unpinning a window, which avoids accidental movement while operating controls inside it. Double-clicking the title bar toggles collapse.

## Interaction rule

Persistent HUD must use as little map area as possible. Map interaction remains available in all uncovered areas. Floating panes may intercept pointer events only inside their own bounds.

## Visual rule

The HUD remains readable and science-oriented rather than becoming a dense game cockpit. It uses translucent light surfaces, restrained shadows, NOXIA blue/gold accents and high text contrast over both dark and light map content.

## Responsive rule

At narrower widths, information disappears in this order:

1. expanded profile window
2. feed window
3. secondary header detail

The active ship/cargo state and location dock remain longer because they directly affect current play. On small mobile screens the right HUD stack may disappear entirely while large functions remain available through their existing overlays/actions.

## Renderer independence

The shell must not depend on renderer state or physical world coordinates. The current ColonyGrid and WalkableColony are transitional surfaces. A future georeferenced 2D/3D map can replace them without requiring another dashboard layout rewrite.
