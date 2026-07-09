# NOX-0005 — fetchNoxiaUnlocks() targets a route that does not exist in SSF

## Target System
NOXIA

## Origin
Solar Science Foundation project conversation — cross-system architecture review (Ist-Zustand 2026-07-03), verified against both codebases

## Target File
`lib/knowledge/remote.ts`

## Reason
`fetchNoxiaUnlocks()` called a NOXIA-facing SSF route that does not exist:

```ts
const url = `${baseUrl}/api/noxia/unlocks/${encodeURIComponent(userId)}`;
```

The actual per-player route exposed by SSF is:

```ts
GET /api/player/[id]/unlocks
```

The returned shape differs from NOXIA's internal `NoxiaUnlockPayload`: SSF returns `{ schema, playerId, completedModules, unlocks }`, while NOXIA expects `{ userId, completedModules, unlocked, buildings }`.

## Requested Change
1. Change `fetchNoxiaUnlocks()` to call `/api/player/{userId}/unlocks`.
2. Adapt SSF's response shape in `remote.ts`.
3. Use the canonical `SSF_BASE_URL` path from NOX-0003.
4. Remove or correct invalid local demo module `LRN:SSF:PHY-1201`.

## Status
Done

## Completion Notes
- `lib/knowledge/remote.ts` now calls `/api/player/${userId}/unlocks`.
- Added a response adapter:
  - `playerId` → `userId`
  - `unlocks` → `unlocked`
  - missing `buildings` are derived locally via `getUnlockedBuildings(progress)`.
- No new URL variable was introduced. The existing canonical `getSolarScienceFoundationBaseUrl()` path is used.
- Removed invalid demo module `LRN:SSF:PHY-1201` from `lib/knowledge/service.ts`.

## Commits
- `12359d2` — Add NOX-0005 external task
- `366afb4` — Fix SSF unlock route adapter
- `76e1eee` — Remove invalid demo knowledge module

## Created
2026-07-03

## Completed
2026-07-09
