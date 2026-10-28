# Spielerverhalten in der Testphase – Aufzeichnung und Auswertung

Stand: 28.10.2026. Wunsch Thomas (28.10.2026): untersuchen, was Spieler eigentlich tun, um herauszufinden, was nicht geht und wo man nachbessern sollte – wohin sie laufen, worauf sie klicken, „schon fast eine komplette Verhaltensstudie“. Gegenstück zu den Gesprächen: `docs/reviews/npc-gespraeche-testphase.md`.

## Was aufgezeichnet wird

Tabelle `player_activity_log` (Migration `20261028110000_player_activity_log.sql`), eine Zeile je Ereignis. Jede Zeile trägt Seite, Ort und Spielmodus (begehbar, Planung, Innenraum).

| Art | Was | Wozu |
|---|---|---|
| `session_start` | Bildschirmgröße, Sprache, Zeitzone, Touch, Mobilgerät | Wer spielt womit |
| `heartbeat` | jede Minute, in der jemand aktiv war | Aktive Spielzeit |
| `view` | Seite, Ort oder Spielmodus gewechselt | Wohin Spieler gehen |
| `click` | Klick auf etwas Bedienbares, mit Beschriftung und Stelle im Fenster | Worauf geklickt wird |
| `dead_click` | Klick auf etwas, das nicht bedienbar aussieht | Was Spieler für bedienbar halten, aber nichts tut |
| `rage_click` | drei schnelle Klicks an derselben Stelle | Frust: Es reagiert nichts |
| `action` | Spielaktion an den Server (alles außer Abrufen), mit Status und Dauer | Was Spieler tun |
| `api_error` | Serveranfrage fehlgeschlagen (Status, Aktion) | Was nicht geht |
| `js_error` | Fehler im Browser | Was kaputt ist |
| `position` | Standort der Figur in einer begehbaren Ansicht, auf 2 m gerundet, höchstens alle 5 s | Laufwege, wo sie hängen bleiben |

**Wie:** allgemein statt je Ansicht (`lib/telemetry/playerActivity.ts`, eingehängt im Root-Layout über `app/_components/PlayerActivityRecorder.tsx`). Ein Klick-Lauscher, ein Umschlag um `fetch` und die Fehler-Lauscher decken das ganze Spiel ab. Neue Ansichten sind automatisch dabei. Gesammelt wird alle 15 s und beim Verlassen der Seite, angenommen über `/api/game/activity`.

**Laufwege** melden bisher:
- Mond, Mars, Phobos, Deimos (`PlanetaryWalkableSurface`);
- Innenräume (`WalkableInterior`, `LandmarkWalkableInterior`);
- Koloniesicht (Kachelraster).
- **Offen:** die begehbare Erdoberfläche (`EarthWalkableSurface`).

**Nicht aufgezeichnet:** Tastendrücke, Inhalte von Eingabefeldern (Gespräche stehen im Gesprächsprotokoll), Antworten des Servers. Bereiche mit `data-noxia-private` werden übersprungen. Nur angemeldete Spieler.

**Aufbewahrung:** In der Alpha wird nichts gelöscht (wie bei den Gesprächen). Löscht ein Spieler sein Konto, gehen seine Zeilen mit.

**Vor einem öffentlichen Start [OFFEN]:** Hinweis an die Spieler, Möglichkeit, die Aufzeichnung abzulehnen, Regel zur Aufbewahrung.

## Auswerten

```sql
-- Sitzungen: Dauer, aktive Minuten, Klicks, tote Klicks, Fehler, Orte, Gerät
select * from player_sessions limit 30;

-- Was nicht geht: tote Klicks und Wutklicks je Ort, Ansicht und Ziel
select * from player_friction limit 40;

-- Fehler: Serveranfragen und Browserfehler
select * from player_errors limit 40;

-- Worauf geklickt wird, welche Spielaktionen laufen
select * from player_clicks limit 40;

-- Wohin gelaufen wird: Aufenthalte je Szene in 10er-Feldern
select * from player_paths where scene = 'moon' limit 100;

-- Eine Sitzung Schritt für Schritt nachvollziehen
select occurred_at, kind, location, mode, target, data
from player_activity_log
where session_id = '…'
order by occurred_at;
```

Die tägliche Auswertung („NOXIA Gesprächsauswertung“, 7:34 Uhr) liest diese Sichten mit.

## Was sich daraus lernen lässt

- **Tote Klicks auf freie Fläche** zeigen, wo Spieler etwas erwarten, zum Beispiel Bauen auf dem Mond.
- **Wutklicks** zeigen, wo die Antwort zu langsam ist oder fehlt.
- **Fehler mit derselben Aktion bei mehreren Spielern** sind Kandidaten für sofortige Fixes, etwa Kaufen bei vollem Laderaum.
- **Wege, die an derselben Stelle enden**, deuten auf eine Wand oder eine Blockade hin.
- **Sitzungen, die nach wenigen Minuten enden**, gehören zusammen mit ihrer letzten Ansicht gelesen: Wo geben Neue auf?
