# NOXIA-TIME-0001 – Zeitmaßstab 60× und Forschungslauf

Status: accepted (Zielwert und Forschungslauf), proposed (Umbau der Live-Welt)
Date: 2026-10-08

## Kontext

Die Live-Welt läuft in Echtzeit: Ein Tick ist eine Stunde, ein Koloniestag dauert einen echten Tag, ein Marsflug sieben Monate. Zwei Dinge leiden darunter:

- Spieler sehen in einer Sitzung kaum Veränderung, und lange Reisen sind nicht spielbar.
- Annahmen über das Zusammenleben lassen sich nicht prüfen, weil ihre Folgen erst nach Monaten oder Jahren sichtbar würden.

Das sind zwei verschiedene Bedürfnisse mit zwei verschiedenen Lösungen.

## Entscheidung 1 – Zielwert 60× für die Live-Welt

Eine echte Minute ist eine Spielstunde.

| Spielzeit | Echtzeit |
|---|---|
| 1 Tag | 24 Minuten |
| 1 Jahr | rund 6 Tage |
| Marsflug von 7 Monaten | rund 3,5 Tage |
| eine Generation (25 Jahre) | rund 5 Monate |

Der Lebenslauf in `population/socialLife.ts` läuft heute mit 12× (ein Jahr in 720 Ticks). Er wird auf denselben Faktor gezogen, damit es nur eine Uhr gibt.

Begegnungen zwischen Spieler und NPC laufen in Echtzeit und werden als ein Ereignis fester Dauer gebucht. Die NPC-Person ist für einen Simulationsschritt gebunden, unabhängig davon, wie lange das Gespräch real dauert.

## Entscheidung 2 – Forschungslauf außerhalb der Live-Welt

`lib/research/colony/colonyRun.ts` rechnet die lebende Bevölkerung im Speicher durch, mit demselben Code wie der Live-Tick: Entscheidung, Tagesrhythmus, Begegnung, Erinnerung, Beziehung, Affekt. Es gibt keine Datenbankzugriffe. Gleicher Ausgangszustand und gleiches Szenario ergeben denselben Lauf.

Gemessen: zehn Spieljahre für 31 Personen in rund 17 Sekunden.

Bedienung und erster Befund stehen in `docs/research/colony-run.md`.

## Offener Umbau der Live-Welt

Bei 60× müsste der Server jede Minute eine Spielstunde rechnen. Ein Tick dauert heute rund 50 Sekunden. Deshalb werden Geschwindigkeit und Rechenschritt entkoppelt:

1. **Spielzeit statt Tickzahl.** Alle Raten und Abklingzeiten (Bedürfnisse, Affekt, Abklingzeit der Begegnungen, Bankzinsen, Produktion) werden auf Spielstunden bezogen, nicht auf Ticks.
2. **Grober Serverschritt.** Ein Schritt umfasst mehrere Spielstunden bis zu einem Spieltag.
3. **Feine Anzeige.** Wer gerade schläft oder arbeitet, folgt aus Uhrzeit und Tagesrhythmus und wird in der Oberfläche berechnet.
4. **Stundengenau nur dort, wo ein Spieler zuschaut** (Simulationsstufe `active`).

Reihenfolge: zuerst die Personen, dann die Wirtschaft. Bis dahin bleibt die Live-Welt bei einem Tick pro Stunde.
