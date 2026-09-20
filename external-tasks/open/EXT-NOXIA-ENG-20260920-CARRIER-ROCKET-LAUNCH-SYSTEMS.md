# EXT-NOXIA-ENG-20260920-CARRIER-ROCKET-LAUNCH-SYSTEMS

Status: open
Owner: KUEPER Engineering
Consumer: NOXIA
Priority: high

## Context

NOXIA now models surface-to-orbit ascent as a shared Core lifecycle. A spacecraft may reach that lifecycle through more than one launch architecture. Newer spacecraft-native ascent systems must not erase older carrier-rocket systems simply because a newer technology exists.

Carrier rockets should remain economically and operationally relevant where their payload class, infrastructure, cadence, service model, reliability, certification or cost structure makes them competitive.

## Required Engineering authority

Define one or more canonical carrier-rocket launch-system families usable by NOXIA without inventing physics. For each approved family provide:

- stable authority/profile ID
- launch architecture = carrier-rocket
- supported bodies / gravity environments
- supported launch sites / site classes
- supported target orbit families
- payload integration envelope
- payload mass / volume limits
- crewed / uncrewed capability
- staging architecture
- propellant / energy system
- total launch mass and relevant stage masses
- thrust / performance authority sufficient to validate the supported ascent envelope
- recovery/reuse model: expendable, partially reusable or fully reusable
- turnaround / refurbishment constraints
- pad, tower, storage, fueling and service requirements
- abort / range-safety / launch-commit constraints relevant to gameplay readiness
- dependencies on weather/environment where applicable
- evidence/reference provenance for every authoritative value

## Economic handoff required

Do not prescribe NOXIA prices, but expose the engineering quantities that drive economics, including where applicable:

- hardware discarded per launch
- hardware recovered per launch
- refurbishment scope and minimum turnaround
- propellant/consumables quantities
- required launch-site operations
- payload integration effort class
- recovery operations class
- expected asset life / flight-cycle limits where supportable

NOXIA will map these into its own economy rather than embedding engineering costs directly.

## Architecture boundary

Carrier rockets must NOT introduce a second orbit/transit model.

Expected chain:

`spacecraft/payload + carrier rocket + launch site`
→ `launch-system readiness`
→ existing `Ascent Core`
→ `orbital-insertion`
→ `orbital-arrival`
→ existing Arrival Control / Orbit / Docking Core

The existing spacecraft-native ascent path remains valid in parallel.

## NOXIA implementation already prepared

`lib/game/launchSystems.ts` defines:

- `vehicle-native-ascent`
- `carrier-rocket`
- reusability categories
- launch-service ownership modes
- fail-closed launch-system readiness evidence
- economic dimensions with all quantitative values unresolved by default

Engineering must supply authority; NOXIA must not infer missing performance values from names, roles or historical analogues.
