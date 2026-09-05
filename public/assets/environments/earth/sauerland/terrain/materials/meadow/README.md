# Sauerland Meadow Materials

Status: **graphics source family accepted for `GFX-SAU-001`**. Runtime/world-space composition is a separate technical concern.

## Current assets

- `meadow_base_01.webp` — **PASS WITH FAMILY CONSTRAINT**
- `meadow_base_02.webp` — **PASS WITH FAMILY CONSTRAINT**
- `meadow_base_03.webp` — **PASS WITH FAMILY CONSTRAINT**
- `meadow_base_04.webp` — **PASS WITH FAMILY CONSTRAINT**
- `meadow_base_05.webp` — **PASS WITH FAMILY CONSTRAINT**
- `meadow_base_06.webp` — **PASS WITH FAMILY CONSTRAINT**

All six are continuous-world source materials, not visible map tiles.

## Usage contract

- no rhombus frame, soil sidewall, label, logo or presentation background;
- high-interest rocks, flowers, shrubs and tufts belong in separate detail layers;
- base materials remain visually quiet enough for large-area repetition;
- no single base material is expected to hide periodicity when copied indefinitely;
- anti-repetition is achieved at family level through variant mixing plus world-space variation;
- offset/rotation/scale variation and low-frequency macro modulation may be used where the renderer supports them;
- renderer/runtime implementation is out of scope for the graphics branch.

## Asset repeat reviews

### `meadow_base_01.webp`

Exact 3×3 repetition: no dominant hard seam or border line; local grass texture connects acceptably. The repeated macro-pattern becomes recognisable if this source is used alone.

### `meadow_base_02.webp`

Exact 3×3 repetition: no dominant tile edge; quieter macro-pattern than the rejected direct-generation candidate; no mirrored four-way symmetry. Periodicity remains detectable when used alone.

### `meadow_base_03.webp` to `meadow_base_06.webp`

Exact 2×2 repetition checks were performed before repository acceptance.

Result across the four variants:

- no dominant hard seam that disqualifies the material as a family member;
- density and colour rhythm differ enough to broaden the family;
- no asset is intended to carry memorable landmark decoration;
- exact same-source repetition remains detectable, therefore the family constraint applies to all six materials.

## Mixed-family review

A 5×5 mixed meadow composition was assembled from the family candidates.

**Graphics-family result: PASS.**

The mixed surface reads substantially less like wallpaper than one repeatedly copied source. The six variants provide enough variation to proceed with the continuous-terrain source library. This acceptance applies to the **graphics material family only**; final large-world validation remains dependent on renderer-side world-space mixing and is tracked separately by `GFX-SAU-009` (`BLOCKED_TECH`).

## Rejected candidate notes

Two earlier `meadow_base_02` experiments were rejected before production acceptance:

1. mirrored construction — synthetic symmetry became immediately visible in repetition;
2. direct high-detail generation — too many memorable flower/plant clusters for a calm base material.

Neither rejected candidate is a production asset.

## Next production step

The meadow family is complete for the current foundation pass. Continue `GFX-SAU-001` with the **earth material family**. Do not add more meadow variants unless a later composition test demonstrates a specific gap.
