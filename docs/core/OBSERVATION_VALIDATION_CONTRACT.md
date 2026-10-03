# Observation validation contract

NOXIA separates **predicted capability**, **measured capability** and **qualified operational capability**.

## Dimensions

- **Environmental qualification**: a laboratory result does not prove operation on Venus, in vacuum, underwater or in a dusty habitat.
- **Calibration/freshness**: a capable instrument can still be epistemically insufficient when its calibration is stale.
- **Access/mobility**: an observable may be detectable in principle while the sensor cannot reach the relevant measurement volume.
- **Distributed sensing**: point sensors, arrays, sensorized surfaces, mobile sensors and swarms are distinct observation topologies.
- **Signal separation/suppression**: observability can improve by suppressing a dominant background rather than increasing target signal.
- **Self-interference**: the measurement system may contaminate or perturb the signal and must be characterized explicitly.
- **Evidence references**: validation is evidence-backed; confidence or a predicted design value never grants truth or authority.

## Technology feedback

The prototype loop is:

`development goal -> declared approach -> predicted performance -> prototype -> measured performance -> residuals -> bounded diagnostic hypotheses -> discriminating test -> next iteration`.

Residuals are deterministic comparisons between declared predictions and measured results. They are evidence, not random success/failure rolls. Causal explanations must come from declared domain hypothesis catalogues and should reuse the existing bounded hypothesis machinery.

## Repeated testing

Repeated tests can strengthen qualification only when their evidence is retained. A single successful laboratory run is not equivalent to repeated environmental or operational validation.

## Manufacturing boundary

A validated prototype is not automatically a generally available technology. Manufacturability, process capability, repeatability, supply chain and production scale belong to a later manufacturing-capability boundary.

## Story/world projection

These mechanics are intended to support science-driven economy and narrative: unanswered questions create measurement requirements; requirements create instrument development; development creates demand for skills, materials and production; failures generate diagnostic evidence; validated capabilities can later acquire unexpected secondary uses.
