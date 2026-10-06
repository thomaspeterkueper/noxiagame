# NOXIA Request: Capability & Provider Fabric

Origin: architecture/cost/resilience discussion, 2026-10-06
Priority: high
Related: AI-assisted World Production Pipeline

## Goal
Decouple NOXIA capabilities from individual external providers so that services and data sources can be added, replaced, cached or failed over without changing gameplay/domain logic.

Guiding principle:
**local-first -> open-first -> cached-first -> multi-provider -> paid-last**, subject to quality, scientific authority, licensing and operational requirements.

## Phase 0 — Inventory before migration
Map every current external dependency and internal capability before replacing anything:
- capability supplied
- current provider/service/library
- call sites and owning module
- authoritative vs replaceable data
- persistence/cache behaviour
- cost model and current usage
- rate limits/quotas
- latency/availability
- license/ToS/data-retention constraints
- failure impact
- existing fallback.

Do not migrate working integrations merely to satisfy the abstraction.

## Capability contracts
Define provider-independent interfaces for candidate domains such as:
geodata/map tiles, geocoding, routing, elevation/terrain, planetary/scientific datasets, weather/climate, astronomy, search/retrieval, LLM, embeddings, translation, STT, TTS, image/3D/texture generation, audio/music and asset discovery.

Domain/game code requests a capability, not a vendor.

## Provider Registry
Each adapter records:
- capabilities
- authority/source class
- cost/unit and free quota
- rate/concurrency limits
- expected latency
- geographic/body/language coverage
- quality tier
- license/provenance requirements
- cacheability/retention
- health/status
- secrets/config requirements
- fallback compatibility.

## Redundancy classes
R0: deterministic local/internal capability; no external runtime dependency.
R1: external convenience capability; graceful loss acceptable.
R2: important capability; primary + cache/local degraded mode.
R3: operationally critical external capability; primary + independent secondary + persisted/cached degraded mode.
R4: canonical scientific/authoritative input; authoritative primary + independent validation/reference where appropriate + provenance/version snapshot. Do not silently substitute a lower-authority source.

Assign every capability a target class.

## Router
Select providers by policy rather than hard-coded vendor:
authority/quality constraints -> privacy/license -> cached/local availability -> health -> latency -> quota -> marginal cost.
Support circuit breakers, retry budgets and explicit degraded modes. Avoid retry storms and accidental expensive fallback.

## Canonicalization & persistence
External responses do not directly become authoritative world state. Normalize to NOXIA schemas, attach source/provenance/version/timestamp, validate, then persist/cache where legally and technically allowed.

Gameplay-critical facts such as ownership, economy, navigation topology, building existence/entrances and persistent world state must remain under NOXIA control.

## Observability & cost
Measure per capability/provider:
requests, success/error, p50/p95 latency, cache hit rate, fallback count, quota consumption, estimated/actual cost, bytes/storage and quality/rejection metrics where applicable.

Add configurable daily/monthly budget guards and alerts. A paid fallback must not silently turn a free-provider outage into uncontrolled spend.

## Resilience tests
Create adapter contract tests and failure-injection scenarios:
provider unavailable; timeout; quota exhausted; malformed/stale response; changed schema; secondary unavailable; cache-only operation.
Verify that the game degrades predictably rather than failing globally.

## Security/privacy
Centralize secrets server-side. Minimize personal/user data sent to third parties. Provider adapters declare data classes they transmit and retention constraints. Keep research/health-like data outside generic provider routing unless explicitly designed and consented.

## Acceptance
1. Current providers are inventoried.
2. A provider-independent capability interface and registry exist.
3. At least one low-risk capability is implemented with two interchangeable providers or provider+local/cache fallback.
4. Metrics expose cost, latency, cache and fallback behavior.
5. Existing Earth/Moon/Mars/Phobos/Deimos behavior remains intact.
6. Architecture allows new providers without changes to domain/gameplay code.
