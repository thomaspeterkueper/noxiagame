# Internal request — Map visual language / build-mode feedback

Owner: Grid / Map / Terrain workstream (#69)
Source: Dashboard/Cockpit UI workstream
Date: 2026-09-06

## Context
The fullscreen cockpit now provides the global HUD shell. An external concept review highlighted several useful visual principles, but map/terrain rendering remains owned by #69.

## Requested map-side capabilities

### 1. Optional technical map presentation layer
Keep canonical geometry and terrain data unchanged, but allow a purely visual presentation layer for the 2086/NOXIA feel:
- subtle cool/cyan colour grade or desaturation preset
- optional very light scan/noise texture
- no heavy film effect and no loss of cartographic readability
- must be toggleable/preset-driven and must not contaminate source imagery or ground-truth data

### 2. Buildability / terrain overlays
Expose semantic, renderer-owned overlays for:
- buildable
- restricted / conditionally buildable
- non-buildable
- water
- terrain/height
- slope
- contour/hillshade where available

The dashboard/cockpit should only control these by semantic layer IDs/callbacks; it should not reproduce terrain logic.

### 3. Terrain inspection contract
When a player points/selects a terrain cell or footprint, expose enough semantic information for a compact HUD panel, e.g.:
- world/geographic position
- terrain elevation (Earth displayed as m ü. NHN)
- slope
- aspect/orientation
- substrate/ground class if data exists
- buildability state + reason
- selected raster/footprint size where relevant

Do not invent unavailable values; fields may be absent.

### 4. Placement feedback
When build mode exists, expose clear interaction state to the UI:
- selected build object/type
- placement-valid / restricted / invalid
- current footprint
- reason for invalid/restricted placement
- place/cancel state

The renderer should provide the state; the cockpit may render the action chrome. Active selection should be visually unmistakable without relying on cursor position alone.

### 5. Fullscreen compatibility
All map-side panels/legends should be optional overlays or expose data to the cockpit. Avoid mandatory permanent left/right sidebars that shrink the world surface. The map remains the dominant viewport.

## Non-goals
- Do not copy any proprietary map UI.
- Do not move profile/ship/feed/dashboard responsibilities into the map renderer.
- Do not alter canonical coordinates, DEM values, terrain sampling or buildability rules for visual effect.

## Return to UI workstream
Please report the semantic layer IDs, inspection payload shape and build-mode state/callback surface once decided, so the cockpit can present the controls consistently.
