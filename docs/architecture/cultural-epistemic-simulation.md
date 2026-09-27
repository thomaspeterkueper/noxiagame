# NOXIA Cultural–Epistemic Simulation (CES)

Status: architecture foundation.

CES models how actors and communities form, transmit, contest and revise meaning without collapsing interpretation into authoritative world truth. It extends the Epistemic Observation Contract; it does not replace PersonKnowledge, observations, social memory, the event stream or domain authority.

## Core invariants

Physical/causal truth, observation, knowledge and meaning remain distinct:

```text
Defined Reality != Knowable Reality != Experienced Reality != Meaning
Reality != Measurement != Interpretation != Knowledge
Source != Interpretation != Received Tradition
```

A source object may be immutable while its reception changes for centuries. Communication transfers claims and provenance, never truth by fiat.

## Ontology classes

Questions and facts exposed to CES use an explicit ontology class:

- `determinate`: authoritative domain state exists.
- `determinate_hidden`: authoritative state exists but ordinary actors/players receive it only through observations and evidence.
- `generative`: the simulation may concretize a previously unresolved fact; once concretized it follows normal authoritative/replay rules.
- `open`: NOXIA intentionally defines no canonical answer.

`open` is not unknown data and must never silently resolve to true/false. Metaphysical meaning, ultimate purpose and comparable claims belong here unless a narrower domain fact is explicitly modeled.

## Player boundary

Normal gameplay never receives wholesale ground truth. Players receive observations, measurements, evidence, models, testimony, archives and actor/community interpretations.

Developer tooling may inspect authoritative physical/causal state for debugging. It must represent `open` questions as open rather than inventing a hidden answer.

## Belief state

The hot simulation state is deliberately small:

```ts
interface BeliefState {
  commitment: number
  socialBinding: number
  revisability: number
  salience: number
}
```

All values are normalized 0..1.

- `commitment`: strength with which the currently relevant position is held.
- `socialBinding`: behavioral importance of belonging/affiliation.
- `revisability`: readiness to revise under relevant evidence, experience or social change.
- `salience`: current relevance of this belief domain to decisions.

Traditions, philosophies, interpretations, practices, experiences and affiliations are semantic records/tags. They are activated by relevant events; they are not evaluated on every NPC tick.

CES must not be inserted into the legacy economic `npcBrain` as a universal modifier.

## Cultural reception graph

CES is a feedback graph, not a progression ladder:

```text
Source <-> Interpretation <-> Individual <-> Community <-> Institution
   ^                                                   |
   |                                                   v
Public Memory <-> Received Tradition <-> Event <-> Historical Change
```

Historical change cannot mutate an archived source, but it can change which edition, quotation, interpretation or memory actors encounter.

Stable semantic roles:

- `source_object`: provenance-bearing source/artifact.
- `interpretation`: a reading or meaning claim about sources/events.
- `received_tradition`: transmitted interpretation with lineage.
- `institutional_position`: an institution's explicit position at a time.
- `individual_belief`: actor-specific appropriation.
- `public_memory`: socially circulating representation, including misquotation and distortion.

These are roles/relations, not a requirement for six new database tables.

## Event activation

CES is event-driven. Ordinary economic/locomotion ticks should not invoke belief reasoning.

Candidate triggers include death, birth, marriage, migration, disaster, scientific discovery, contradictory evidence, First Contact, anomalous X-technology observations, institutional disputes, rituals, public debate, archival discoveries and encounters with contested sources.

A trigger may alter salience first; deeper interpretation/revision is evaluated only when warranted.

## Institutions and places

Churches, mosques, synagogues, temples, secular associations and Omnizedenz Resonance Centres are institutions/places with activities and relationships, not decorative tiles.

Resonance Centres are plural-use philosophical/social spaces by default, not an Omnizedenz church. Historical communities may nevertheless sacralize, ritualize, reject or reinterpret them.

NOXIA never assigns a privileged truth status to Omnizedenz or to a real religion/philosophy.

## Omnizedenz

The canonical source tradition and later reception must remain separable. Later Omnizedenz schools may reinterpret, ritualize, institutionalize, quote selectively or reject earlier readings without rewriting source objects.

This permits a historically common CES mechanic: public memory can preserve a famous quotation or doctrine that archival source comparison later shows to be altered, misattributed or absent.

## Integration

CES reuses:

- Epistemic Observation Contract for actor-visible evidence;
- PersonKnowledge for actor knowledge projection;
- social memory for personal/social consequences;
- simulation_events for historical events;
- entity state/event replay where persistence is justified;
- canonical character bridge for authored NPC identity.

Do not create a CES clock or duplicate knowledge table.

## Initial implementation slice

1. typed ontology and BeliefState primitives;
2. deterministic relevance/activation helper;
3. tests proving clamping, open-state preservation and salience gating;
4. no database migration;
5. no LLM/API call in the tick path;
6. later consumers must demonstrate a concrete causal/gameplay need before persistence is added.
