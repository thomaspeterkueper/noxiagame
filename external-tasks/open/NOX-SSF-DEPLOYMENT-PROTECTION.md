---
id: NOX-SSF-DEPLOYMENT-PROTECTION
requester: SYS:KUEPER:noxia
recipient: SYS:KUEPER:ssf
type: ops
priority: critical
created: 2026-07-20
blocking: [NOXIA-BETA]
---

# NOX-SSF — Vercel Deployment Protection für SSF /api/* deaktivieren

## Problem

Alle SSF API-Endpunkte die NOXIA braucht geben HTTP 403 zurück:
```
https://solarsciencefoundation.vercel.app/api/noxia/completion?uid=test → 403
https://solarsciencefoundation.vercel.app/api/learning-paths → 403
https://solarsciencefoundation.vercel.app/api/noxia/modules → 403
```

CORS-Header wurden in SSF eingebaut (commit-Zusammenfassung vorhanden).
Der 403 kommt **vor** dem CORS-Check — Vercel Deployment Protection blockiert.

## Lösung

**Vercel Dashboard → SSF-Projekt → Settings → Deployment Protection**

Option A (empfohlen): Deployment Protection nur für `/api/*` deaktivieren
Option B: Deployment Protection komplett deaktivieren (einfacher)

## Betroffene Endpunkte

- `GET /api/noxia/completion?uid={uid}` — Abschluss-Check nach Quiz
- `POST /api/noxia/completion` — Abschluss speichern
- `GET /api/learning-paths` — Lernpfad-Liste
- `GET /api/noxia/modules` — Modul-Liste für NOXIA

## Test nach Fix

```bash
curl https://solarsciencefoundation.vercel.app/api/noxia/completion?uid=test \
  -H "Origin: https://noxiagame.vercel.app"
# Erwartet: 200 mit { "uid": "test", "completions": [] }
```

## Blocks

- NOXIA Beta-Start
- SSF-Unlock-Kette end-to-end
- Alle SSF-0009 bis SSF-0018 Lernpfade nutzbar

## Genaue Schritte im Vercel Dashboard

1. https://vercel.com/dashboard öffnen
2. Projekt **solarsciencefoundation** auswählen
3. **Settings** → **Deployment Protection**
4. Falls "Password Protection" oder "Vercel Authentication" aktiv:
   - Entweder komplett deaktivieren
   - Oder "Bypass for Preview Deployments" + Ausnahme für /api/* konfigurieren
5. Speichern — kein Redeploy nötig

## Test nach Fix

```bash
curl https://solarsciencefoundation.vercel.app/api/learning-paths
# Erwartet: HTTP 200 + JSON mit paths-Array
```

## Alternative: Vercel Protection Bypass Secret

Falls Deployment Protection bleiben soll:
1. Settings → Deployment Protection → "Protection Bypass for Automation"
2. Secret generieren, z.B. `SSF_BYPASS_SECRET=xyz123`
3. NOXIA: Alle Requests an SSF mit Header `x-vercel-protection-bypass: xyz123`
4. In NOXIA `.env.local`: `SSF_BYPASS_SECRET=xyz123`


## Erledigt 2026-07-21

SSF_BYPASS_SECRET in NOXIA Vercel gesetzt. ssfKnowledge.ts sendet Header. Erledigt.
