# Sauerland Earth Materials

Status: **graphics source family accepted for `GFX-SAU-001`**. Runtime/world-space composition remains a separate technical concern.

## Current assets

- `earth_base_01.webp` — calm brown loamy soil; **PASS WITH FAMILY CONSTRAINT**
- `earth_base_02.webp` — same material family, slightly darker macro rhythm; **PASS WITH FAMILY CONSTRAINT**
- `earth_base_03.webp` — same material family, slightly lighter macro rhythm; **PASS WITH FAMILY CONSTRAINT**
- `earth_base_04.webp` — same material family, subtle warm variation; **PASS WITH FAMILY CONSTRAINT**

These are continuous-world source materials, not visible map tiles.

## Production method

A generated soil reference board was used only as source material. The labelled board itself is **rejected as a production asset** and is not stored here. The accepted earth materials were rebuilt as individual seamless stochastic textures from the quiet brown-loam source language so that no labels, panel borders, large stones, twigs or presentation artifacts remain baked into the final files.

## Usage contract

- no rhombus frame, sidewall, label, logo or presentation background;
- no memorable large stones, roots, sticks, grass clumps or debris in the repeating base material;
- such high-interest detail belongs in transition/detail sprite layers;
- the four variants should be mixed as a family rather than used as one endlessly repeated source;
- final world-space blending, rotation/offset policy, chunking and renderer behaviour are outside the graphics branch.

## Repeat review

Each asset was checked in exact repeated layouts before repository acceptance.

Result:

- no dominant hard seam at source boundaries;
- no presentation border survives into the production texture;
- variants remain close enough in palette to mix as one earth family;
- exact repetition of a single source can still become perceptible, therefore all four remain `PASS WITH FAMILY CONSTRAINT`;
- family-level variation is sufficient for the current graphics foundation pass.

## Scope note

The brighter dry-soil, gravel-heavy and moss/damp panels from the original reference board were **not** promoted into this earth family. They belong to later `gravel`, `damp_grass` or other dedicated material families rather than being silently mixed into one catch-all ground type.

## Next production step

Continue `GFX-SAU-001` with the **dark/damp grass family**, then gravel/rock and field families. Renderer integration is not part of this branch.
