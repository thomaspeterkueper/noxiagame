---
id: NOX-SSF-0019-deep-link-ready
title: SSF Deep-Link API bereit
status: open
source: SSF
target: NOXIA
created: 2026-07-21
priority: high
---

# SSF-0019 Deep-Link API implementiert

## Verfügbare Endpunkte

### Option 1: /learn mit Query-Params
```
https://solarsciencefoundation.vercel.app/learn?path=PATH:SSF:ECO-KREDIT-NOXIA-0001&ref=noxia&uid={uid}
https://solarsciencefoundation.vercel.app/learn?module=ECO-L0-000001&ref=noxia&uid={uid}
```
→ Redirect zu /learning-paths/[id]?uid={uid}&ref=noxia

### Option 2: Redirect API
```
https://solarsciencefoundation.vercel.app/api/noxia/redirect?path=PATH:SSF:ECO-KREDIT-NOXIA-0001&uid={uid}
```
→ 302 Redirect zur Lernpfad-Seite
→ Mit Accept: application/json → { url, pathId, title }

## NOXIA-Aktion

Links in NOXIA auf diese Formate umstellen.
Bypass-Secret ist gesetzt — APIs sollten ohne 403 antworten.
