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

## Spatial building expansion

Expandable buildings use **real neighbouring grid space**. Expansion is not an abstract level-up that leaves the original footprint unchanged.

- Every expansion module occupies one or more explicit adjacent tiles.
- An expansion is permitted only when all tiles required by that module are free and buildable.
- Occupied, blocked or otherwise unavailable required tiles prevent that expansion; existing entities are not displaced automatically.
- Placement of the initial building therefore has long-term gameplay consequences: players must reserve physical space if they expect to expand later.
- Building level/technology and physical module count are separate concepts. A technology upgrade may improve a module without creating additional capacity that canonically requires more physical space.
- Visual assets for expandable buildings should be modular wherever practical rather than baking every possible final footprint into a single image.

### Earth spaceport / `landing_pad` reference rule

The Earth starter spaceport is the first canonical implementation of spatial expansion.

- The starter spaceport contains a core/service component and **one operational landing pad**.
- Default capacity is **one ship per pad** at the same time.
- Additional ship capacity requires additional pad modules on neighbouring tiles.
- Each additional pad occupies real grid space and must connect plausibly to the existing spaceport/service infrastructure.
- If the required neighbouring tile or tiles are unavailable, the corresponding pad expansion cannot be built.
- Future improvements to handling speed, fuelling, cargo systems, control systems or service quality do not automatically increase simultaneous ship capacity unless an explicit rule says otherwise.
- Art direction must preserve visible expansion interfaces and avoid depicting the starter building as a completed multi-pad megastructure.

This spatial-expansion rule should be considered for other suitable NOXIA building families as they are implemented (for example production halls, warehouses and research complexes), but their exact module and capacity rules remain building-specific.

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