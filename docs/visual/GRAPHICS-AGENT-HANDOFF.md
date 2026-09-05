# NOXIA Graphics Agent Handoff

Status: **binding working contract for graphics-only branches**

This document exists so that another agent can continue NOXIA visual work without reconstructing decisions from chat history.

## 1. Scope boundary

This graphics branch is for **visual assets and graphics-only documentation/manifests**.

Allowed:

- terrain materials and transition art
- vegetation, props and environmental sprites
- roads, paths, rivers and shoreline visual assets
- building, vehicle and spacecraft visual assets
- graphics reference sheets
- graphics-only asset metadata, naming notes and build requests
- visual documentation

Out of scope:

- simulation logic
- gameplay rules
- database/schema changes
- coordinates or world-model changes
- renderer/runtime implementation
- APIs
- technical seeds
- non-graphics repository files

If a graphics requirement implies a renderer or simulation change, record the requirement in the graphics request/documentation and hand it to the appropriate development thread. **Do not implement the technical change from this branch.**

## 2. Required reading before producing assets

Read these files in this order:

1. `docs/visual/NOXIA-VISUAL-BIBLE.md`
2. `docs/visual/SAUERLAND-INFINITE-TERRAIN.md`
3. `docs/visual/GRAPHICS-REQUESTS.md`
4. `public/assets/environments/earth/sauerland/README.md`

These documents override older screenshots, provisional atlases and ad-hoc chat assumptions.

## 3. Current visual direction

### Global

- plausible near-future engineering, not ornamental science fiction
- readable 3/4 isometric presentation for strategy assets
- soft daylight from upper left, shadows lower right
- transparent background for freestanding game assets
- no generated or baked-in text
- canonical in-game branding is `noχ1ᐃ`, not `NOXIA` and not `noχ1Δ`
- branding is sparse and only used where the operator/lore justifies it

### Earth / Sauerland

The target is a believable Sauerland landscape with forests, meadows, fields, streams, rural roads, ordinary regional buildings and near-future Hub infrastructure embedded in the existing landscape.

The world must **not** look like an isolated science-fiction colony.

## 4. Continuous-world decision

The old presentation of one complete illustrated rhombus per logical map cell is deprecated.

Target presentation:

- no visible player-facing tile grid
- visually continuous/unbounded world
- terrain built from calm base materials, transition/edge graphics, decals and independent detail sprites
- roads and rivers treated visually as continuous linear systems
- fields and land-use areas treated visually as coherent areas, not repeated isolated diamonds
- chunk boundaries, if used by runtime, must never be encoded into the art

The recently generated rhombus terrain and transition images are **style references and source studies**, not a mandate to render every world cell as a standalone diamond.

## 5. Asset production rule

> An asset is successful when it composes well with many neighbours, not when it is maximally impressive in isolation.

For terrain this means:

- low landmark density in base materials
- no conspicuous repeated flower/stone pattern
- major rocks, flowers, shrubs and tufts should usually be separate detail sprites
- transition graphics must be irregular and natural, never ruler-straight
- avoid strong lighting baked into flat terrain materials that conflicts when repeated

For buildings/vehicles:

- preserve stable scale, camera and ground anchor
- remove rectangular AI-image backgrounds
- do not accept malformed text, signage or interface fragments

## 6. Production-image workflow — binding

This section prevents the graphics process from drifting back into attractive but unusable reference boards.

### 6.1 Generate production assets individually

When the current request is for production assets, generate **one usable asset per output image** unless a sprite sheet is explicitly part of the asset contract.

Do **not** substitute:

- overview boards
- contact sheets
- labelled atlases
- infographic panels
- multiple unrelated assets composed into one image

Such sheets are allowed only when the user explicitly asks for a reference/overview sheet. They are never a replacement for the individual source assets.

### 6.2 Terrain materials are not visible tiles

For continuous-world terrain, base materials should be authored as source material for large-area composition:

- no visible rhombus/frame as part of the final material concept
- no exposed soil side wall implying a floating tile
- no vignette/background belonging to a presentation image
- no baked landmark decoration that repeats once per material sample
- quiet texture first; visual richness comes from separate detail layers

Rhombus studies may still be used to calibrate perspective, palette and density, but remain reference-only unless a specific technical asset contract requires that shape.

### 6.3 Separate asset families

Do not bake several responsibilities into one image.

Keep separate:

- base terrain material
- transition/blend overlay
- micro-detail sprite
- vegetation sprite
- linear feature art (road/river/hedge/etc.)
- building/vehicle/prop

A meadow material should not contain the one memorable rock, flower patch, bush and puddle that should instead exist as reusable detail assets.

### 6.4 Production order

For Sauerland continuous terrain, follow the queue in `GRAPHICS-REQUESTS.md` and complete one family to reviewable quality before opening several new families in parallel.

Current priority order:

1. calm meadow material family
2. earth material family
3. gravel / rocky-ground families
4. meadow ↔ earth transition kit
5. remaining terrain transitions / field margins
6. micro-detail library
7. vegetation
8. water
9. roads / paths
10. building rebuild/integration

### 6.5 Naming and destination

Production files must use stable, descriptive names and live under the appropriate Sauerland asset subtree. Prefer family/version names such as:

- `terrain/materials/meadow/meadow_base_01.*`
- `terrain/materials/earth/earth_base_01.*`
- `terrain/transitions/earth/earth_edge_01.*`
- `terrain/details/grass/grass_tuft_01.*`
- `terrain/details/rocks/rock_small_01.*`

Do not use generated prose filenames as canonical asset names.

### 6.6 Reference vs production status

Every generated image is **reference-only by default** until it passes the acceptance checks below and has an intended production path.

Do not commit every chat generation automatically. Keep only assets that advance the active graphics request.

## 7. Production vs reference acceptance

An image is **reference-only** until it has been checked for:

- correct camera/perspective
- transparent or otherwise intended background
- clean edges/alpha
- no unwanted text or generated artifacts
- correct asset scale
- compatibility with neighbouring assets
- no presentation-only background, vignette, border or tile sidewall unless explicitly required
- intended usage recorded in the Sauerland asset README or a graphics request

Do not infer production readiness merely because a file exists in the repository.

## 8. Request/handoff protocol

Every non-trivial graphics build should have an entry in `docs/visual/GRAPHICS-REQUESTS.md` with:

- request ID
- status
- purpose
- deliverables
- visual constraints
- intended usage
- acceptance criteria
- output paths
- unresolved questions

When finishing a graphics build, update that request instead of leaving the next agent to infer what happened.

Recommended statuses:

- `QUEUED`
- `IN_PROGRESS`
- `REVIEW`
- `ACCEPTED`
- `SUPERSEDED`
- `BLOCKED_TECH` (graphics requirement is clear, technical integration belongs elsewhere)

## 9. Do not silently reinterpret

If an existing asset cannot satisfy the current visual contract, mark it provisional/superseded in the request or asset notes. Do not silently repurpose it for a different meaning.

If the desired graphic requires a technical capability that is not yet present, produce/define the asset contract and record `BLOCKED_TECH`; do not modify runtime code from the graphics branch.
