# Sauerland Graphics Assets – Usage Guide

Status: **graphics usage notes for agents and integrators**

This directory contains NOXIA Earth/Sauerland visual assets. File presence alone does not mean production approval.

## 1. Read first

Before creating, replacing or integrating Sauerland assets, read:

- `docs/visual/NOXIA-VISUAL-BIBLE.md`
- `docs/visual/GRAPHICS-AGENT-HANDOFF.md`
- `docs/visual/SAUERLAND-INFINITE-TERRAIN.md`
- `docs/visual/GRAPHICS-REQUESTS.md`

## 2. Important current decision

The target world is visually continuous and effectively unbounded. Do **not** assume one complete illustrated rhombus equals one world cell.

The earlier repeated-rhombus presentation is deprecated as a final visual approach.

Existing rhombus terrain/transition art may be used as:

- style reference
- colour reference
- source for extracting material/detail ideas
- transition-language reference

It should not automatically be mapped one-for-one onto a player-facing grid.

## 3. Intended graphics families

Target organization under the Sauerland asset root:

```text
terrain/
  materials/       calm repeatable ground source art
  transitions/     edge/corner/boundary graphics
  details/         tufts, flowers, stones, bare patches
vegetation/         trees, shrubs, hedges
water/              stream/river/bank source graphics
transport/          roads, tracks, paths, bridges/tunnels visual assets
buildings/          ordinary Sauerland buildings
hub/                Tharsis Hub visual assets
vehicles/           Earth vehicle sprites
reference/          style studies not intended as direct production assets
```

Legacy/provisional files may currently live outside this target structure. Do not move or rename them casually; use a graphics-specific cleanup request so other agents can see the change.

## 4. Production asset expectations

### Terrain materials

- visually quiet
- repeatable/composable
- no strong unique landmark at a fixed position
- no artificial frame
- no baked text
- compatible with independent detail sprites

### Transition graphics

- irregular natural boundary
- must compose with base materials
- avoid obvious repeated zig-zag or perfect geometric edge
- use real Sauerland transition language: thinning grass, soil, stones, weeds, verges, field margins

### Detail sprites

- transparent background
- several size/density variants
- consistent light direction
- should add variation without becoming the terrain base itself

### Buildings / objects

- transparent background where applicable
- consistent isometric camera
- stable ground anchor
- readable at strategy zoom
- no generated text artifacts
- no rectangular residual image backgrounds

## 5. Naming guidance

Prefer names that describe visual function rather than implementation state.

Examples:

```text
terrain/materials/meadow_01.webp
terrain/materials/meadow_02.webp
terrain/materials/earth_01.webp
terrain/transitions/earth_edge_soft_01.webp
terrain/transitions/earth_corner_inner_01.webp
terrain/details/grass_tuft_03.webp
terrain/details/rock_small_05.webp
vegetation/birch_02.webp
water/stream_bank_gravel_01.webp
transport/farm_track_surface_01.webp
```

Do not encode simulation IDs, coordinates or gameplay rules into graphics filenames unless an existing canonical asset contract explicitly requires it.

## 6. Orientation packs

Some V1 assets contain orientation packs such as `turnaround_4.svg`, `turnaround_8.svg` or `orientations_4/8.svg`.

These are provisional visual coverage tools. Some directions were produced by rotation rather than as genuinely redrawn/rendered views, so perspective/light may not be final.

Preserve their folder structure when replacing them with genuine view-specific production art unless a graphics cleanup request explicitly changes the convention.

## 7. Branding

Canonical in-game brand form: `noχ1ᐃ`.

However:

- most terrain and ordinary props have no branding
- private buildings may have their own identities
- Earth state/government/SSF/NOXIA operator contexts may justify branding
- generated lettering should not be baked into final sprites

Use separate decals/overlays when possible.

## 8. Old screenshot warning

The Sauerland isometric renderer screenshot with repeated decorated ground diamonds, blue circle/rectangle water and rectangular building backgrounds is a **failure/reference state**, not the visual target.

Do not use that screenshot as a style source except to understand what must be avoided.

## 9. Agent completion note

When adding a meaningful graphics build:

1. update the relevant `GFX-*` request in `docs/visual/GRAPHICS-REQUESTS.md`;
2. state whether each delivered asset is production, review or reference-only;
3. record the intended usage/path;
4. do not modify renderer/simulation code from this branch.
