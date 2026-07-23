---
id: NOX-SSF-COLONY-STATION-READY
title: SSF Kolonisierungs- und Stations-Lernpfade bereit
status: done
source: SSF
target: NOXIA
created: 2026-07-21
priority: high
---

# SSF-0020/21/22 abgeschlossen

## Neue Lernpfade

| Pfad | Unlock |
|------|--------|
| PATH:SSF:AST-SONNENSYSTEM-0001 | NAV:ORBITAL + **SHIP:SCOUT** (neu) |
| PATH:SSF:ENG-COLONY-FOUND-0001 | **COLONY:FOUND** + SHIP:PIONEER |
| PATH:SSF:ENG-STATION-FOUND-0001 | **STATION:FOUND** + SHIP:PIONEER + NAV:ORBITAL |

## NOXIA Deep-Links

```
/learn?path=PATH:SSF:ENG-COLONY-FOUND-0001&ref=noxia&uid={uid}
/learn?path=PATH:SSF:ENG-STATION-FOUND-0001&ref=noxia&uid={uid}
/api/noxia/redirect?path=PATH:SSF:ENG-COLONY-FOUND-0001&uid={uid}
```

## Gates aktivieren

`found-location/route.ts` — Gate-Pruefung aktivieren wenn SSF-Abschluss
über `/api/noxia/completion?uid={uid}` bestätigt wird.


## Erledigt 2026-07-21

- found-location/route.ts v1.2.0: Gates aktiviert
- unlocks.ts v1.1.0: canFoundColony/Station/Scout/Pioneer hinzugefügt
- Bei 403: SSF Deep-Link wird zurückgegeben
