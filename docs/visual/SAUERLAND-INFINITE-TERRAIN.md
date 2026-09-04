# Sauerland Continuous Terrain – Graphics Contract

Status: **working visual architecture**

Purpose: define how Sauerland graphics are authored for a visually continuous, effectively unbounded world without locking the art to a visible tile grid.

This is a graphics contract, not a renderer implementation specification.

## 1. Player-facing goal

The player should perceive a continuous landscape, not a board made from repeated rhombi.

Desired impression:

- valleys, meadows, forests and fields continue naturally beyond the current view
- no obvious tile seams
- no repeating wallpaper pattern
- roads and streams visually continue across arbitrary distances
- fields read as coherent agricultural areas
- vegetation density and detail vary naturally
- Hub infrastructure sits inside an ordinary Sauerland landscape rather than on a separate game board

## 2. Composition layers

Author Sauerland landscape art in layers.

### Layer A – terrain materials

Calm, repeatable surface families such as:

- meadow / grass
- darker or damp grass
- bare earth
- gravel / compacted ground
- rocky ground
- ploughed field
- optional later: forest floor, mud, paved service ground

Base materials should carry the general colour/texture character, not large unique landmarks.

### Layer B – transitions and boundary art

Transparent or composable graphics that visually blend one terrain family into another.

Typical transition language:

- thinning grass into exposed soil
- loose stones appearing before rocky ground
- weeds and grasses invading gravel edges
- irregular field margins
- moss/soil between rock clusters

Do not author every possible full terrain-pair scene as a separate complete tile. Prefer reusable edge/corner/boundary families.

### Layer C – micro-details

Independent small graphics, for example:

- grass tufts
- flower clusters
- weeds
- small stones
- medium rocks
- bare patches
- fern/bracken later
- twigs, leaf litter and similar local details later

These are used to destroy visible repetition in the base materials.

### Layer D – linear landscape systems

Separate visual systems for:

- rivers and streams
- roads
- gravel/dirt tracks
- hedges
- fences
- field margins
- drainage ditches

They must visually cross the underlying terrain continuously. They are not represented as isolated complete terrain diamonds.

### Layer E – area-based land use

Fields, woodland areas, industrial yards and similar regions should read as coherent areas. Repetition may occur inside the material, but the visual boundary should be shaped by transition/border assets rather than by exposed grid geometry.

### Layer F – freestanding objects

- trees
- shrubs
- buildings
- bridges
- utility objects
- signs where explicitly required
- vehicles

These remain independent sprites/assets above the terrain surface.

## 3. Base material requirements

A production terrain material should:

- be visually quiet enough to repeat over a large area
- avoid one memorable rock, flower group or bare patch near the same position in every repetition
- match the Sauerland palette
- avoid baked text/signage
- avoid strong local shadows belonging to nonexistent objects
- allow detail sprites to carry most high-frequency visual interest
- blend naturally into its own variants

For a material family, prefer multiple subtle variants rather than one highly decorated image.

Suggested first family sizes:

- meadow: 4–6 calm variants
- dark/damp grass: 3–4 variants
- earth: 3–4 variants
- gravel: 3–4 variants
- rocky ground: 3–4 variants
- ploughed field: 3–4 variants plus orientation/row studies as needed

## 4. Transition strategy

Transition assets exist to remove hard material boundaries.

Do not create a giant matrix of every terrain A-to-B orientation and decoration combination.

Instead build transition kits by visual material language. Example:

- `earth_edge_*` introduces exposed soil, sparse grass and a few stones
- `gravel_edge_*` introduces compacted pale aggregate and sparse weeds
- `rock_edge_*` introduces stones and rocky substrate
- `field_margin_*` introduces field verge/soil edge rather than a soft natural blend

Each kit should include enough edge, corner and irregular variants to avoid obvious repetition.

A useful conceptual set is based on four boundary directions and corner cases, but production art does not have to expose a literal 16-tile matrix if reusable overlays cover the same visual states.

## 5. Agricultural terrain is not generic blending

Wiese → Acker should often show a real land-use boundary:

- grass verge
- field margin
- hedge
- shallow ditch
- compacted access strip
- irregular soil edge

This is more believable for Sauerland than dissolving the field into meadow like a paint gradient.

## 6. Rivers and streams

Water is a separate landscape system, not merely another ground material.

Required visual vocabulary will include:

- narrow stream
- wider stream/river
- straight segments
- bends
- S-curves
- branching/confluence states
- source/headwater studies
- banks and shore transitions
- gravel/mud bank accents
- bridge-compatible banks

The visible result must be continuous water with continuous banks. Do not use circles, markers or disconnected rectangles as water representation.

## 7. Roads and paths

Road/path graphics should support continuous routes across the world.

Families:

- rural asphalt road
- gravel road
- dirt/farm track
- footpath
- service road around Hub infrastructure

Required visual states include straights, curves, junctions and believable transitions into yards/bridges/tunnels. Road edges should interact naturally with grass, soil and gravel.

## 8. Macro / meso / micro visual hierarchy

### Macro

Regional character visible across large distances:

- forested hill
- open valley meadow
- agricultural area
- settlement
- Hub/industrial zone

### Meso

Landscape structure:

- field boundaries
- stream course
- road geometry
- woodland edge
- groups of houses
- hedgerows

### Micro

Surface variation:

- flowers
- tufts
- individual stones
- weeds
- small bare patches

The micro layer must never overpower the macro/meso form.

## 9. Chunk neutrality

Runtime may eventually use streaming chunks, sectors or another spatial partition. Graphics must not encode visible chunk edges.

Therefore:

- no border frame around material images
- no edge lighting that assumes the asset ends there
- no repeated corner ornament tied to a chunk
- no unique landmark that appears once per technical chunk

Technical streaming boundaries are invisible implementation details from the graphics perspective.

## 10. Current rhombus studies

The existing/new isometric rhombus terrain and transition images are useful as:

- colour references
- vegetation-density references
- transition-language references
- detail-sprite source studies

They should **not** automatically be used one-for-one as world cells. The earlier renderer screenshot demonstrated why: a repeated decorated rhombus creates a wallpaper effect and exposes the grid.

## 11. First production sequence

1. calm meadow material family
2. earth material family
3. rock/gravel material families
4. meadow ↔ earth transition kit
5. meadow ↔ rock/gravel transition kits
6. field-margin kit
7. small independent detail sprites
8. vegetation sprites
9. river/stream system
10. roads and paths

Only after these layers work together should the building pass be treated as final Sauerland integration.

## 12. Acceptance test

A terrain set passes graphics review when a large test composition can be assembled such that:

- repeated source materials are difficult to detect
- no diamond/grid boundary dominates the landscape
- transitions read as physical terrain boundaries
- water and roads remain continuous
- detail density stays plausible at both overview and close zoom
- the scene still looks like Sauerland rather than a generic fantasy/RTS biome
