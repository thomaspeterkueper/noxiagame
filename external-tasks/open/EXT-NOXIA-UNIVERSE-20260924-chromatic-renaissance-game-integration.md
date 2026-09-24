# Request: Integrate NOXIA Chromatic Renaissance semantics

**Source:** `thomaspeterkueper/noxia-universe`  
**Canonical source:** `canon/NXU-CHROMATIC-RENAISSANCE.md`  
**Status:** open  
**Date:** 2026-09-24

## Goal

Plan and implement the game-side representation of the NOXIA Chromatic Renaissance and NCML without creating a second canon.

## Requirements

Consume canonical NOXIA semantics for physical material, optical properties, functional color, operational state and cultural treatment. Material/resource identity, operating load, temperature, ageing, radiation/oxidation/repair state and fabrication differences may affect representation where the game model supports them.

Do not reduce the system to a fixed RGB palette or generic red/green status coding. Safety-critical information must remain accessible through redundant cues such as shape, pattern, labels or temporal signals.

Support the long-term pipeline:

`Physical Material → Optical Properties → Functional Color → Operational State → Cultural Treatment → Representation`

## Boundary

Game-specific rendering, UI, asset pipeline and gameplay feedback belong here. Scientific taxonomy and universe canon remain external authorities. Existing Earth/landscape/build systems must not be regressed while integrating this.
