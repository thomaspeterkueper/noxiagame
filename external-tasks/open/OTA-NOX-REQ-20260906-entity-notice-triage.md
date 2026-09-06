# OTA entity-notice request triage

Status: OPEN
Owner: NOXIA
Date: 2026-09-06

The open OTA entity/discovery requests were reviewed while rebasing the dashboard/map work onto the current dashboard architecture.

## Rule
Only identifiers already owned and evidenced by NOXIA may be emitted from this repository. Do not invent canonical IDs to satisfy an external notice request.

## Already evidenced in NOXIA
The Tharsis request can reuse existing NOXIA-owned identifiers where present, including the established ECLSS, logistics packing, K5 control-room and `UTILITY_NODE:MARS:THARSIS_HUB:*` identities.

## Still requires source-of-truth resolution
Do not synthesize identifiers for concepts such as `MEDICAL_CORE`, `REACTOR_MODULE` or `MATERIAL_COMPLEX` unless an existing NOXIA-owned canonical entity is found. If ownership belongs to another repository, create/follow the corresponding external request there instead of changing that repository directly.

## Separation from map work
This task is deliberately separate from the Grid / Map / Terrain PR. Entity notices are discovery/integration work and must not be coupled to dashboard rendering changes.
