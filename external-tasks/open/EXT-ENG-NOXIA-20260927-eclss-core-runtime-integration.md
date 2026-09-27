---
id: EXT-ENG-NOXIA-20260927-ECLSS-CORE-RUNTIME
title: Integrate shared ECLSS core and conserved-flow runtime
status: open
source: KUEPER Engineering
target: NOXIA
created: 2026-09-27
priority: high
affects: [NOXIA, habitats, spacecraft, settlements, agriculture, waste, energy]
engineeringAuthority:
  - ENG-SYS-ECLSS-0001
  - ENG-CONTRACT-ECLSS-0001
---

# Request

KUEPER Engineering has defined a shared ECLSS core family and a conserved-flow runtime contract.

NOXIA should consume these contracts rather than maintain separate oxygen, water, agriculture, fungi and waste simulations.

## Required runtime work

1. Add an ECLSS aggregate state with inventories for water, oxygen, carbon, nitrogen, phosphorus, organic waste and food.
2. Add process capacities for water cleaning, CO2 removal, O2 generation, waste processing and biological processing.
3. Enforce conservation across internal transfers. Imports, exports and losses must be explicit events.
4. Model contamination/isolation as capacity reduction and flow rerouting, not a generic hit-point penalty.
5. Expose three power classes to the grid layer: critical, deferrable and productive load.
6. Support fidelity F0 for normal gameplay. Preserve extension points for F1/F2 without requiring detailed chemistry in every tick.
7. Derive warnings such as crew-days remaining from active inventories and capacities rather than storing them as authoritative values.

## Asset/application mapping

Initial mapping:

- short rover/shuttle -> L0 survival core;
- CYGNUS multi-day ferry -> L1 regenerative core;
- long-duration transport -> L1 plus selected L2 modules;
- orbital habitat -> L2/L3;
- lunar/Mars settlement -> L3.

Do not assign exact numeric recovery rates until the per-person and component calibration task is complete.

## UI requirement

Player-facing diagnostics should explain the causal failure chain. Example: grid loss -> wastewater processor curtailed -> clean-water recovery falls -> potable buffer declines. Do not collapse this into an opaque life-support health percentage.

## Integration boundary

Agriculture, fungi/soil ecology and waste processing remain specialized subsystems but connect only through the common ECLSS flow interface.
