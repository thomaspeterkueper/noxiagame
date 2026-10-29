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
- Koloniesicht (Kachelraster);
- Erde: Weltkarte und Erdoberfläche (seit 29.10.2026, Szene `earth`, Bodenmeter: x = Länge × 111 320 × cos(Breite), y = Breite × 110 574).

**Nicht aufgezeichnet:** Tastendrücke, Inhalte von Eingabefeldern (Gespräche stehen im Gesprächsprotokoll), Antworten des Servers. Bereiche mit `data-noxia-private` werden übersprungen. Nur angemeldete Spieler.

**Aufbewahrung:** In der Alpha wird nichts gelöscht (wie bei den Gesprächen). Löscht ein Spieler sein Konto, gehen seine Zeilen mit.

**Vor einem öffentlichen Start [OFFEN]:** Hinweis an die Spieler, Möglichkeit, die Aufzeichnung abzulehnen, Regel zur Aufbewahrung.

**Hinweis 28.10.2026:** Bis etwa 15:30 Uhr Berliner Zeit fehlten der Server-Rolle die Rechte an den neuen Tabellen (Fehler 42501). Die Aufzeichnung, das Gesprächsprotokoll seit dem 27.10. abends, das Wissen der Figuren und die Akademie-Ergebnisse wurden bis dahin nicht gespeichert. Behoben mit `20261028180000_grant_service_role_new_tables.sql`.

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

## Erste Auswertung (29.10.2026)

Datenlage: eine Sitzung (McKnight, 28.10.2026, 17:01–17:26 Uhr, 282 Ereignisse), danach nicht gespielt. Dazu die Laufzeitfehler des Servers (Vercel, 24 Stunden). Befunde und was daraus wurde:

| Befund | Ursache | Behoben |
|---|---|---|
| 86 Fehler beim Laden der Kartenkacheln (17 × Serverfehler, 69 × abgebrochen) | Objekte einer Region wurden mit Versatz seitenweise gelesen; jede Seite las den ganzen Primärschlüssel (75 000 Zeilen, 0,44 s je Seite) und lief bei vielen Kacheln gleichzeitig in die Zeitgrenze von 8 s (Fehler 57014). Die abgebrochenen sind meist Ansichtswechsel. | Index `region_features (region_id, id)` und Weiterblättern über die letzte ID: 6 ms je Seite (`tileSource.server.ts`, Migration `20261029040000_region_features_region_id_id.sql`). |
| 17 Wutklicks auf „Menge erhöhen“ (Handel, Phobos) | Vor der Wahl Kauf/Verkauf galt als Obergrenze der freie Laderaum; bei vollem Laderaum blieb die Menge stumm bei 1. | Vor der Wahl gilt Bestand oder Laderaum, je nachdem, was größer ist; an der Grenze ist der Knopf gesperrt und sagt warum (`BuyRow.tsx`). |
| 20 × Status 409 von Förderung, Erkundung, Bohrung, Probenanalyse | Die Phobos-Ansicht fragt den Stand ab, auch wenn man von der Erde aus plant; die Abfrage antwortete „nur vor Ort“ als Fehler. | Abfragen aus der Ferne antworten jetzt mit leerer Liste und Hinweis (`onSite: false`), Handlungen bleiben gesperrt. |
| (Serverprotokoll) 20 Ticks ohne Standorte der Menschen | Wer arbeitete, aber nur eine Wohnung im realen Haus hatte, brachte eine leere Kachel-ID in die Abfrage („invalid input syntax for type uuid: "null"“); die ganze Standortberechnung brach ab. | Leere IDs werden herausgefiltert (`surfacePresence.ts`, Test vorhanden). |
| Kaum Laufwege | Die Erde meldete keine Positionen. | Weltkarte und Erdoberfläche melden jetzt mit (siehe oben). |

Offen: Die Baubarkeitsprüfung auf der Erde scheiterte 4-mal (Status 400), eine Lokal-Schicht 2-mal (404) – zu wenige Fälle, um die Ursache sicher zu sagen; mit mehr Sitzungen wieder ansehen.
