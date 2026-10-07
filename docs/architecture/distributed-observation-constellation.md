# Distributed Observation Constellation (DOC)

Status: architecture seed / reality anchor
Date: 2026-10-07

## Purpose

NOXIA should treat world knowledge as observations with provenance, time and uncertainty rather than as an omniscient static map.

Core pipeline:

`observation -> source/sensor -> observed_at -> spatial resolution -> confidence/uncertainty -> interpretation -> world-state claim`

A claim can therefore be current, stale, inferred, contradicted or superseded.

## Architecture principle

Many comparatively small observation nodes form a resilient constellation. Nodes may be orbital sensors, surface stations, vehicles, robots, NPC observations, public geodata or other trusted sources. The architecture is modality-agnostic: optical, radar/SAR, environmental, communications and later fictional sensors can feed the same observation layer.

This connects NOXIA's MiniNode/swarm idea to planetary-scale observation:

`MiniNode -> local swarm -> distributed sensor network -> orbital constellation -> shared world model`

The common abstraction is a distributed set of partially independent nodes whose aggregate is more robust and informative than any single node.

## Integrity of Observation

Every imported or generated observation SHOULD retain:
- source identity/type and provenance
- observation timestamp and ingestion timestamp
- spatial footprint/resolution
- modality
- confidence/uncertainty
- transformation/interpretation history
- license/usage constraints where external data is involved

Derived world-state claims MUST remain traceable to their observations.

## Temporal world model

Do not collapse observations directly into timeless truth. Preserve change:

`World(t0) -> World(t1) -> World(t2)`

This supports changing coastlines, settlement growth, infrastructure, vegetation, weather/environmental change and planetary colonisation. The runtime may distinguish:
1. last directly observed state,
2. best current fused estimate,
3. simulated/projected state.

This is an application of Timescale Engineering: observation cadence and simulation cadence need not be identical.

## Place discovery / knowledge acquisition

When a requested place is missing, NOXIA may query multiple permitted sources, normalize the observations, record provenance and construct a candidate place representation. Validated knowledge can then be persisted so later sessions do not have to rediscover the same place.

Conflicting sources are evidence, not an error to hide. Fusion should retain disagreement and choose a best estimate explicitly.

## NPC epistemics

NPC knowledge should use the same model. An NPC can know a place without having visited it if a plausible information path exists (map, network, another NPC, observation service, prior record). Dialogue can therefore distinguish direct experience, reported knowledge and inference.

## Reality anchor: Rheinmetall / ICEYE, 2026

Rheinmetall ICEYE Space Solutions began industrial SAR-satellite production in Neuss in 2026, combining production, integration, testing and quality assurance. Public material describes compact Gen4 SAR satellites, weather/day-night observation, scalable constellations, AI-supported processing and an open architecture intended to integrate additional sensor modalities.

The reference is architectural, not a requirement to reproduce military ISR use cases. NOXIA reuses the civilian/general systems lessons: distributed sensing, provenance, revisit cadence, multimodal fusion, resilience and scalable node production.

Sources:
- https://www.rheinmetall.com/de/media/news-watch/news/2026/10/2026-10-06-rheinmetall-iceye-space-solutions-stellt-bundeswehr-zugriff-auf-sar-satelliten-bereit
- https://www.rheinmetall.com/de/media/news-watch/news/2026/06/2026-06-10-rheinmetall-auf-der-ila-souveraenitaet-durch-sar-satelliten-rheinmetall-und-iceye-staerken-die-weltraumgestuetzte-aufklaerung
- https://www.rheinmetall.com/de/media/news-watch/news/2026/06/2026-06-10-rheinmetall-iceye-space-solutions-buendelt-deutschlands-new-space-kompetenzen-fuer-souveraene-weltraumaufklaerung

## Implementation direction

Start with the data contract, not satellite simulation. Define Observation, Source, WorldStateClaim and EvidenceLink primitives; then use them first for real-place acquisition and NPC knowledge. Orbital constellations can later become another producer of the same Observation objects.


## Implemented cognition bridge

The first shared data contract now lives in `lib/game/cognition/observation.ts`. `npcObservationMemory.ts` projects a person's own observation into the existing relational memory runtime while preserving provenance. This deliberately does not persist every visual frame: the next integration boundary is a salience/change filter at the authoritative person runtime so only meaningful observations become memories.

The client `localFacts`/nearby-place payload remains a dialogue grounding aid until that authoritative projection is wired. It must not be treated as durable NPC knowledge merely because it was included in an LLM prompt.
