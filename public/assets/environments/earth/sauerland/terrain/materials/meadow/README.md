# Sauerland Meadow Materials

Status: production candidates for `GFX-SAU-001`.

## Current assets

- `meadow_base_01.webp` — first calm meadow base-material candidate; **asset-level result: PASS WITH FAMILY CONSTRAINT**.

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

Required family/runtime mitigation:

- 4–6 meadow variants with different macro distribution;
- world-space variant mixing rather than one texture copied everywhere;
- offset/rotation/scale variation where technically supported;
- low-frequency macro colour/density modulation;
- separate detail sprites for flowers, stones, tufts and other memorable accents.

## Rejected candidate note

A second candidate generated during this review was rejected before repository import because mirrored/semi-symmetric repetition created an obvious synthetic pattern. It is not a production asset and must not be treated as `meadow_base_02`.

## Next production asset

`meadow_base_02.webp` should be a genuinely different, quieter meadow source with:

- fewer memorable flower clusters than the rejected candidate;
- no mirrored/symmetric construction;
- no presentation framing;
- no strong directional lighting;
- a separate 3×3 repeat test before commit.
