# ADR — Dashboard map uses the canonical metric world

## Status
Accepted for the Grid / Map / Terrain workstream.

## Decision
The Earth/Sauerland dashboard map is a renderer over local metric world coordinates. Geographic source features are converted to local metres around the region origin before viewport projection. Pan, zoom, scale bars, future terrain surfaces and future building footprints share the same metric camera.

Legacy tile row/column coordinates are not reinterpreted as metres. A building overlay may only be enabled when its placement can prove that it belongs to the same verified world frame/region anchor as the map.

Terrain elevation remains authoritative only through the terrain sampling boundary. NoData remains unresolved and the client does not invent or author `z_m`.

## Dashboard integration
The current dashboard/cockpit remains presentation-only. The map component owns its viewport measurement and observes the actual rendered map element after region data has loaded. Resizing/fullscreen changes viewport dimensions without changing the camera's world-space centre or scale.

## Consequences
- 2D, fullscreen and later isometric views can project the same world state.
- Metric footprints preserve physical width, depth and rotation.
- Terrain hillshade is a derived render property and never mutates canonical elevation.
- The old normalized 1000×1000 latitude/longitude projection is compatibility debt and must not become a persistence model.
