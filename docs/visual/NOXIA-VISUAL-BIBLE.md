# NOXIA Visual Bible

Status: canonical presentation guide for NOXIA-owned game visuals

## 1. Core direction

NOXIA uses plausible near-future engineering rather than ornamental science fiction. Every object should look buildable, maintainable and used. Materials, interfaces and geometry must communicate function before spectacle.

The world should feel inhabited: service access, pressure doors, cable runs, inspection hatches, warning markings, dust, repair seams, storage, pipes and utility connections are preferred over smooth anonymous shells.

## 2. Exterior strategy assets

- Primary camera: consistent 3/4 isometric view, approximately 30-35° downward pitch.
- Lighting: soft directional daylight from upper left; readable shadow footprint to lower right.
- Background: transparent for game assets.
- Silhouette: immediately recognisable at strategy zoom.
- Detail: large functional masses first; small texture second.
- No text baked into images.
- No logos unless they are canonical NOXIA/SSF markings.
- Exterior assets must preserve a stable ground anchor around x=0.5, y=0.82 unless overridden by metadata.

### Mars

Oxidised red/brown dust, pale structural ceramics, anodised aluminium, dark pressure seals, muted utility yellow, limited blue status light. Equipment is dust-loaded and exposed components are protected by boots, covers and service housings.

### Moon

Higher contrast, pale regolith contamination, foil/ceramic insulation, darker radiators and hard-edged shadows. Less atmospheric weathering than Mars.

### Earth

Cleaner fabrication, more glass and conventional logistics infrastructure, vegetation only where canonically appropriate.

### Phobos

Compact, anchored, heavily braced structures. Surface equipment should look mechanically fixed to the substrate.

## 3. Building identity

A canonical building ID defines function. Visual assets are replaceable representations and must never become simulation state.

Each important building may have:

- exterior-isometric
- exterior-detail
- construction-foundation
- construction-frame
- construction-systems
- construction-commissioning
- interior-entry
- interior-main
- optional specialist rooms
- optional animation sprite sheet

The same building must remain recognisable across exterior, construction stages and interiors.

## 4. Interiors

Interior images use perspective scenes rather than isometric presentation. Target composition is 16:9 or 3:2.

- believable circulation and door placement
- visible life-support and maintenance access
- restrained UI/holography
- practical lighting with local task lights
- props communicate role and inhabitants
- no empty showroom interiors

Rooms are locations, not decorative backdrops. Entry, main room and specialist rooms should connect spatially and visually.

## 5. NPCs

NPC identity is data-owned; visual_profile_id selects presentation.

Portrait standard:
- chest/shoulder portrait
- neutral or role-appropriate background
- consistent focal length and lighting family
- believable work clothing rather than superhero costumes

World sprite standard:
- readable full-body silhouette
- consistent scale
- transparent background
- animation authored as controlled frame strips (idle/walk/work), not unconstrained per-frame regeneration

## 6. Animation

Preferred runtime formats:

1. Sprite sheet + CSS/Canvas stepping for deterministic NPC and machinery cycles.
2. Animated WebP/APNG for self-contained environmental loops.
3. GIF only when interoperability is more important than compression/alpha quality.

Animation must not change simulation state. It visualises a state already supplied by the game.

## 7. Initial Mars reference set

The first calibration set is:

- habitat
- solar
- water_recycler

These three objects establish scale, materials, lighting, anchors and service-footprint language before the full catalogue is generated.

## 8. Asset acceptance criteria

An asset becomes canonical presentation only when:

- it maps to a canonical entity ID;
- its world/view metadata is registered in the asset catalogue;
- it is legible at intended zoom;
- perspective and ground anchor match the reference set;
- it does not contradict the building definition or world canon;
- replacement of the image requires no simulation migration.

## 9. Continuous-world terrain

For Earth/Sauerland and other large surface environments, the player-facing world should not expose a tile or chunk grid.

Terrain art is authored as composable visual layers:

- calm base terrain materials
- transition/boundary graphics
- independent micro-detail sprites
- continuous visual systems for roads, paths, rivers, hedges and similar linear features
- area-based land-use graphics such as fields/forest floor
- freestanding vegetation, buildings and props

A technical renderer may internally use cells, chunks or sectors, but these boundaries must not be encoded visibly into the art.

The old pattern of one highly decorated rhombus image per logical world cell is deprecated as a final visual approach because repetition exposes the grid and creates a wallpaper effect.

For base terrain, composition quality across large areas is more important than isolated-tile beauty. Large memorable rocks, flower clusters and other high-frequency details should usually be separate visual elements rather than repeated inside every ground material.

Earth/Sauerland-specific rules and the current build sequence are defined in `docs/visual/SAUERLAND-INFINITE-TERRAIN.md`.

## 10. Graphics-agent coordination

Graphics work must be transferable between agents without relying on chat history.

Before editing Sauerland graphics, agents should read:

1. this visual bible;
2. `docs/visual/GRAPHICS-AGENT-HANDOFF.md`;
3. `docs/visual/SAUERLAND-INFINITE-TERRAIN.md`;
4. `docs/visual/GRAPHICS-REQUESTS.md`;
5. `public/assets/environments/earth/sauerland/README.md`.

The graphics branch must not be used for simulation, database, renderer, API, coordinate or world-model changes. If a graphics request exposes a technical dependency, document it and hand it to the appropriate development thread rather than implementing it here.
