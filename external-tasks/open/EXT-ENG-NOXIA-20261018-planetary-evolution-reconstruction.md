# EXTERNAL TASK — Planetary evolution reconstruction gameplay integration

- **Origin:** KUEPER Engineering
- **Target:** NOXIA Game
- **Date:** 2026-10-18
- **Status:** open
- **Engineering authority:** `ENG-AUTH-PLANEVOL-0001`

## Request

Integrate planetary-history reconstruction gameplay against the Engineering coupling authority without exposing hidden planetary history directly.

Required behavior:

- consume observation/proxy products rather than authoritative hidden reservoirs;
- support multiple competing reconstructions where evidence is non-unique;
- expose uncertainty, provenance and model assumptions;
- keep uplift, weathering, erosion, nutrient flux, productivity, burial and redox as distinct causal steps;
- never encode deterministic shortcuts such as `mountains -> complex life`;
- retain event provenance for geological transitions;
- allow scientific missions to reduce uncertainty rather than simply unlock truth.

## Acceptance

- missing evidence yields unresolved/ambiguous reconstruction rather than a default history;
- identical observations with shared systematic ambiguity do not count as independent confirmation;
- reconstruction results reference `ENG-AUTH-PLANEVOL-0001`;
- credits, ticks, UI, progression and balancing remain NOXIA-owned.
