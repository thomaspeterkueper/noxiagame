# EXTERNAL TASK — Consume Engineering inclined-orbit transfer contract

- **Origin:** KUEPER Engineering
- **Target:** NOXIA Game
- **Date:** 2026-10-18
- **Status:** open
- **Engineering authority:** `ENG-CONTRACT-ORBIT-PLANE-0001`
- **Source files:** `systems/inclined-orbit-transfer-contract-r1.md`, `systems/inclined-orbit-transfer-contract-r1.json` in `kueper-engineering`

## Request

Integrate the Engineering inclined-orbit transfer contract into the NOXIA gameplay/runtime layer without redefining orbital mechanics locally.

Required consumer behavior:

- store/consume inclination, RAAN and epoch for non-coplanar orbital states;
- derive mutual plane angle from inclination + RAAN, not `|Δi|` alone;
- surface F0/F1 player-facing simplifications while preserving Engineering-derived quantitative results;
- return `unresolved` when required plane geometry is missing;
- include plane geometry in transfer feasibility and transfer-window logic;
- do not silently assume RAAN = 0 or coplanarity;
- keep credits, ticks, UI wording and balancing in NOXIA.

## Architecture preference

Use one shared orbital-mechanics implementation/service/library that can also be consumed by `noxia-realtime`, rather than duplicating formulas in two codebases.

## Acceptance

- existing coplanar routes remain compatible;
- non-coplanar transfer tests cover equal-inclination/different-RAAN cases;
- route cost changes with local maneuver speed;
- combined burns use vector delta-v rather than additive plane-change surcharge;
- unknown geometry fails closed;
- Engineering authority reference is retained in result metadata.
