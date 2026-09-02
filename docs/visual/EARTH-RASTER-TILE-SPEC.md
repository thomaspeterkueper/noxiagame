# NOXIA Earth Raster Tile Specification

Status: canonical production rule for the Earth raster asset pass.

## Scope

This specification governs the **square grid raster family**: the repeating 64 × 64 square terrain tiles and the road-mask family (`road_0` … `road_15`) rendered by the grid views. All rules below bind only new Earth assets of this family.

The **isometric presentation family** is explicitly exempt: diamond terrain fills, road/river strips, building and vehicle turnaround frames and nature props authored for the Sauerland isometric view (`app/dashboard/sauerland-isometric`, assets under `public/assets/environments/earth/sauerland/`). That family is isometric sprite/prop artwork for the 3/4 isometric presentation, so the square 64 × 64 footprint, square four-edge repetition, WebP-target and road-mask rules of this document do not apply to it. It stays bound by the exterior strategy asset rules of `docs/visual/NOXIA-VISUAL-BIBLE.md` (§ 2 Exterior strategy assets, § 8 Asset acceptance criteria). Shipping new SVG artwork in the isometric presentation family therefore does not contradict this specification.

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
- An expansion is permitted only when all tiles required by that module are free, buildable and legally usable.
- Occupied, blocked or otherwise unavailable required tiles prevent that expansion; existing entities are not displaced automatically.
- Placement of the initial building therefore has long-term gameplay consequences: players must reserve physical space if they expect to expand later.
- Building level/technology and physical module count are separate concepts. A technology upgrade may improve a module without creating additional capacity that canonically requires more physical space.
- Visual assets for expandable buildings should be modular wherever practical rather than baking every possible final footprint into a single image.

### Earth spaceport reference rule

The Earth starter spaceport is the first canonical implementation of the modular facility system. A `spaceport` is a facility composed of physical modules; a landing pad is one module of that facility rather than an automatic synonym for the entire spaceport.

- Earth is a shared multiplayer start and begins with an established **public/state multi-module spaceport**.
- The initial Earth layout contains a spaceport core, two standard pads, one mini-pad, a service module and a storage module.
- A **mini-pad** currently provides two small/standard ship parking positions, one active launch/landing operation, integrated mini-storage and basic service. This is the canonical starter/outpost reference.
- A **standard pad** currently uses a tuning default of four ship parking positions and one active launch/landing operation. Its exact balancing value may change without altering the modular rule.
- Parking capacity and simultaneous launch/landing operations are separate values.
- Additional pads or service/cargo/passenger modules require neighbouring grid tiles and plausible physical connections to the existing facility.
- If a required neighbouring tile is unavailable, the corresponding expansion cannot be built.
- Better handling, automation, fuelling or control technology may improve throughput but does not silently create physical parking or pad capacity.
- Art direction must preserve visible connection/expansion interfaces. Individual module artwork must not depict unbuilt future modules.

This spatial-expansion rule also applies where meaningful to warehouses, production facilities, academies/research facilities, utilities and logistics hubs. Exact modules and capacities remain facility-specific.

## Raster rendering

- Runtime target: WebP where transparency/quality is adequate; PNG fallback only where necessary.
- No new SVG artwork as final square-grid Earth terrain/building representation (the isometric presentation family is exempt per Scope).
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

For modular buildings additionally test:

1. Individual modules on their own tiles.
2. Every intended adjacency/connection edge.
3. Small and expanded facility layouts assembled from the same module assets.
4. Clear distinction between occupied module tiles and genuinely free expansion tiles.

A tile that looks good in isolation but exposes the grid when repeated, or a building asset that visually claims unbuilt neighbouring space, is **not accepted**.