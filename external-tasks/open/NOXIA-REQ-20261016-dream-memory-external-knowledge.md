# NOXIA Research/Architecture Request — Dream Memory and External Knowledge Integration
Date: 2026-10-16
Status: proposed, not implemented
Origin: user concept: sleeping NPCs may access portions of the internet and weave external knowledge into dreams. This is a fictional simulation mechanic and does not validate any real-world collective-memory hypothesis.

## Goal
Make dreams a bounded, provenance-aware process that can transform personal experiences plus external, world-appropriate information into NPC ideas, interests, narratives and occasionally actionable hypotheses.

## Data separation (hard invariant)
1. SourceObservation: actual fetched text/media metadata, URI, license, retrieval timestamp, authority, time/place relevance, content hash.
2. DreamEpisode: generated subjective narrative, motifs, associations, distortion and affect; explicitly not a source of facts.
3. Belief/Idea: NPC interpretation and confidence, evidence references, provenance chain, potential false belief.
4. VerifiedKnowledge: only through independent validation and existing canonical world-data pipeline, never promoted directly from dreams.

## Temporal and lore constraints
A character in 2150 cannot browse the real 2026 web as in-world contemporary knowledge. Route external research through a dated world-knowledge projection or clearly marked noncanonical creative inspiration; respect setting, location, access rights, historical context, cultural background, and technology level. Different NPCs have different dream recall, curiosity and openness.

## Resource-conscious design
Integrate with NOXIA Capability & Provider Fabric and canonical persistent memory. Shared pre-fetched/licensed knowledge pool with TTL and provenance; sparse sleep-triggered sampling rather than one live web request per NPC per night. Batch background dream generation only for NPCs with narrative significance or relevant interactions. Deterministic seeds for baseline simulation, bounded token/compute budgets, caching, rate limits, circuit breakers and opt-out switches. Do not schedule or imply a live recurring job until implementation.

## Proposed stages
A. Inventory existing NPC memory, sleep/tick, world timeline, knowledge, web/AI provider interfaces, storage and permissions. Avoid changes to live behavior before mapping.
B. Define DreamEpisode, DreamSourceLink, NPCBelief and KnowledgeVerificationAttempt schemas, provenance, retention and privacy.
C. Offline pilot with 2-3 NPCs: craftsperson, scientist and child. Measure cost, coherence, lore consistency, hallucination containment, repeatability and NPC agency.
D. Guardrail tests: no unlicensed text replication; no private user information; no unsafe personal inference; no direct write from dream to authoritative world facts; no retrocausal knowledge leaks.
E. Only then propose feature-flagged runtime rollout and migration.

## Acceptance criteria
NPC dreams merge own episodic memory with limited sourced impulses; source facts remain traceable; characters may be mistaken; creative insights require independent verification; dream events survive persistence and affect later behavior selectively; sleeping NPCs do not each make live external API calls; per-NPC and global budgets are measurable; lore-era checks pass.

Related: NOXIA-REQ-20261006-capability-provider-fabric.md; NOXIA-REQ-20261006-ai-assisted-world-production-pipeline.md; Integrity of Observation; Timescale Engineering; Biological Robustness Engineering; Omnizedenz hypothesis (fictional inspiration only).
