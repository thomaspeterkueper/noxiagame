# NOXIA Map-first Dashboard

Status: implemented baseline, cockpit revision 2026-09-06

## Principle

The world surface is the primary workspace. The dashboard is a game viewport, not a scrolling web document. The browser viewport is owned by the application (`100dvh`), browser-level scrolling is disabled while the dashboard is active, and the map/world surface fills every pixel below the compact top bar.

The lower cockpit floats above the world surface. It does not reserve document height and therefore does not reduce the renderer viewport.

## Ownership boundary

This document covers dashboard chrome, HUD, cockpit navigation and host-level sizing only.

The Grid / Map / Terrain workstream tracked in issue #69 owns:

- map and terrain renderer
- grid/terrain visualization
- georeferencing and DEM integration
- map camera, pan/zoom and renderer-specific pointer interaction
- terrain LOD and terrain-aware placement visualization
- first-class fullscreen/embed support inside map components

The Dashboard/HUD workstream owns:

- the `100dvh` application shell
- compact global top bar
- bottom cockpit
- player/ship/feed presentation
- location navigation presentation
- resource telemetry and contextual activity indicators
- z-index/layering contract for overlays
- responsive dashboard behavior

Neither workstream should silently absorb the other's responsibilities.

## Desktop composition

1. Compact global top bar, 44 px high.
2. World/map surface fills the complete remaining viewport.
3. Bottom cockpit floats above the lower map edge.
4. Resource telemetry may float above the map without capturing pointer input.
5. Warnings and build progress exist only while relevant.
6. Profile, ship/cargo, feed and locations are hidden by default and open on demand from the cockpit.
7. Large workflows such as market, shipyard, founding, journey, profile detail and interiors remain overlays/drawers.

## No document scroll

The dashboard must never require the browser scrollbar for normal operation.

- application shell: `height: 100dvh; overflow: hidden`
- dashboard root: fixed to the viewport
- world host: flexes to the complete space below the top bar
- internal panels may scroll only inside their own bounded surfaces
- root/document footers are suppressed on the dashboard route
- overscroll must not steal wheel/touch interaction from the map

If content cannot fit, it belongs in a bounded drawer/overlay, not below the map in normal document flow.

## Top bar contract

The top bar is an orientation/status anchor rather than a second toolbar.

Permanent desktop content is deliberately limited to:

- NOXIA identity
- credits
- current location
- player/avatar access
- compact `Aktionen` menu

Secondary actions such as Einweisung, Gründen, Freunde/messages and Abmelden live in the action menu.

Ship capacity is not duplicated in the top bar; it belongs to the ship cockpit panel. Global population is likewise not permanent top-bar status.

## Cockpit contract

`DashboardCockpit` is the primary UI launcher at the lower edge.

Current cockpit entries:

- Karte: closes all cockpit drawers and exposes the maximum map area
- Orte: opens location navigation
- Schiff: opens ship/cargo status
- Profil: opens player status/profile entry
- Feed: opens the event feed
- Standorte: proxies the current Earth map site-layer toggle when available
- Ansicht: proxies the current planning/isometric view switch when available

Only one information drawer is open at a time. Cockpit drawers float above the map and close back to `Karte` without altering map state.

The current implementation deliberately reuses existing dashboard cards as content sources. This is a transition bridge. Future modules should expose semantic panel APIs rather than rely on DOM discovery.

## HUD taxonomy

### 1. Cockpit drawers

On-demand information surfaces opened from the lower cockpit. Current examples: player, ship/cargo, feed and locations.

### 2. Telemetry

Continuously useful measurements which must not capture map input. Colony resources remain compact instrumentation rather than full windows.

### 3. Contextual activity

Transient indicators for conditions such as shortages or active construction. They disappear when no longer relevant.

### 4. Large workflow overlays

Market, shipyard, founding, journey, interiors and similar tasks may temporarily cover more of the world because they represent deliberate workflows rather than ambient HUD.

## Visual direction

The persistent shell is moving away from light admin-dashboard styling toward a restrained technical game interface:

- dark blue/black cockpit and top-bar surfaces
- blue/cyan instrument accents with NOXIA gold for identity/priority
- monospace numerics for credits, resources and technical values
- map remains visually dominant
- pale document-style cards are tolerated only inside temporary transition drawers, not as permanent map chrome

## Earth fullscreen embedding transition

The current `EarthRegionPreview` still contains an editorial header/footer and self-calculated page-oriented height. The dashboard branch does **not** edit that component. Instead, the host temporarily:

- hides `.earth-head` and `.earth-foot`
- sizes `.earth-shell` and `.earth-map` to `100%` of the world host
- removes card-like map borders/radius at the dashboard boundary

Issue #69 contains an internal request for a first-class map fullscreen/embed contract. Once implemented by the map workstream, these host selectors should be removed.

## Interaction rule

Map interaction remains available everywhere not covered by an active cockpit drawer or explicit control. Persistent telemetry uses `pointer-events: none`; the cockpit captures input only inside its own bounds.

The dashboard must not implement map pan/zoom itself. If map pointer behavior still fails after document scrolling is removed, the fix belongs to #69.

## Responsive rule

- top bar reduces to 42 px on compact screens
- cockpit becomes horizontally scrollable when necessary
- labels may compress before controls disappear
- active cockpit drawers fit within viewport bounds and scroll internally
- current location remains higher priority than duplicated financial/status detail

## Renderer independence

The application shell must not depend on physical world coordinates, terrain datasets or renderer implementation. A future georeferenced 2D/3D map can replace the current Earth/planning surface inside the same world host without reintroducing browser scroll, permanent sidebars or large editorial headers.
