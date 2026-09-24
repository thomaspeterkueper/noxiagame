# EXTERNAL TASK — Energy Grid Layer + learning module

- **Origin:** Engineering / OTA / NOXIA Universe
- **Target:** NOXIA Game
- **Date:** 2026-09-25
- **Status:** open

## Request
Design a playable Energy Grid Layer where installed generation is not equivalent to usable delivered power.

## Gameplay
Represent generation nodes, substations/transformers, links, storage and loads with capacity constraints, losses, congestion and curtailment. Give players legible diagnostics showing where a bottleneck occurs and meaningful remedies: reinforce links, add substations/storage/local generation, relocate loads, shift schedules or accept curtailment.

Integrate flexible loads such as industry and MiniNode/robot-swarm charging.

## Learning module
Create an optional scenario-driven module that teaches the system through play rather than exposition. Example progression:
1. Build renewable generation.
2. Observe that output cannot fully reach the settlement.
3. Identify the constrained link/substation.
4. Compare grid reinforcement, storage and load shifting.
5. Experience night/low-generation conditions.
6. Transfer the same principles to an isolated lunar/Mars microgrid.

Show cause/effect with simple overlays and before/after metrics. Keep the simulation underneath richer than the teaching UI. Learning content must remain optional and compatible with normal gameplay.