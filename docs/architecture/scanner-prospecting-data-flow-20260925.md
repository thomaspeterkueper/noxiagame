# Scanner / prospecting data-flow map

Status: current-state audit  
Date: 2026-09-25  
Architecture references: `noxia-universe/architecture/NXU-OBS-0001-Scientific-Observation-Knowledge-Model.md`, `NXU-OBS-0002-Existing-System-Mapping-Prospecting-Slice.md`

## Current runtime path

### Primary UI

`app/scanner/page.tsx`
→ `ScannerWorkspace.tsx`
→ authenticated `GET /api/game/scanner`
→ player selects optional instrument
→ authenticated `POST /api/game/scanner`
→ result rendered as measurement / interpretation / discovery.

The page also mounts `CoreSamplePanel`, so scanner and drill verification already share one workspace.

A second scanner interaction exists in `app/dashboard/ScannerMicroScene.tsx`; it calls the same scanner API from the building interior.

## Primary scanner authority

`app/api/game/scanner/route.ts` is the current combined server-authoritative route.

For world-coordinate locations it:

1. authenticates the bearer token;
2. resolves the location;
3. finds the player's placed world scanner;
4. derives scanner capability from scanner hardware level, player knowledge points and an owned optional instrument;
5. resolves the containing celestial region;
6. reads authoritative `region_resources`;
7. converts nearby truth rows into internal `ResourceCandidate` values;
8. calls `rollResourceScan`;
9. persists successful discoveries in `scanner_discoveries`;
10. returns measurement geometry plus knowledge-gated discovery DTOs.

The underlying physical scan model is `lib/game/resourceScanning.ts`.

## Sensor / inference implementation

`resourceScanning.ts` currently defines:

- resource tiers: trace / viable / rich / exceptional;
- sensor channels: spectral / mineral / radiometric / subsurface;
- instrument methods: density / spectral / subsurface / any;
- instruments: gravimetry, magnetometry, hyperspectral, seismic, orbital;
- hardware-dependent radius and channel access;
- knowledge-point-dependent interpretation levels;
- resource-to-channel/method mapping;
- detection probability;
- random per-scan detection roll.

This is the main adapter point for the pending Engineering prospecting authority.

## Persistence boundary

Authoritative truth:

- `region_resources`
- `geology_lithology_grid`
- related geology/reference tables.

Player-facing persisted discovery projection:

- `scanner_discoveries`.

Drilling:

- `core_sample_jobs`
- `player_instruments`
- `player_instrument_state`.

The API uses the service-role client after authenticating the user, so ground-truth reads remain server-side.

## Critical epistemic leak

The current scanner DTO still returns `ground_truth_key` to the client in two places:

- top-level `groundTruthKey`;
- `interpretation.groundTruthKey`.

For resource discoveries that value is built as `resource:<region_resource_id>`. This does not directly expose abundance, but it leaks the authoritative resource identity and violates the intended strict separation between evidence and hidden world truth.

The client also uses `groundTruthKey` as a React/display identity. That should be replaced by the public discovery `id` or a separate opaque evidence ID.

## Exact-location leak

The server stores the true resource coordinates in `scanner_discoveries` and returns rounded coordinates according to interpretation level. This is directionally correct, but the DTO currently begins with the full base object and then overrides `lat/lon`.

Keep all future response construction allow-list based: construct only permitted fields rather than copying a truth-bearing base object and masking selected properties.

## Shared-world versus actor-knowledge mismatch

`scanner_discoveries` uses a world-shared uniqueness concept (`location_id, ground_truth_key`) while retaining `discovered_by_profile_id`.

The route's known-resource query is location-wide, not profile-specific. Therefore once a resource is persisted as discovered, it is effectively part of the shared discovery set.

This conflicts with NXU-OBS-0001's actor-specific knowledge rule unless the intended semantic is explicitly “published/shared canonical discovery”.

Recommended interpretation:

- `scanner_discoveries` = shared/published discovery projection;
- future actor evidence/knowledge = separate access layer referencing the discovery/evidence;
- until that exists, do not claim scanner discoveries are private player knowledge.

## Legacy duplicate route

`app/api/game/resource-scan/route.ts` is an older parallel resource-prospecting endpoint.

It directly updates `region_resources.discovered_at/discovered_via` and treats discovery as globally visible world state. Its own header states that it is separated from the older scanner model.

The newer `/api/game/scanner` route now implements resource scanning with richer hardware/knowledge semantics, making `resource-scan` a divergence risk.

Do not extend both paths. Before implementation, locate callers of `/api/game/resource-scan`; if none remain, deprecate/remove it in a separate safe change.

## Core-sample path

`app/api/game/core-sample/route.ts` already provides a strong verification path:

1. authenticated player selects coordinates, rig and depth;
2. `start_core_sample_job_v2` atomically starts the job and applies costs/wear;
3. due jobs are resolved server-side;
4. nearby `region_resources` and lithology truth are read;
5. deterministic modeled resource depth and stratigraphy are evaluated;
6. no intersection produces `empty: true` + `no_resource_intersection_in_sample`;
7. a hit upserts the corresponding `scanner_discoveries` row with `core_sample_confirmed` and high confidence.

This already implements the core concept that drilling can upgrade scanner evidence.

## Critical core-sample leak

Completed core-sample job results currently include exact `abundance: Number(hit.abundance)`.

Because `GET /api/game/core-sample` returns the player's job rows including `result`, the hidden continuous abundance value is exposed after a successful sample.

NXU-OBS-0002 requires epistemically appropriate bands/uncertainty, not automatic exposure of the simulation's exact abundance. This is the highest-priority contract fix once the Engineering authority defines allowed sample outputs.

## Current condition model

Drill-rig condition is already operational:

- condition stored in `player_instrument_state`;
- wear is depth/rig dependent;
- insufficient condition can block a job through the RPC;
- service restores operability at a component cost.

Scanner instrument condition is not currently integrated into `scannerCapability`; the route checks instrument ownership but not `player_instrument_state`. This is a clean future insertion point for Engineering-defined degradation effects.

## CI coverage

`.github/workflows/scanner-domain.yml` currently watches:

- `lib/game/scanning.ts` and its test;
- scanner API/UI paths;
- scanner migrations;
- application build.

It does **not** compile/run dedicated `resourceScanning.ts` tests in the shown scanner workflow. The prospecting implementation should add deterministic unit tests for sensor applicability, detection probability bounds, DTO redaction and epistemic transitions.

## Target adapter points after Engineering response

1. `lib/game/resourceScanning.ts` — replace provisional constants/method mapping with the Engineering authority adapter.
2. `app/api/game/scanner/route.ts` — enforce public evidence DTOs and epistemic transitions.
3. `app/api/game/core-sample/route.ts` — map sample outcome to confirm/refine/contradict without leaking exact truth.
4. `ScannerWorkspace.tsx` — render uncertainty/evidence rather than hidden IDs.
5. scanner-domain CI — add prospecting tests.
6. legacy `resource-scan` — retire or explicitly delegate to the canonical scanner path.

## No-change boundary

This audit changes no runtime code, schema, grants, RLS, resource generation, buildings, transport, ascent or realtime systems.

The next implementation change should remain blocked on the Engineering authority unless it is purely a security/redaction fix that is valid independently of the physical constants.
