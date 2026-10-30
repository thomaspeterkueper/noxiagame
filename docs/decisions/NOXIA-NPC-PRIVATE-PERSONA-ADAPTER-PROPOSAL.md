# NOXIA NPC personality origins — integration boundary

Status: proposal, 2026-10-30. Applies to ordinary NOXIA NPCs and optional literary NPCs.

## Principle

Private authoring systems may help design characters, but **are never deployed to the public game**. The NOXIA Core remains authority for NPC identity, memory, relationships, needs, physiological state, actions and world knowledge. This proposal is an optional, data-minimal *seed adapter*, not a second runtime NPC engine.

## Private and public layers

1. Private author workspace: unrestricted working notes, archetypal design, Cultural DNA interpretations, unreleased plot secrets and editorial guidance. Storage/authentication separate from public repository and client bundle.
2. Explicit approval: author reviews each non-sensitive output field, provenance, consent where appropriate, and spoiler limits.
3. Generic personality seed: stable fictional identifier; descriptive interaction preferences, values, tensions, skills and initial social tendencies; version and approval reference. **No raw Cultural DNA formulas, rules, manuscripts, astrology assignments, confidential prompts or unreleased plot data.**
4. Core-owned runtime: only the Core adapts personality through observed events, relationships, stress, knowledge and physiology. The adapter has no authority to persist memories or override choices.

## Proposed shared NPC interfaces

- `PersonaSeed`: id, version, approved capabilities, values, social tendencies, uncertainty.
- `KnowledgeGate`: explicit source or in-world observation plus time/scene availability.
- `NpcContext`: location, role, current goals, needs, relationships, recent memory.
- `BehaviorProposal`: contextually ranked candidate actions with reasons; not a forced deterministic decision.
- `StoryNpcOverlay` (optional): canon checkpoint, role-specific spoiler restrictions; never for ordinary world NPCs.

## Required safety properties

- Deny by default: no source profile or writing-tool material in exported JSON, API responses, frontend bundles or git.
- Do not derive competence, trustworthiness or moral character from nationality, ethnicity, religion or astrology. No real-person profiling.
- NPC individuality comes from biography, lived experiences, values and observed behavior, not essentialist cultural assumptions.
- Public names and fields require approval and versioned audit trail.
- Feature flag for seed intake; legacy NPCs retain behavior when no seed exists.
- Deterministic regression fixtures: same initial seed/context yields reproducible proposals; evolving context can yield diverse outcomes.
- NPC awareness is bounded by a knowledge-time gate. No unpublished-book spoilers.
- Core integration only after locating and testing the actual existing NPC code paths.

## Rollout

1. Inventory actual Core NPC creation/memory/personality implementation before coding an adapter.
2. Agree on generic schema and threat-model approval/export endpoints.
3. Pilot with **synthetic unnamed NPCs** in a private test world to protect existing characters.
4. Compare behavior to current NPC baseline (social grouping, agency, knowledge timing, memory consistency).
5. Only then opt in selected original NOXIA characters; literary personas follow separately with author sign-off.

This document contains **no proprietary Cultural DNA contents**; terminology here is only a private-authoring boundary reference.
