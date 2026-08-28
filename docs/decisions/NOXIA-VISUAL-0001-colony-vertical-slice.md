# NOXIA-VISUAL-0001 — Colony Visual Vertical Slice

**Status:** Accepted / implementation guide  
**Scope:** NOXIA repository only  
**First target:** Mars / Tharsis Hub

## Goal

Turn the colony view into a readable, simulation-backed strategy scene without creating a decorative parallel world. The visual layer must render existing NOXIA world objects and living-population state.

## View hierarchy

1. **Strategy** — complete colony, terrain, roads, buildings, vehicles, population and alerts.
2. **District** — reached by zooming in; larger assets, people become directly selectable, local activity is readable.
3. **Interior / personal** — existing building-entry boundary. Later this may grow into genuinely walkable buildings and exploration spaces without replacing the strategy simulation.

The current milestone implements levels 1 and the beginning of 2. Level 3 remains behind `onEnterBuilding`.

## Rendering contract

- `tile_entities` remain the source of truth for buildings and their coordinates.
- Living Population API remains the source of truth for simulated people, assignments, needs and activity state.
- Visual interpolation may animate a person between known home/work anchors but must not invent persistent simulation state.
- Selection always points back to a real building or person ID.
- No non-functional work/trade/dialogue buttons are shown merely for atmosphere.

## Mars vertical-slice rules

- Mars gets terrain variation, relief markers and a stronger colony footprint instead of a flat uniform tile carpet.
- Buildings remain existing `BuildingSVG` assets, rendered larger and with zoom-dependent labels/details.
- NPCs use controllable CSS/SVG-style sprite animation rather than GIF playback so selection and simulation state remain deterministic.
- At district zoom, NPCs are first-class clickable objects; at overview zoom they recede visually.
- Camera zoom must preserve the point beneath the pointer to make zooming into a district feel spatial rather than like scaling a screenshot.

## Next implementation increments

- visual depth ordering and larger building footprints
- deterministic NPC home/work travel interpolation
- district-detail layer at high zoom
- terrain props/lighting that do not affect simulation state
- richer interior scenes only after the strategy/district slice is stable

## Explicit non-goals for this milestone

- no Three.js dependency
- no fake 3D world detached from the tile model
- no LLM NPC dialogue
- no Mars-tunnel exploration yet
- no cross-repository knowledge changes
