# Enceladus plume sampling and cryosegregation

Status: initial NOXIA integration, 2026-09-28.

## Purpose

Enceladus is the first concrete use of a generic scientific-sample provenance layer. The central rule is:

`source environment != sample formation != collected sample != measurement != interpretation != validated discovery`

A plume grain is therefore not treated as a transparent aliquot of the subsurface ocean.

## Process model

`subsurface ocean -> bubble-mediated droplet -> slow freezing / cryosegregation -> vent acceleration -> wall collision / fragmentation -> plume grain -> instrument measurement -> interpretation`

The model permits water-rich, salt-rich, carbonate-rich, organic-rich, mixed and unclassified grain classes. Grain class is a sampling property, not a direct statement about bulk-ocean abundance.

## Gameplay consequences

Sampling trajectory, collection geometry, grain class and instrument selection may bias the observed distribution. A technically correct measurement can therefore support a poor ocean inference when provenance is ignored. Repeated samples and diversity of grain classes should improve inference quality in later simulation work.

No biosignature result is automatically a life detection. Methanogenesis experiments and organic detections are evidence inputs that require explicit interpretation and validation.

## Authority boundary

Scientific evidence does not directly grant gameplay authority. Any later progression path must remain:

`measurement -> interpretation -> validated discovery -> progression evidence -> NOXIA unlock candidate -> prerequisite resolution -> persisted unlock`

SSF remains the educational-content/mapping authority. NOXIA remains the authority for unlock identity, prerequisites and gameplay effect.

## Handoffs

### SSF

Build a learning path covering phase transitions and freezing concentration; solute segregation; aerosol/bubble transport; fragmentation; representative sampling and selection bias; mass spectrometry; biosignatures; methanogenesis; and the distinction between detection, interpretation and life detection.

Target outcome: a learner can explain why an organic-rich Enceladus grain does not imply an equally organic-rich bulk ocean.

### KG / scientific knowledge graph

Represent distinct nodes for source environment, formation process, sample, measurement, interpretation and validated claim. Edges must preserve provenance and uncertainty. Do not collapse `measured-in(sample)` into `abundant-in(source)`.

### OTA

Create research item `OTA-ASTROBIO-ENCELADUS-PLUME-FRACTIONATION`. Track laboratory constraints on freezing/segregation and vent fragmentation, Cassini plume-grain observations, methanogenesis habitability experiments, uncertainty, competing interpretations and mission implications. Link, but do not identify, this mechanism with the existing Europa/Enceladus boiling-freezing research path.

## Next implementation slice

Add stochastic grain-population generation, collection/trajectory selection bias, instrument response, multi-sample Bayesian/source reconstruction and explicit discovery validation. These should consume the generic provenance contract rather than introduce Enceladus-only epistemic shortcuts.
