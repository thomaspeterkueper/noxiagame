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
- resource telemetry and contextual activity indicators
- z-index/layering contract for application overlays
- responsive HUD behavior

Neither workstream should silently absorb the other's responsibilities.

## Desktop composition

1. Global top bar, 54 px high.
2. World surface fills the remaining viewport.
3. Resource telemetry floats as a compact instrument strip above the upper map area; it does not reserve a row.
4. Warnings and active build progress are contextual status indicators and exist only while relevant.
5. Player, active ship/cargo and feed are compact managed windows on the right.
6. Player-owned/current locations form a horizontal navigation dock near the lower-left edge.
7. Large tasks such as market, shipyard, profile, journeys, ship interiors and founding continue to use overlays/drawers instead of permanent columns.

## Top bar contract

The top bar is an orientation/status anchor, not a second dashboard and not a permanent action toolbar.

Permanently visible desktop content is deliberately limited to:

- NOXIA identity / current product context
- credits
- current location
- direct player/avatar access
- one compact `Aktionen` entry point

The active ship capacity is not duplicated in the top bar because ship and cargo state already have their own managed HUD window. Global population is likewise not a useful permanent map status.

Secondary actions live in the compact action menu:

- Einweisung
- Gründen
- Freunde / messages
- Abmelden

`DashboardTopbarManager` currently proxies the existing `DashboardClient` actions into this compact menu so their established behavior is preserved without another large client rewrite. The hidden legacy buttons remain the functional source during this transition. Future top-bar actions should expose semantic callbacks directly instead of adding more DOM text matching.

Unread friend/message count remains visible on the compact action trigger and inside the menu. Escape and outside click close the menu.

Responsive behavior:

- desktop: credits + current location + avatar + `Aktionen`
- narrower widths: status labels disappear before values
- compact widths: `Aktionen` becomes icon-only
- very narrow mobile: credits may disappear before the current location, because orientation is more important than a duplicated balance readout

## HUD taxonomy

The dashboard distinguishes four UI roles. They should not be implemented as interchangeable floating cards.

### 1. Managed windows

Persistent information panes which a player may arrange. Current examples: player, ship/cargo and feed.

### 2. Navigation docks

Stable navigation surfaces tied to an edge of the viewport. The location dock is the first canonical example. It remains anchored rather than freely draggable, because its function is spatial navigation, not inspection. It can be collapsed and remembers that state in browser local storage (`noxia:location-dock:v1`).

### 3. Telemetry

Small, continuously useful measurements which must not capture map input. Colony resources are telemetry. They remain compact, centered above the world surface and use warning emphasis for negative deltas rather than opening a full information window.

### 4. Contextual activity

Transient indicators which should not permanently occupy map area. Active build progress and colony shortages belong here. When the condition no longer exists, the UI element disappears.

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

## Location dock contract

`DashboardLocationDockManager` manages the existing `Deine Orte` block as a dedicated navigation dock.

- canonical position: lower-left map edge
- default state: expanded
- may collapse to a small `ORTE` control
- does not become a free-floating window
- preserves the existing location-card click behavior
- persists only its collapsed/expanded state, not an arbitrary position

This distinction prevents primary navigation from drifting around the map and keeps a predictable home position for switching locations.

## Interaction rule

Persistent HUD must use as little map area as possible. Map interaction remains available in all uncovered areas. Telemetry and contextual indicators use `pointer-events: none`; managed windows and navigation docks intercept pointer events only inside their own bounds.

## Visual rule

The HUD remains readable and science-oriented rather than becoming a dense game cockpit. It uses translucent light surfaces, restrained shadows, NOXIA blue/gold accents and high text contrast over both dark and light map content. Telemetry may use the darker instrument style already established by the colony view because it behaves as instrumentation rather than a document-like window.

## Responsive rule

At narrower widths, information disappears or compresses in this order:

1. expanded profile window
2. feed window
3. resource labels reduce while values remain visible
4. contextual warning/build indicators may collapse out on narrow mobile widths
5. secondary top-bar labels/details
6. credits before current-location orientation on very narrow widths

The active ship/cargo state and location dock remain longer because they directly affect current play. On small mobile screens the right HUD stack may disappear entirely while large functions remain available through their existing overlays/actions.

## Renderer independence

The shell must not depend on renderer state or physical world coordinates. The current ColonyGrid and WalkableColony are transitional surfaces. A future georeferenced 2D/3D map can replace them without requiring another dashboard layout rewrite.
