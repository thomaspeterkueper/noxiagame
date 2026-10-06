# NOXIA Request: Persistent World Discovery & Enrichment

Origin: missing-place rendering observed for Langen (Hessen), 2026-10-06
Priority: high
Related: Capability & Provider Fabric; AI-assisted World Production Pipeline

## Problem
A real place can currently fail to appear/be enterable when the current place/geodata path does not resolve enough renderable data. This must not become a growing list of one-off place fixes.

Regression case: **Langen (Hessen), Germany**. Reproduce the current failure before changing behavior and record which stage fails: query/disambiguation, provider lookup, normalization, geometry retrieval, scene construction, render filtering, cache/persistence, or UI/navigation.

GitHub default-branch code search on 2026-10-06 did not return the expected Earth/place-resolver identifiers, so first inventory the actual current call sites/modules rather than assuming old names.

## Architecture
Implement a provider-independent flow:

user search/travel intent
-> internal Place Resolver
-> NOXIA canonical place store/cache
-> Capability & Provider Fabric
-> multi-source discovery
-> normalization/entity resolution
-> evidence/provenance merge
-> canonical PlaceIdentity
-> progressive enrichment jobs
-> render artifacts / LocalSurfaceScene
-> persistent reuse on future visits.

A miss from one provider must mean “try another eligible source”, not “place does not exist”.

## Two-speed behavior
### Interactive path
Use a strict latency/request budget. Return the best safe minimum place representation available during the current session. Never block gameplay on full enrichment.

### Enrichment path
Persist a discovery/enrichment request and progressively build a richer canonical record. Once accepted, later sessions reuse the stored result instead of repeating the same external discovery work.

If asynchronous execution infrastructure is unavailable, process enrichment on the next eligible server request/job; do not fake background guarantees.

## Progressive enrichment levels
L0 identity: canonical name, aliases, coordinates, admin hierarchy, country/body, bounding geometry/confidence.
L1 navigation surface: roads/paths/basic terrain/topography sufficient for a walkable scene.
L2 built environment: buildings, POIs and infrastructure.
L3 semantics: building/POI types, entrances/access, transport and relevant operational attributes.
L4 world identity: characteristic architecture/materials, vegetation/environment, transport/signage/language and other place descriptors.
L5 contextual knowledge: selected historical/economic/social/scientific context with provenance.

Rendering must tolerate partial levels. L0/L1 should be enough to avoid “known real place disappears” where feasible.

## Multi-source resolution
Route through Capability & Provider Fabric. Candidate source classes:
- existing NOXIA canonical/cache data
- OpenStreetMap-compatible open geodata
- authoritative national/regional/municipal open data where available
- other compatible open/free providers
- paid provider only under explicit policy/budget.

Do not hard-code Langen-specific data.

## Canonical data model
Persist separately:
PlaceIdentity
- stable internal id
- canonical/display names and aliases
- place type
- coordinates/bounds
- administrative parents
- enrichment level/status
- first_discovered_at / last_verified_at

PlaceSourceObservation
- provider/source id
- external id
- retrieved_at/source version where known
- raw/normalized facts reference
- license/provenance
- confidence/authority class

PlaceFact
- normalized claim/value
- source observations
- confidence/status
- conflict state
- accepted canonical value

PlaceArtifact
- geometry/render/navigation artifact
- source/version/hash
- derived_at
- invalidation dependencies.

Keep observations even when canonical facts are later revised, subject to licensing/storage constraints.

## Entity resolution / ambiguity
Search terms are not identities. Resolve “Langen” using country/admin hierarchy, coordinates, aliases, provider IDs and user travel context. Do not merge distinct places with the same name.

## Conflict policy
Authoritative/canonical evidence rules outrank provider order. Conflicting observations remain traceable. Never silently overwrite a high-authority fact with a later lower-authority response.

## Cache/invalidation
Avoid permanent stale data:
- TTL/reverification policy by fact class
- source/version-aware invalidation
- negative-cache TTL for failed lookups
- retry/backoff
- deduplicate concurrent discovery for the same candidate place.

## Cost controls
Persist successful reusable discoveries where licensing permits.
Track requests, cache hits, providers consulted, bytes, latency and estimated cost per newly discovered/enriched place.
Set hard provider/query budgets for interactive discovery.
No uncontrolled paid fallback.

## Privacy/security
Do not treat arbitrary user search strings as trusted provider parameters. Normalize/validate requests and minimize user-specific context sent externally.

## Acceptance tests
1. Reproduce the current Langen (Hessen) failure and identify the failing stage.
2. Search/enter Langen through the new generic resolver.
3. If the primary source cannot provide enough data, another eligible provider can be consulted.
4. A minimal canonical place record is persisted with provenance.
5. A later request can render/enter Langen from NOXIA data/cache without repeating the original discovery path where data remains valid.
6. Two different places named Langen are not merged.
7. Provider outage/timeout yields a defined partial/degraded result rather than global scene failure.
8. Existing Earth locations and shared LocalSurfaceScene behavior remain intact.
9. Metrics show discovery, cache hit, fallback and enrichment-level transitions.
10. The implementation works generically for a second previously unknown place without code changes.
