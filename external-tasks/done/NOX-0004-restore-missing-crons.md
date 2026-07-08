# NOX-0004 — vercel.json: fehlende Cron-Jobs wiederherstellen

## Target System
NOXIA

## Origin
KueperKnowledgeGraph — Architektur-/Datenfluss-Review (Ist-Zustand 2026-07-03), am Code verifiziert

## Target File
`vercel.json`

## Reason
`SETUP.md` beschreibt drei Crons — `population`, `prices`, `orders`. Die reale `vercel.json` enthielt nur `population`, wodurch `prices` und `orders` nicht geplant liefen.

## Requested Change
1. Klären, ob `prices` und `orders` weiterhin gebraucht werden.
2. Falls ja: Cron-Einträge ergänzen und Pfade prüfen.
3. Falls nein: `SETUP.md` korrigieren.
4. Sicherstellen, dass Ziel-Routen existieren.

## Status
Done

## Completion Notes
- `/api/cron/prices` existiert.
- `/api/cron/orders` existiert.
- `vercel.json` enthält jetzt wieder alle drei Crons:
  - `/api/cron/population` täglich 08:00
  - `/api/cron/prices` alle 30 Minuten
  - `/api/cron/orders` stündlich Minute 15
- `SETUP.md` ist synchron zur `vercel.json`.

## Commits
- `718a7a8` — Restore economy cron jobs
- `df405c9` — Document canonical SSF base url env / Cron-Doku synchronisiert

## Created
2026-07-03

## Completed
2026-07-08
