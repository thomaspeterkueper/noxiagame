# External Task — Integrate Mars Settlement Systems Kernel

- **Origin:** KUEPER Engineering
- **Target:** NOXIA Game
- **Date:** 2026-09-28
- **Status:** open
- **Engineering authority:** `ENG-MSSK-r1`

## Request
Map NOXIA settlement/runtime state onto the Engineering Mars Settlement Systems Kernel without duplicating its physics authority.

Consume at least:
- typed inventories/reservoirs;
- process contracts;
- capacity-limited links;
- environmental compartments;
- L0–L3 load criticality;
- T0–T4 solver/timescale separation;
- causal failure propagation;
- epistemic separation between physical ground truth, observation, estimate and actor knowledge;
- vector closure metrics rather than one self-sufficiency scalar.

## Existing Engineering references
- `systems/mars-settlement-systems-kernel-r1.md`
- `systems/mars-settlement-systems-kernel-interface-r1.json`
- `systems/mars-settlement-failure-recovery-registry-r1.md`
- `ENG-EGCA-r1`
- `ENG-AFCA-r1`
- `ENG-MININODE-SWARM-r1`

## Boundary
NOXIA owns persistence, runtime cadence implementation, balancing, UI, actor knowledge and gameplay. Engineering owns physical semantics, units, conservation, capacities and causal dependency rules.

Do not expose physical ground truth directly to players/NPC clients merely because it exists in the simulation state.
