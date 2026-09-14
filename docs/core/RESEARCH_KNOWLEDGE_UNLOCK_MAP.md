# NOXIA Core — Research, Knowledge & Unlock Map

## Canonical rule

NOXIA treats learning, scientific knowledge and gameplay authority as related but distinct state dimensions:

`training != knowledge_points != discovery != unlock != authorization != ownership`

An educational result may justify an unlock candidate. It does not itself create a building, vehicle, asset, inventory or physical capability.

## Authority boundaries

### SSF

The Solar Science Foundation is the content and mapping authority for educational material. It may report completed modules and candidate NOXIA unlocks.

SSF does **not** define NOXIA's gameplay hierarchy. Candidate unlock IDs are resolved against NOXIA's own registry and prerequisite graph before they are persisted.

An SSF outage must fail closed. It may degrade knowledge display, but it must never substitute demo/local completions or grant gameplay capabilities.

### NOXIA

NOXIA owns:

- unlock identity and semantic scope (`UNLOCK_REGISTRY`),
- unlock prerequisites and hierarchy,
- build-to-unlock requirements,
- persisted per-player unlock state,
- server/database capability checks,
- physical feasibility, cost, ownership and world-state transitions.

Explicit local/demo knowledge remains valid only when `KNOWLEDGE_SOURCE=local` is selected. It is not a recovery authority for an unavailable SSF source.

## Current progression dimensions

| Dimension | Current representation | Meaning |
| --- | --- | --- |
| Learning completion | `academy_completions` / SSF completed modules | Evidence that a module was completed |
| Knowledge points | `profiles.knowledge_points` + knowledge transactions | Progression/level measure; not a capability by itself |
| Unlock candidate | SSF mapping response | Proposed gameplay entitlement, subject to NOXIA validation |
| Unlock definition | `lib/knowledge/unlockRegistry.ts` | Canonical NOXIA identity, prerequisites and grants |
| Persisted unlock | `player_unlocks` | Player-scoped NOXIA entitlement |
| Build requirement | `lib/knowledge/buildRequirements.ts` | Mapping from concrete buildable to required unlock |
| Capability check | API/DB command path | Authoritative permission to execute a gameplay action |
| Physical feasibility | placement, location, inventory, credits, route/buildability | Independent constraints that remain after knowledge is satisfied |

## Required invariants

1. **Remote failure is not privilege escalation.** SSF failure yields no completed modules, unlocks or buildings. Demo progression is local-mode only.
2. **Unknown upstream IDs do not become NOXIA authority.** SSF candidates are resolved through the NOXIA registry/prerequisite graph before persistence.
3. **Prerequisites remain explicit.** Integration/subsystem unlocks cannot be granted merely because an upstream response named them.
4. **Knowledge points are not unlocks.** Awarding points or reaching a level does not itself create `player_unlocks`.
5. **Completion is idempotent.** Repeating module completion must not repeat its knowledge-point award; unlock synchronization may safely retry.
6. **Persisted unlocks are player-scoped.** Feature checks load `player_unlocks` by `profile_id`.
7. **Visibility is not authority.** Client/catalog visibility never replaces the server-side gate for a protected action.
8. **Unlock is not buildability.** A successful knowledge gate does not bypass allowed-world/location checks, occupied-space checks, credits/resources or the atomic build command.
9. **Completion is not ownership.** Learning and unlock synchronization do not create or transfer buildings, vehicles or inventories.
10. **DB-critical capabilities recheck prerequisites.** Where a database command already owns the capability boundary (for example bank credit), the command must recheck the relevant completion instead of trusting UI state.
11. **Scientific discovery remains distinct.** Measurements, interpretations and discoveries may later feed progression, but they are not silently equivalent to an unlock unless an explicit mapping is introduced.
12. **Local/demo mode is intentional only.** It may support development/playtest content but must never be selected implicitly because the remote authority failed.

## Build boundary

For currently mapped normal buildings the order is conceptually:

`authenticated player -> knowledge state -> build requirement -> world/location feasibility -> economy/resources -> atomic build command`

A knowledge unlock answers only **"has the player learned enough to attempt this?"** It does not answer **"can this object physically/economically be built here now?"**

Station modules and other special domains may have separate current rules. They should only be folded into the shared unlock contract when their actual gameplay semantics require it; the Core must not invent restrictions merely for symmetry.

## Future extension

If research projects, experiments or discoveries become first-class unlock sources, add an explicit mapping boundary rather than overloading `academy_completions`. A likely future chain is:

`measurement -> interpretation -> validated discovery -> progression evidence -> NOXIA unlock candidate -> prerequisite resolution -> persisted unlock`

That extension must preserve the same rule: evidence can justify authority, but evidence is not authority by itself.
