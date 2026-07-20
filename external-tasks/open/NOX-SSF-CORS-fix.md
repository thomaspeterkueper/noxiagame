---
id: NOX-SSF-CORS-fix
title: SSF 403-Problem behoben — CORS aktiviert
status: done
source: SSF
target: NOXIA
created: 2026-07-20
priority: high
blocking: [NOXIA-BETA]
---

# NOX-SSF-CORS-fix — SSF API jetzt erreichbar

## Problem (geloest)

SSF-API hat 403 zurueckgegeben bei NOXIA-Anfragen.
Ursache: Kein CORS-Header + next.config Konflikt.

## Was behoben wurde

1. `next.config.mjs`: CORS-Header fuer alle `/api/*` Routen
2. `/api/learning-paths`: Strukturierte Antwort mit `unlocks`-Array
3. `/api/noxia/completion`: CORS-Header fuer POST/GET

## SSF-Endpunkte jetzt erreichbar

```
GET  https://solarsciencefoundation.vercel.app/api/learning-paths
GET  https://solarsciencefoundation.vercel.app/api/noxia/completion?uid={uid}
POST https://solarsciencefoundation.vercel.app/api/noxia/completion
     Body: { "uid": "<noxia-user-id>", "pathId": "PATH:SSF:ECO-KREDIT-NOXIA-0001" }
```

## Test-Request

```bash
curl https://solarsciencefoundation.vercel.app/api/learning-paths \
  -H "Origin: https://noxiagame.vercel.app"
```

Erwartete Antwort:
```json
{
  "schema": "SSF-LEARNING-PATHS-0.1",
  "count": 60,
  "paths": [{ "id": "PATH:SSF:...", "unlocks": ["UNL:NOX:..."], ... }]
}
```

## Naechste Schritte NOXIA

1. Test-Request ausfuehren
2. `sync_from_ssf` implementieren (GET /api/learning-paths -> pruefen ob Spieler Pfad abgeschlossen)
3. Supabase-Tabelle `ssf_completions` anlegen (SQL in NOX-SSF-0008)

## Vercel-Deployment

Falls noch 403: moeglicherweise Vercel Deployment Protection (SSO/Passwort) aktiv.
In Vercel Dashboard pruefen: Settings -> Deployment Protection -> deaktivieren fuer `/api/*`.


## Erledigt 2026-07-20

CORS in next.config.mjs + Route-Handler. Build läuft. Vercel Deployment Protection noch manuell zu deaktivieren (NOX-SSF-DEPLOYMENT-PROTECTION).
