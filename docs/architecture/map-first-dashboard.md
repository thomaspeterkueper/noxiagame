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
- cockpit command and music controls
- legal/information access inside the cockpit
- z-index/layering contract for overlays
- responsive dashboard behavior

Neither workstream should silently absorb the other's responsibilities.

## Desktop composition

1. Compact global top bar, 44 px high.
2. World/map surface fills the complete remaining viewport.
3. Bottom cockpit floats above the lower map edge and owns interactive dashboard commands.
4. Resource telemetry may float above the map without capturing pointer input.
5. Warnings and build progress exist only while relevant.
6. Profile, ship/cargo and locations are hidden by default and open on demand from the cockpit.
7. Feed is optional passive telemetry rendered as a right-side text overlay, not as an interactive drawer.
8. Legal information and data attribution live behind a compact cockpit info control instead of a permanent footer.
9. Large workflows such as market, shipyard, founding, journey, profile detail and interiors remain overlays/drawers.

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

The top bar is an orientation/status anchor, not a command toolbar.

Permanent desktop content is deliberately limited to:

- NOXIA identity
- credits
- current location
- player/avatar access

The previous `Aktionen` command menu is no longer rendered in the top bar. Einweisung, Gründen, Freunde/messages and Abmelden remain backed by their existing application handlers but are invoked from the bottom cockpit.

Ship capacity is not duplicated in the top bar; it belongs to the ship cockpit panel. Global population is likewise not permanent top-bar status.

## Cockpit contract

`DashboardCockpit` is the primary UI launcher and command surface at the lower edge.

Current cockpit entries:

- Karte: closes interactive cockpit drawers/utilities and exposes the maximum map area
- Orte: opens location navigation
- Schiff: opens ship/cargo status
- Profil: opens player status/profile entry
- Feed: toggles a passive event stream over the right side of the map
- Standorte: proxies the current Earth map site-layer toggle when available
- Ansicht: proxies the current planning/isometric view switch when available
- Aktionen: opens Einweisung, Gründen, Freunde/messages and Abmelden
- Musik: opens play/pause and volume controls backed by the global `MusicProvider`
- Info: opens legal links, copyright and current map/data attribution

Only one interactive information/utility surface is open at a time. Passive toggles such as Feed may remain enabled while the map or a drawer is active. Cockpit drawers float above the map and close back to `Karte` without altering map state.

The current implementation deliberately reuses existing dashboard cards and action handlers as content/behavior sources. This is a transition bridge. Future modules should expose semantic panel/telemetry/command APIs rather than rely on DOM discovery.

## HUD taxonomy

### 1. Cockpit drawers

On-demand interactive information surfaces opened from the lower cockpit. Current examples: player, ship/cargo and locations. They use slight translucency and blur so the map remains perceptually present behind them.

### 2. Passive telemetry overlays

Continuously or optionally useful measurements which must not capture map input. Colony resources remain compact instrumentation. The feed belongs to this category: when enabled, its event content is rendered as a right-side text stream on one uniform blurred backing surface, with no gradient, card chrome or separator lines and with `pointer-events: none`.

### 3. Contextual activity

Transient indicators for conditions such as shortages or active construction. They disappear when no longer relevant.

### 4. Cockpit utility panels

Short-lived command surfaces such as Aktionen, Musik and Info. They are opened from the cockpit, occupy bounded space above it, and do not become permanent map chrome.

### 5. Large workflow overlays

Market, shipyard, founding, journey, interiors and similar tasks may temporarily cover more of the world because they represent deliberate workflows rather than ambient HUD.

## Music contract

The global `MusicProvider` remains the single audio-state owner so playback survives navigation. The ordinary site-level floating `MusicControls` remain available outside the dashboard. While the dashboard is active, that floating control is suppressed and the cockpit consumes the same provider directly for play/pause and volume.

This avoids duplicate audio players or competing playback state.

## Information/legal contract

Copyright, Impressum, Datenschutz, Nutzungsbedingungen and current map/data attribution are accessible from the cockpit `Info` control. They must remain available even though the document footer itself is suppressed in fullscreen dashboard mode.

## Visual direction

The persistent shell is moving away from light admin-dashboard styling toward a restrained technical game interface:

- dark blue/black cockpit and top-bar surfaces
- blue/cyan instrument accents with NOXIA gold for identity/priority
- monospace numerics for credits, resources and technical values
- map remains visually dominant
- temporary drawers are slightly translucent rather than opaque white cards
- passive feed content floats as simple text over one uniformly blurred translucent surface
- pale document-style cards are tolerated only as transition content inside temporary drawers, not as permanent map chrome

## Earth fullscreen embedding transition

The current `EarthRegionPreview` still contains an editorial header/footer and self-calculated page-oriented height. The dashboard does **not** edit that component. Instead, the host temporarily:

- hides `.earth-head` and `.earth-foot`
- sizes `.earth-shell` and `.earth-map` to `100%` of the world host
- removes card-like map borders/radius at the dashboard boundary

The hidden `.earth-foot` remains a metadata source for the cockpit Info panel so attribution is not lost when fullscreen mode suppresses the visual footer.

Issue #69 contains an internal request for a first-class map fullscreen/embed contract. Once implemented by the map workstream, these host selectors should be removed.

## Interaction rule

Map interaction remains available everywhere not covered by an active cockpit drawer or explicit control. Persistent/passive telemetry uses `pointer-events: none`; the cockpit captures input only inside its own bounds.

The dashboard must not implement map pan/zoom itself. If map pointer behavior still fails after document scrolling is removed, the fix belongs to #69.

## Responsive rule

- top bar reduces to 42 px on compact screens
- cockpit becomes horizontally scrollable when necessary
- labels may compress before controls disappear
- active cockpit drawers/utilities fit within viewport bounds and scroll internally when needed
- feed overlay narrows to the available mobile width without blocking map input
- current location remains higher priority than duplicated financial/status detail

## Renderer independence

The application shell must not depend on physical world coordinates, terrain datasets or renderer implementation. A future georeferenced 2D/3D map can replace the current Earth/planning surface inside the same world host without reintroducing browser scroll, permanent sidebars or large editorial headers.
