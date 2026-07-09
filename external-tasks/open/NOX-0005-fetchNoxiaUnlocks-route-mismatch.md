# NOX-0005 — fetchNoxiaUnlocks() targets a route that does not exist in SSF

## Target System
NOXIA

## Origin
Solar Science Foundation project conversation — cross-system architecture review (Ist-Zustand 2026-07-03), verified against both codebases

## Target File
`lib/knowledge/remote.ts`

## Reason
`fetchNoxiaUnlocks()` calls:

```ts
const url = `${baseUrl}/api/noxia/unlocks/${encodeURIComponent(userId)}`;
```

This route does not exist in the SSF repo. SSF's actual NOXIA-facing routes are `/api/noxia/modules`, `/api/noxia/unlocks/demo` (fixed demo data), and `/api/noxia/unlocks/check` (POST, takes `completedModules` in the body — a different contract entirely). The real per-player endpoint SSF exposes is `GET /api/player/[id]/unlocks`, at a different path than what NOXIA calls.

If `KNOWLEDGE_SOURCE=ssf` were enabled today, every call would 404. This has not been noticed because `getNoxiaKnowledgeState()` (`lib/knowledge/service.ts`) wraps the call in try/catch and silently falls back to `getLocalKnowledgeState()` on any failure - the integration looks inert rather than broken, which is why it went unnoticed until this review.

Verified in code:

```text
lib/knowledge/remote.ts:11   `${baseUrl}/api/noxia/unlocks/${encodeURIComponent(userId)}`
SSF app/api/ (actual routes):
  /api/noxia/modules
  /api/noxia/unlocks/demo
  /api/noxia/unlocks/check        (POST, different contract)
  /api/player/[id]/unlocks        (GET, the real per-player route)
```

## Requested Change

1. Change `fetchNoxiaUnlocks()` to call SSF's actual route:

```ts
const url = `${baseUrl}/api/player/${encodeURIComponent(userId)}/unlocks`;
```

2. Confirm the response shape matches what `NoxiaUnlockPayload` expects (`completedModules`, `unlocked`, `buildings`) - SSF's `/api/player/[id]/unlocks` currently returns `{ schema, playerId, completedModules, unlocks }`, which does not line up field-for-field (`unlocks` vs `unlocked`, no `buildings` key). This may need a small adapter in `remote.ts` rather than a raw pass-through, or a matching change requested on the SSF side - flagging rather than guessing which side should absorb the shape difference.

3. Use `SSF_BASE_URL` (per `NOX-0003`'s accepted resolution) as the single canonical base - do not introduce a third URL variable while fixing this.

## Secondary, smaller item found in the same file

`lib/knowledge/service.ts`'s `demoCompletedModules` includes `LRN:SSF:PHY-1201`, an id that does not exist in any current Knowledge Graph or SSF export (`PHY-1101`, `PHY-2201`, `PHY-2202` exist; `PHY-1201` does not). Likely a stray/typo'd id in local demo data - low priority, but worth correcting or removing so local fallback data doesn't reference a module that was never real.

## Priority
High — this is the one concrete blocker preventing NOXIA→SSF from working at all, even with `KNOWLEDGE_SOURCE=ssf` set and `NOX-0003`'s URL fix applied.

## Blocking
Blocks any real activation of `KNOWLEDGE_SOURCE=ssf`. Currently masked by the silent local-fallback behaviour, so it will not surface as an error - only as a permanently-inert integration.

## Status
Open

## Created
2026-07-03
