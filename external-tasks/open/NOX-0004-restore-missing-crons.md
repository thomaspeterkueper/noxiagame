# NOX-0004 — vercel.json: fehlende Cron-Jobs wiederherstellen

## Target System
NOXIA

## Origin
KueperKnowledgeGraph — Architektur-/Datenfluss-Review (Ist-Zustand 2026-07-03), am Code verifiziert

## Target File
`vercel.json`

## Reason
`SETUP.md` (Alpha 0.1) beschreibt **drei** Crons — `population`, `prices`, `orders`.
Die reale `vercel.json` enthält aber nur **einen**. `prices` und `orders` laufen
damit weder geplant noch automatisch.

Verifiziert — aktueller Inhalt von `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/population", "schedule": "0 8 * * *" }
  ]
}
```

## Requested Change
1. Klären, ob `prices` und `orders` weiterhin gebraucht werden.
2. Falls ja: die zugehörigen Cron-Einträge in `vercel.json` ergänzen (Pfade prüfen,
   z. B. `/api/cron/prices`, `/api/cron/orders`; Schedules festlegen).
3. Falls nein: `SETUP.md` korrigieren, damit Doku und Realität übereinstimmen.
4. Sicherstellen, dass die Ziel-Routen (`/api/cron/*`) tatsächlich existieren.

## Priority
Medium

## Blocking
Nicht deployment-blockierend, aber funktional relevant: fehlende Preis-/Order-Ticks
verändern das Spielverhalten gegenüber der dokumentierten Spezifikation.

## Status
Open

## Created
2026-07-03
