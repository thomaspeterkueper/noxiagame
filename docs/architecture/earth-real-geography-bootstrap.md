# Earth real-geography bootstrap

Status: accepted implementation direction

NOXIA Earth is a spatial simulation of Earth, not a fictional rectangular board.

## First playable region

The first streaming origin is the Sauerland region in Germany. The initial data window is deliberately limited for development performance, but it is not a gameplay border. Adjacent Earth chunks can be streamed indefinitely.

The future aerospace/research cluster is treated as a new simulation layer over the real landscape. It does not replace the underlying settlements, forest, waterways, roads or terrain.

Working identity: **Technikstandort Deutschland · Sauerland**.

## Geography source

For the present-day bootstrap, OpenStreetMap-compatible data is the preferred source for roads, rail, waterways, water, forest/landuse, settlements and building footprints. Provider-specific fetching is isolated behind `EarthFeatureSource`; gameplay and canon must not depend directly on an Overpass response shape.

The imported source metadata and licence attribution must remain attached to derived spatial records. Historical and future datasets may later replace or augment individual layers by epoch.

## Rendering

Real geometry is authoritative. Existing NOXIA Earth raster/tile graphics may be reused as the visual vocabulary for grass, forest, farmland, water and urban surfaces when appropriate. A tile image must never create geography that is absent from the spatial layer.

At close zoom the renderer may use individual 10 m simulation cells and building footprints. At wider zoom it should aggregate geometry instead of trying to draw every cell.

## Future infrastructure

Spaceport, SSF/academy, research, logistics, energy and industrial facilities are future simulation entities with explicit footprints. Their placement should respect the real landscape and prefer plausible transport corridors. They are not encoded into imported terrain.

## Temporal use

Every spatial layer is epoch-aware. The same coordinate system can therefore support a future NOXIA Earth as well as later historical scenarios without inventing separate maps.
