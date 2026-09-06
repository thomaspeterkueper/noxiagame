# ADR — Dashboard map uses the canonical metric world

The Earth/Sauerland dashboard map renders local metric world coordinates. Geographic source features are converted to local metres around the region origin before viewport projection. Pan, zoom, scale bars, terrain surfaces and future building footprints share the same metric camera.

Legacy tile row/column coordinates must not be reinterpreted as metres. A building overlay is enabled only after its placement proves the same verified world frame/region anchor. Terrain elevation remains authoritative through the terrain sampling boundary; NoData remains unresolved and the client never invents `z_m`.

The current dashboard/cockpit remains presentation-only. The map owns viewport measurement and observes the rendered map element after region data loads, so fullscreen/resizing changes viewport dimensions without replacing the world-space camera model.
