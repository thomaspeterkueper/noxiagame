# NOXIA-LIVING-0005 — Population decision ownership

Status: accepted
Date: 2026-08-31

NOXIA now has two deterministic person layers with explicit ownership. Named persons (`person_key != null`) are decided by `lib/game/personBrain.ts`; the general population engine may advance their physiological needs but must not overwrite their decisions. Unnamed active persons are decided by `lib/game/population/decision.ts`, using needs, assignments, skills, relationships and personal knowledge. `lib/game/population/engine.ts` is the persistence adapter for that decision core.

World truth, personal knowledge and decisions remain separate. A background person may react to a local problem only when the problem is represented in that person's `person_knowledge`; global colony state alone is not silently converted into individual knowledge.

The 497-person Tharsis Hub seed remains a separate follow-up because individual assignments must reference the final physical seed objects rather than provisional IDs.
