# Sauerland Meadow Materials

Status: production candidates for `GFX-SAU-001`.

## Current assets

- `meadow_base_01.webp` — first calm meadow base-material candidate; **asset-level result: PASS WITH FAMILY CONSTRAINT**.
- `meadow_base_02.webp` — second calm meadow base-material candidate; derived by patch-based texture synthesis from the accepted Sauerland meadow source language; **asset-level result: PASS WITH FAMILY CONSTRAINT**.

## Usage contract

- continuous-world source material, not a visible map tile;
- no rhombus frame, soil sidewall, label, logo or presentation background;
- high-interest rocks, flowers, shrubs and tufts belong in separate detail layers;
- base materials must remain quiet enough for large-area repetition;
- a base material is not expected to hide periodicity when the exact same source is repeated indefinitely; family-level anti-repetition comes from several variants plus runtime world-space variation;
- do not mark the meadow family `ACCEPTED` until the family passes a mixed large-area test.

## Review: meadow_base_01

Repeat test: exact 3×3 repetition at equal scale.

Result:

- no dominant hard seam or border line was visible;
- colour and local grass texture connect well enough for use as a source material;
- the repeated macro-pattern is still recognisable when the same source is tiled unchanged;
- therefore `meadow_base_01.webp` is acceptable as **one member of a material family**, but must not be used alone as the final continuous-world ground solution.

## Review: meadow_base_02

Repeat test: exact 3×3 repetition at equal scale.

Result:

- no visually dominant tile edge in the repeat test;
- quieter macro-pattern than the rejected direct-generation candidate;
- no mirrored four-way symmetry introduced;
- still recognisable as periodic if used alone, therefore the same family constraint applies as for base 01.

## Required family/runtime mitigation

- 4–6 meadow variants with different macro distribution;
- world-space variant mixing rather than one texture copied everywhere;
- offset/rotation/scale variation where technically supported;
- low-frequency macro colour/density modulation;
- separate detail sprites for flowers, stones, tufts and other memorable accents.

## Rejected candidate notes

Two `meadow_base_02` experiments were rejected before production acceptance:

1. mirrored construction: immediately visible synthetic symmetry in the 3×3 repeat test;
2. direct high-detail generation: too many memorable flower/plant clusters for a calm base material.

Neither rejected candidate is a production asset.

## Next production asset

`meadow_base_03.webp` should differ mainly in grass density/colour rhythm rather than by adding decoration. It must pass the same 3×3 repeat review before acceptance.
