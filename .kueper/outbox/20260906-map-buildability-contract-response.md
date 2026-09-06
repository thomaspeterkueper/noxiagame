# Map / Terrain response — buildability and inspection contract

Source workstream: Grid / Map / Terrain (#69)
Target consumer: Dashboard / Cockpit UI
Date: 2026-09-06

## Stable semantic layer IDs
- `terrain-height`
- `terrain-hillshade`
- `terrain-contours`
- `buildability`
- `water`
- `slope`
- `resources`
- `infrastructure`

## Terrain inspection payload
The map exposes local metric coordinates and optional observed/derived fields when available: geographic position, elevation, slope, aspect, substrate class, grid size, buildability state and buildability reason. Missing source data stays absent/unresolved.

## Buildability states
- `buildable`
- `restricted`
- `invalid`
- `unresolved`

## Physical gate
Physical buildability is evaluated before usage/infrastructure restrictions. Missing DEM/slope is unresolved; water is invalid by default; slope thresholds are supplied by the canonical build policy rather than hard-coded in the renderer. Usage/infrastructure restrictions may downgrade a physically buildable/restricted cell but cannot override physical invalid/unresolved states.

## Zoom-dependent grid
The renderer may expose a buildability grid when a cell reaches at least 12 screen pixels at the current metric camera scale. This keeps regional views clean and makes the grid appear only when cells become meaningfully inspectable/selectable.

## Placement state
The cockpit may consume `active`, `buildTypeId`, `footprint`, `state`, `reason`, `canPlace`, and `canCancel`. Commit is allowed only for a complete `buildable` placement with a real metric footprint.

## Viewport API
`GET /api/earth/buildability` accepts a metric viewport (`minXM`, `minYM`, `maxXM`, `maxYM`) plus explicit physical slope thresholds (`maxBuildableSlopeDeg`, `maxRestrictedSlopeDeg`). Optional repeated `rule=` values apply usage/infrastructure restrictions as `featureClass:restricted|invalid:reason[:bufferM]`.

The response keeps `planningCellSizeM` separate from observed terrain resolution, returns DEM-derived slope in degrees, buildability state/reason and matched source feature IDs, and never advertises the current Copernicus GLO-90 bootstrap terrain as finer than 90 m. Water/waterways enter the physical gate directly.

## Map overlay chrome
The previous `Sauerland 2086` legend box in `EarthRegionPreview` has been removed. It is replaced by a compact north-orientation marker and a zoom-aware metric scale bar. Dashboard chrome remains outside the map renderer.
