# Map / Terrain — Zoom & Layer Controls

Date: 2026-09-06

Implemented on `work/map-zoom-layers-controls`:

- Earth map zoom ceiling raised from 16x to 128x so the camera can move well below the previous ~100 m scale.
- Scale choices extended down to 2/5/10/20 m.
- Compass and metric scale moved to the upper-left corner as transparent floating map chrome without white cards.
- Added a compact in-map cockpit layer controller for DEM relief, land use, water, infrastructure, buildability, slope, NOXIA buildings and candidate sites.
- Resource layer is explicitly shown as unavailable instead of inventing data.
- Added first DEM-derived relief surface by consuming the canonical `/api/earth/buildability` terrain samples and deriving directional relief shading from neighboring elevations.
- Added optional buildability and slope analysis overlays from the same terrain surface.
- Existing OSM land-use/water/infrastructure feature groups are now independently toggleable.
- Existing and pending NOXIA building overlays remain independently toggleable.

This is intentionally still renderer-local UI. The next architectural step remains the shared map runtime/controller requested by the Dashboard/Cockpit workstream so these layer and placement states can be consumed outside `EarthRegionPreview` without duplicating truth.
