---
id: EXT-NOXIA-OTA-20260914-FLEX-PHOTOSYNTHESIS-STATE-MODEL
title: Use ESA FLEX as scientific reference for dynamic biosphere state modelling in noχ¹ᐃ
status: open
source: OTA
target: NOXIA
created: 2026-09-14
priority: medium
affects: [NOXIA, OTA]
sourceDocuments: []
---

## Anlass

ESA's FLEX (Fluorescence Explorer) mission is scheduled to launch with Copernicus Sentinel-3C on 15 September 2026 aboard Vega-C. FLEX carries the Fluorescence Imaging Spectrometer and is designed to map faint vegetation fluorescence associated with photosynthetic activity. ESA states that the mission will provide the first global maps of vegetation fluorescence at approximately 300 m x 300 m spatial resolution and improve understanding of plant health, productivity, carbon exchange and responses to environmental stress.

The mission is useful for noχ¹ᐃ not primarily as a satellite asset, but as a real scientific reference for a modelling distinction that is currently easy to collapse:

> `land cover / vegetation type` is not the same state variable as `current biological function`.

A forest, cropland or grassland tile can retain the same visible class while its photosynthetic activity changes substantially with water availability, heat, season, radiation, disease or other stress.

## Requested noχ¹ᐃ action

Introduce or reserve a dynamic vegetation/biosphere state layer that is distinct from static or slowly changing terrain and land-cover classification.

A minimal conceptual state could distinguish:

- `vegetation_type` — structural/ecological class;
- `photosynthetic_activity` — normalized functional activity or productivity proxy;
- `water_stress` — current hydrological stress;
- `heat_stress` — thermal stress;
- `phenology_state` — seasonal/developmental phase;
- `biomass_state` — accumulated standing biomass/carbon pool;
- `soil_moisture` — local storage state where the hydrology model supports it.

These names are proposed architecture concepts, not mandatory final schema fields.

## Scientific discipline

FLEX measures solar-induced chlorophyll fluorescence (SIF); noχ¹ᐃ should **not** equate a raw SIF value one-to-one with universal photosynthetic carbon uptake.

SIF is scientifically useful as a proxy linked to photosynthetic function and stress, but its interpretation depends on canopy structure, illumination, plant physiology and retrieval context. If real Earth-observation data are later ingested, the game should keep a calibrated/derived biological state separate from the raw sensor observable.

## Dynamic update concept

The biosphere state should be able to respond over time to at least:

- incoming solar radiation / day length;
- cloud and atmospheric conditions where modelled;
- surface or canopy temperature;
- soil/root-zone water availability;
- recent precipitation or irrigation;
- vegetation type and phenological phase;
- accumulated heat/water stress;
- disturbance and recovery.

This allows delayed response and recovery instead of an instantaneous mapping from current weather to crop/vegetation output.

## Gameplay / simulation consequences

Downstream noχ¹ᐃ systems may use the dynamic state for:

- agricultural yield and harvest forecasts;
- drought and heat-wave impacts;
- irrigation demand;
- wildfire susceptibility as one of several inputs;
- ecosystem productivity;
- carbon-cycle modelling;
- early-warning overlays before visible land-cover degradation;
- comparison of Earth, habitat agriculture and engineered biospheres on other world bodies.

Balancing values and UI presentation remain noχ¹ᐃ-owned.

## Earth-observation architecture opportunity

FLEX is especially useful because it is designed to operate in tandem with Sentinel-3 context data. A future noχ¹ᐃ Earth-data layer could likewise separate sensor families:

- functional vegetation signal / fluorescence;
- land-surface temperature;
- land cover;
- atmospheric/cloud context;
- soil/hydrological state from other datasets.

The architecture should therefore avoid one overloaded `vegetation_health` scalar if the simulation is intended to retain scientific depth.

## Non-Earth relevance

The modelling principle can later generalize beyond present-day Earth without pretending that FLEX itself observes other worlds:

`environmental forcing -> biological functional state -> accumulated biomass/yield -> resource/economic effects`

That chain is useful for controlled-environment agriculture on stations, the Moon or Mars, where illumination, water delivery, temperature and atmospheric composition may be engineered rather than natural.

## Acceptance criteria

Done when:

1. noχ¹ᐃ distinguishes vegetation/land-cover class from dynamic biological function;
2. photosynthetic activity can vary without immediately changing the underlying vegetation class;
3. water, heat and phenology can influence that functional state over time;
4. accumulated biomass/yield remains distinct from instantaneous activity;
5. any future SIF/FLEX ingestion keeps raw observation separate from calibrated simulation state;
6. implementation reuses the existing Earth/tick/state architecture rather than creating a parallel simulation path.
