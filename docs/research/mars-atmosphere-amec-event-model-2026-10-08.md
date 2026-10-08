# Mars atmosphere: observationally constrained event model (2026-10-08)

Status: design proposal; not yet integrated into runtime or database.

## Evidence and interpretation

The Arsia Mons elongated cloud is a seasonal morning water-ice phenomenon associated with the volcanic topography. Recent modelling indicates that homogeneous ice nucleation under exceptional supersaturation may explain aspects of its formation. This is a model-supported hypothesis, **not** direct confirmation of the microscopic process in situ. Do not label it a new physical law.

Reference: https://www.heise.de/news/Aussergewoehnliche-Riesenwolke-auf-dem-Mars-entsteht-wohl-durch-exotische-Physik-11480432.html
Original study: https://doi.org/10.1038/s41561-026-02089-9

## Audited existing boundaries

- `lib/world/spatial/marsSpatial.ts`: canonical Mars coordinates / metric regions / Tharsis anchor.
- `lib/game/spatial/planetary.ts`: planetary reference and conversion.
- `lib/game/spatial/marsTerrainRuntime.ts`: MOLA raster sampling with verified cached data.
- `docs/project-workstreams.md`: Mars owns environment; Core owns time, ticks and persisted shared state.

There is no verified existing cloud-physics interface from this initial audit. Search other runtime modules before integration; do not infer absence from incomplete search-index results.

## Proposed minimal contract

Atmospheric **input**, by region and simulation time:
- measured/assimilated or explicitly modelled air temperature K; pressure Pa; water-vapour mixing ratio; dust/ice nuclei proxy; local wind vector; solar/local time and season Ls;
- topographic slope/elevation from the *existing* Mars terrain sampler;
- provenance, units, source time, confidence and model version for every field.

Atmospheric **output**:
- event identifier (Mars region / time window), process hypothesis (heterogeneous, homogeneous, undetermined), event probability or activation criterion, cloud extent / altitude band / opacity, model confidence and uncertainty, observation provenance;
- explicit `unresolved` when required inputs or terrain coverage are missing (never silently invent cloud or flatten missing terrain).

## Incremental implementation

1. Add a pure deterministic, coarse-resolution atmospheric event evaluator under `lib/game/mars/` or the established environment domain after checking existing modules. No network calls or LLM in the physics loop.
2. Record the same canonical simulated atmospheric state for strategic map and walkable view; render cloud visibility as a projection.
3. Evaluate only affected regions when relevant environmental state or coarse time bucket changes; persist compact events only when gameplay-relevant. Cache by region, time bucket, model version and input digest.
4. Keep homogeneous nucleation behind a model hypothesis flag. Prefer threshold envelopes calibrated to scientific observations, **not** an unjustified universal supersaturation constant. Compare against a dust-mediated baseline.
5. Add tests for morning formation/afternoon dissipation *as observed*, seasonality, numerical boundaries, missing inputs/terrain, determinism, conservation where applicable, and no duplicated tick event.
6. Track costs: number of evaluated regions, compute milliseconds, persisted records, cache-hit ratio and rendered events.

## Scientific integrity and acceptance

- Distinguish observations, inferred mechanisms and invented game parameters.
- Calibration must document observational source, dates and coordinates. Do not claim measured high-altitude humidity data if unavailable.
- A known event must be reproducible with a documented reference scenario, while nearby/off-season counterexamples remain possible.
- Must not add database migrations, remote weather APIs, blanket per-frame recalculation or new services until the shared runtime and existing schema are inspected.
- No automatic propagation of experimental hypothesis to AVI/OTA/SSF canon: submit evidence with uncertainty separately.

## Integration checkpoints

- Locate existing environment/weather components and Core tick scheduling.
- Confirm whether there are established climatic source and observability interfaces.
- Implement and test a small isolated pure module, then expose it through the shared environmental state.
- Only afterwards add optional event persistence / rendering, in a separate reviewed change.
