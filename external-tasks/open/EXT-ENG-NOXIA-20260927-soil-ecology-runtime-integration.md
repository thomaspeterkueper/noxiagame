# EXTERNAL TASK — Integrate off-world soil ecology runtime

- **Origin:** KUEPER Engineering
- **Target:** NOXIA Game
- **Date:** 2026-09-27
- **Status:** open

## Engineering authorities

- `ENG-SYS-SOILECO-0001` — `systems/offworld-soil-ecology-architecture-r1.md`
- `ENG-CONTRACT-SOILECO-0001` — `systems/offworld-soil-ecology-contract-r1.json`
- `ENG-SYS-ECLSS-0001` — shared ECLSS core

## Request

Integrate controlled soil ecology as a runtime subsystem behind the shared ECLSS conserved-flow contract.

### Minimum gameplay state

Represent each agricultural/biological zone with:

- substrate state S0-S4;
- water and organic-matter inventory;
- N/P/K nutrient pools;
- plant, microbial and fungal biomass/capacity;
- community stability;
- salinity/toxicity/pathogen pressure;
- contamination and isolation state;
- power demand classes.

### Required behaviour

- raw regolith must require conditioning before productive use;
- productive biomass consumes real water/nutrients and exchanges gases through ECLSS;
- waste/inedible biomass can feed qualified decomposition/mineralization paths;
- fungi/microbes must modify process flows, not apply an unconditional yield bonus;
- irrigation, aeration, power, nutrient, salinity, toxicant and pathogen failures must propagate causally;
- contaminated beds must support quarantine, recovery and replacement;
- multiple isolatable zones should prevent one outbreak from automatically destroying all settlement agriculture;
- biological contributions must degrade gracefully while physicochemical survival ECLSS remains independently representable.

### UI / learning layer

Expose causal explanations such as:

`decomposer failure -> nutrient return falls -> fertilizer store drawdown -> later crop yield loss`

and

`salinity accumulation -> root uptake falls -> flushing required -> water demand and reject stream rise`.

### Energy integration

Consume the Engineering energy interface:

- critical_kw;
- flexible_kw;
- productive_kw;
- thermal_reject_kw.

Do not assume installed generation equals deliverable power; connect to the future Energy Grid Layer contract.

## Scope boundary

This request covers contained settlement agriculture and controlled biological substrate systems only. Do not implement planet-scale terraforming/ecopoiesis from this contract.

NOXIA owns balancing, UI presentation, tick cadence, content progression and player-facing values.
