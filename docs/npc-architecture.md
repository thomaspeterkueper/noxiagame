# NOXIA NPC / Living Population Architecture

Status: architecture baseline for #16, #19 and #166.

## Principle

NOXIA has one population model, not separate flavour NPC, narrative-character and AI-player models. A person is a persistent simulation entity. Higher intelligence is an optional decision layer over the same legal game/domain actions.

## Layers

1. **Person identity** — stable `person_id` / `person_key`, biography metadata, traits, canonical external references where applicable.
2. **Simulation state** — location, needs, health/wellbeing, skills, assignments, relationships, knowledge/beliefs and memory/event references.
3. **Decision layer** — routine/state logic for ordinary population; utility scoring for active NPCs; optional planner for rare autonomous agents.
4. **Action layer** — all mutations go through canonical validated domain actions. NPC logic never writes world truth directly.
5. **Observation/knowledge layer** — perceived state and beliefs are distinct from simulation `ground_truth`.
6. **Presentation** — UI/dialogue describes persisted state and decisions; prose is never source of truth.

## Simulation LOD

Population simulation is tiered to remain scalable:

- `aggregate`: cohorts/statistical population only;
- `background`: persistent persons updated at coarse intervals/event boundaries;
- `active`: named/nearby persons with needs, routines and utility decisions;
- `agent`: rare player-equivalent autonomous actor with planning/reasoning.

Promotion/demotion must preserve identity, durable relationships, important memories and causal traces.

## Ordinary NPC decision contract

Candidate actions are generated from the person's observable state and capabilities. Utility evaluates needs, goals, role obligations, risk, travel/time cost, relationships and current colony pressures. The winning action is still validated by the same domain rules used elsewhere.

A decision trace should minimally contain:

- person id;
- tick/time;
- observations used;
- candidate action keys + scores;
- selected action;
- validation/result;
- resulting event/memory references.

Determinism: equal seed + equal persisted state + equal observations must permit reproducible decisions for tests.

## Named actors

Named/canonical characters are not scripted shells. They use the same person state and action contracts. Narrative/scenario systems may introduce or reference them, but cannot manufacture a contradictory state.

## Autonomous player-agents

Issue #166 is intentionally downstream of the normal population/action architecture. These agents receive a normal player/person identity and begin from a genuine new-player zero state. The planner receives only player-observable information and may never read hidden deposits, database internals, problem ground truth or developer metadata.

The first two intended profiles differ only in decision style, not privileged knowledge:

- systematic/technical;
- exploratory/pragmatic.

They learn through the same tutorial/SSF paths, measurements, exploration and consequences available to a human player.

## Playtest reporting

Autonomous agents primarily try to play successfully. A report is generated from an experienced blocker or inconsistency, not from privileged QA inspection. Reports should retain evidence sufficient for deterministic replay and compare expected vs actual behavior.

## Implementation order

1. inventory current person/population, world-state, tick, building, economy, travel and action contracts;
2. extend canonical person identity/state (#19) without parallel NPC storage;
3. implement routine + utility decision engine with deterministic traces;
4. connect actions, events/memory and person UI;
5. exercise the Tharsis living-world vertical slice (#16/#17/#40/#41);
6. only then implement one zero-start autonomous player-agent (#166);
7. add the second contrasting agent after the first can complete/replay a real progression path.

## Non-negotiable invariants

- one source of truth for persons;
- world state is changed only through validated domain actions;
- `ground_truth` is separate from observation/knowledge;
- dialogue/prose never creates facts;
- normal NPC simulation does not require an LLM;
- autonomous agents receive no gameplay privilege;
- all important decisions and consequences remain auditable/replayable.
