# Urban subsidence and dynamic coastlines — source assessment v0.1
Date: 2026-10-13. Status: DATA CANDIDATE; not ingested.

Primary source: Wang et al., Nature Cities (2026), DOI https://doi.org/10.1038/s44284-026-00527-8
Public dataset: https://doi.org/10.24433/CO.7021098.v2
Source visualization: https://ee-pkurelab.projects.earthengine.app/view/gus

Scope: Sentinel-1 InSAR 2014–2023; relative local land subsidence for 465 cities. Includes coherence and uncertainty fields, reference locations and optional global VLM alignment. Do not equate relative InSAR velocities with absolute geocentric vertical land motion. The VLM correction itself adds uncertainty.

Coastal model: local relative sea-level trend ≈ geocentric sea-level trend − vertical land-motion trend, with a consistent sign convention, reference frame and epoch. Coastline geometry additionally depends on topography/bathymetry, sediment supply, erosion, hydrology, barriers and extreme events. Never extrapolate ten-year urban rates across centuries uncritically.

Proposed ingestion: license/access verification; file inventory and schema; coordinate reference system and vertical datum; per-cell validity and coherence; uncertainties/covariance; baseline epoch; city extent; local trend and acceleration; provenance/version; coverage gaps. Store as independent observational layer, never overwrite terrain heights or infer floods directly.

NOXIA: initially optional research overlay with explicit scenario horizon. Dvārakā: conceptual geoscience reference, not proof of any specific ancient event. No production geography changes before a calibrated validation case.
