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

## 6. Production vs reference

An image is **reference-only** until it has been checked for:

- correct camera/perspective
- transparent or otherwise intended background
- clean edges/alpha
- no unwanted text or generated artifacts
- correct asset scale
- compatibility with neighbouring assets
- intended usage recorded in the Sauerland asset README or a graphics request

Do not infer production readiness merely because a file exists in the repository.

## 7. Request/handoff protocol

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

## 8. Do not silently reinterpret

If an existing asset cannot satisfy the current visual contract, mark it provisional/superseded in the request or asset notes. Do not silently repurpose it for a different meaning.

If the desired graphic requires a technical capability that is not yet present, produce/define the asset contract and record `BLOCKED_TECH`; do not modify runtime code from the graphics branch.
