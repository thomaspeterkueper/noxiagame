# NOXIA Earth Raster Tile Specification

Status: canonical production rule for the Earth raster asset pass.

## Runtime tile size

- Grid runtime size: **64 × 64 CSS px**.
- New Earth terrain and road raster assets must be authored for an exact 64 × 64 tile footprint.
- Source masters may be rendered larger for quality, but the exported runtime asset must resolve cleanly to 64 × 64 without changing its footprint.
- Do not introduce new 44 × 44 Earth assets.

## Seamless edge rule

Every repeating terrain tile must be **mathematically/seamlessly tileable on all four edges**.

- Left edge must match the right edge pixel-for-pixel in terrain continuity.
- Top edge must match the bottom edge pixel-for-pixel in terrain continuity.
- No unique rock, flower, shrub, rut, shadow, bright patch, dark patch, or soil feature may terminate visibly at an edge unless it is part of an explicit transition tile.
- Lighting must not create a border halo or edge-darkening that reveals the tile boundary.
- Texture scale, grass density, soil colour and roughness must remain continuous across repeated tiles.
- Repetition should be reduced with several compatible variants whose border conditions are identical.

## Terrain variants

Base terrain variants share the same edge contract. Interior detail may vary, but the outer edge band must remain compatible between variants of the same terrain family.

For Earth Phase 1 this applies at minimum to:

- grass / meadow
- compacted soil
- rough soil
- gravel
- concrete
- asphalt / industrial surface

Coast, water, forest edges, roads and other transitions are explicit adjacency-driven tiles and are exempt from four-edge repetition only where their topology requires a transition.

## Roads

Road tiles use the same 64 × 64 footprint and a fixed connection geometry. All road connection points must meet at identical coordinates on the corresponding tile edge so that straight, curve, T-junction and crossing variants connect without a visible step or width change.

The road family should support the existing adjacency mask (`road_0` … `road_15`) rather than baking arbitrary road shapes into terrain tiles.

## Raster rendering

- Runtime target: WebP where transparency/quality is adequate; PNG fallback only where necessary.
- No new SVG artwork as final Earth terrain/building representation.
- No baked UI labels or text inside terrain tiles.
- Visible in-world branding must use **noχ1ᐃ**.
- Perspective, material response and illumination must stay consistent across the Earth asset family.

## Acceptance test

Before an Earth terrain family is accepted, test at least:

1. 8 × 8 repetition of the same tile.
2. Checkerboard repetition of all compatible variants.
3. Horizontal and vertical road chains.
4. Every road mask connection against its neighbours.
5. 100%, 50% and 200% game zoom.
6. No visible seams, one-pixel gaps, border halos, discontinuous road edges or scale jumps.

A tile that looks good in isolation but exposes the grid when repeated is **not accepted**.