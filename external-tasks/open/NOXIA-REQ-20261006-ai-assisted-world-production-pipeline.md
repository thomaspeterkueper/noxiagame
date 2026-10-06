# NOXIA Request: AI-assisted World Production Pipeline

Origin: Taipei GTA / indie-AI production research, 2026-10-06
Priority: high

## Goal
Turn NOXIA world production into a repeatable, cost-aware pipeline rather than generating each world, building, NPC, asset and mission ad hoc.

## Pipeline
world requirements -> canonical world/body data -> LocalSurfaceScene adapters -> resource discovery/reuse -> asset generation/adaptation -> optimization -> semantic metadata -> buildings/entrances/interiors -> NPC placement/knowledge -> missions/events -> automated validation -> deployment.

## Resource Acquisition Layer
Before generating or commissioning an asset, search reusable resources in this order:
1. existing NOXIA assets/components
2. authoritative/open scientific and geographic datasets
3. verified CC0/public-domain asset libraries
4. attribution-compatible open assets where operationally acceptable
5. procedural generation from canonical parameters
6. local/open-source generative tooling
7. paid hosted generation or bespoke production only when the earlier tiers are insufficient.

Maintain an asset manifest with source URL/provider, creator where relevant, exact license and verification date, modification history, file hash/version, formats, triangle/texture budgets, attribution requirements and downstream usage.

Candidate resource classes: modular low-poly 3D, PBR materials, HDRIs, UI/icons, SFX/music, rigged characters/animations, terrain/geodata, planetary maps/elevation, scientific reference imagery and procedural generators.

## Runtime principle
Prefer development-time generation + persisted deterministic assets/state. Runtime AI is reserved for semantic openness that materially improves play. Navigation, collision, ownership, prices, geography, building existence/entrances and other authoritative world facts must not depend on an LLM response.

## World Identity Layer
Define reusable identity descriptors per place/body: geography/topography, architecture, materials, transport, characteristic objects, vegetation/environment, language/signage, economy, population routines, history and scientific constraints. Generated/reused assets must conform to these descriptors.

## Mission/content generation
Generate candidate content from authoritative world state:
location + actor goals + relationships + economy/resources + events + knowledge graph -> constrained mission/event candidate -> rule/state validation -> persistence.
Do not let generated prose invent authoritative facts.

## Production readiness gates
For 3D assets validate topology, UV/materials, triangle budget, texture budget, LODs, collisions, scale/orientation, glTF/GLB compatibility, visual identity and provenance/license. Separate prototype assets from production assets.

## Cost accounting
Record estimated/actual cost per accepted asset, mission and world increment: hosted model tokens/API cost, human review time, storage/bandwidth and runtime inference. Track rejection/rework rate. Prefer reuse and local deterministic transforms when quality is sufficient.

## Automation candidates
- license-aware asset search/import
- automatic GLB optimization/LOD/collision generation
- screenshots/previews and visual regression checks
- semantic asset manifests
- procedural building variants
- mission validation against world state
- automated browser/playability tests
- duplicate asset detection
- asset budget and inference-budget CI checks

## Research inputs
Review 2026 AI-native-game work emphasizing mechanical invariants and inference economics; production-ready 3D research emphasizing topology/UV/PBR/rigging/physics requirements; and current open-source game-production tooling.

## Acceptance criterion
A new settlement/world-body scene can be expanded from canonical data using the same pipeline, with measurable provenance, quality and cost, without breaking shared Earth/Moon/Mars/Phobos/Deimos primitives.