# NOXIA Graphics Requests

Status: **shared graphics-only work queue**

Purpose: make visual requests, intended usage and acceptance criteria visible to any agent working on the graphics branch.

Do not use this file to request simulation, database, renderer or world-model changes.

## Request format

Each request should contain:

- **ID**
- **Status** (`QUEUED`, `IN_PROGRESS`, `REVIEW`, `ACCEPTED`, `SUPERSEDED`, `BLOCKED_TECH`)
- **Purpose**
- **Deliverables**
- **Visual constraints**
- **Intended usage**
- **Acceptance criteria**
- **Output paths**
- **Notes / unresolved questions**

When a build is completed or replaced, update the request instead of silently leaving old assets in an ambiguous state.

---

## GFX-SAU-001 — Continuous terrain foundation

**Status:** IN_PROGRESS

**Purpose:** replace the visible one-rhombus-per-cell look with a terrain art foundation suitable for a visually continuous, effectively unbounded Sauerland world.

**Deliverables:**

- calm meadow material family
- dark/damp grass family
- earth family
- gravel family
- rocky-ground family
- ploughed-field family

**Visual constraints:**

- Sauerland, realistic but strategy-readable
- avoid dense repeated flower/stone patterns
- no baked text
- no visible frame or artificial tile border
- high-interest details should mostly move into independent detail sprites

**Intended usage:** repeating/composable ground source material, not a complete illustrated game cell.

**Acceptance criteria:**

- large-area test does not look like wallpaper
- variants blend into one another
- no single landmark repeats obviously
- compatible with transition and detail layers

**Output paths:** target under `public/assets/environments/earth/sauerland/terrain/`

**Notes:** recently generated decorated rhombus terrain images are style/source studies; production materials should be quieter.

---

## GFX-SAU-002 — Terrain transition kit 1.0

**Status:** QUEUED

**Purpose:** create natural, reusable terrain boundaries without requiring a unique full tile for every terrain-pair combination.

**First pass:** meadow ↔ earth.

**Deliverables:**

- irregular edge studies
- inner/outer corner studies
- sparse-grass/soil blend variants
- small stones/weeds usable as transition accents

**Visual constraints:**

- no ruler-straight boundary
- transitions must compose with calm base materials
- no large unique landmark baked into every edge

**Intended usage:** composable transition/edge graphics over or between base materials.

**Acceptance criteria:** transition remains natural across repeated and rotated/varied use; underlying grid should not become visible.

---

## GFX-SAU-003 — Terrain micro-detail library

**Status:** QUEUED

**Purpose:** move visual richness out of the repeating base materials.

**Deliverables:**

- grass tufts
- flower clusters
- weeds
- small stones
- medium stones/rocks
- bare patches
- optional fern/bracken set

**Visual constraints:** transparent background; consistent light; readable at strategy zoom; several density/size variants.

**Intended usage:** independent detail layer scattered over terrain materials.

**Acceptance criteria:** enough diversity to break repetition without making every square metre visually busy.

---

## GFX-SAU-004 — Sauerland vegetation library

**Status:** QUEUED

**Purpose:** build forests, woodland edges, hedges and isolated vegetation without baking them into terrain cells.

**Deliverables:**

- conifer variants
- broadleaf variants
- birch variants
- shrub/bush variants
- hedge segments and endpoints
- woodland-edge clusters later

**Visual constraints:** transparent sprites, stable ground anchor, same camera/light family as other Earth assets.

**Intended usage:** independent world objects/details above terrain.

---

## GFX-SAU-005 — Continuous river/stream system

**Status:** QUEUED

**Purpose:** replace disconnected blue circles/rectangles with believable continuous water and banks.

**Deliverables:**

- narrow stream family
- wider stream/river family
- straight/bend/S-bend forms
- confluence/branch forms
- banks and bank transitions
- gravel/mud accents
- bridge-compatible bank studies

**Visual constraints:** water must read as one continuous feature; no marker-like geometry.

**Intended usage:** continuous linear landscape system.

---

## GFX-SAU-006 — Roads and paths continuous set

**Status:** QUEUED

**Purpose:** establish roads/paths that visually cross the terrain continuously rather than as isolated road diamonds.

**Deliverables:**

- rural asphalt
- gravel road
- farm/dirt track
- footpath
- service-road family
- curves/junction visual states
- verge and terrain-transition accents

**Intended usage:** continuous linear landscape system.

---

## GFX-SAU-007 — Agricultural boundary kit

**Status:** QUEUED

**Purpose:** make fields read as real land-use areas rather than painted terrain blends.

**Deliverables:**

- grass verge
- irregular soil margin
- hedge-border studies
- shallow ditch studies
- compacted field access
- field-corner details

**Visual constraints:** Sauerland agricultural character; boundaries may be explicit and physical.

---

## GFX-SAU-008 — Existing building sprite audit/rebuild

**Status:** QUEUED

**Purpose:** replace provisional building WebPs that contain rectangular backgrounds, generated fragments, bad scale or inconsistent perspective.

**Deliverables:**

- list of accepted/superseded building sprites
- clean transparent replacements
- consistent scale/camera/ground anchor

**Visual constraints:** ordinary regional buildings and believable near-future Hub structures must coexist visually.

**Acceptance criteria:** no rectangular AI-image background, broken text, malformed signage or perspective mismatch.

---

## GFX-SAU-009 — Large-area graphics composition test

**Status:** BLOCKED_TECH

**Purpose:** validate the new terrain/material/transition/detail art in a large Sauerland scene at overview and close zoom.

**Graphics deliverable:** define and provide the accepted source assets and visual composition examples.

**Technical dependency:** actual runtime composition/streaming belongs to the renderer/development thread and must not be implemented from this graphics branch.

**Acceptance criteria:** when integrated technically, the result should show no visible cell/chunk grid, no wallpaper repetition, continuous roads/water and coherent fields/vegetation.
