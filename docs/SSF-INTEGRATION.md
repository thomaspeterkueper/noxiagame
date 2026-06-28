# SSF integration in NOXIA

NOXIA consumes knowledge modules from the Solar Science Foundation instead of owning the learning content directly.

## Environment

Optional Vercel variable:

```text
SSF_BASE_URL=https://solarsciencefoundation.vercel.app
```

If omitted, NOXIA uses the production SSF URL.

## NOXIA endpoints

```text
GET  /api/ssf/modules
POST /api/ssf/unlocks/check
GET  /ssf
```

## Upstream SSF endpoints

```text
GET  https://solarsciencefoundation.vercel.app/api/noxia/modules
POST https://solarsciencefoundation.vercel.app/api/noxia/unlocks/check
```

## Principle

```text
KUEPER Knowledge Graph -> SSF -> NOXIA
```

NOXIA should not write directly to the SSF database. It reads module metadata and unlock status through the SSF API.

## Next step

Map real NOXIA users to SSF users or provide a signed SSF player token. Until then, `/api/ssf/unlocks/check` supports a simple completed-module payload for testing.
