# NOXIA-AGENT-INFRA-0001 – Sichtung der offenen Pull Requests

Datum: 2026-10-17
Bezug: Abschlussbericht Phase 0, Abschnitt „Weiterer Rückstand"
Methode: GitHub REST API (`pulls`, `compare main...<head>`, `check-runs`), Prüfung, ob die Dateien eines PRs inhaltsgleich oder funktional bereits auf `main` liegen, und Probeanwendung kleiner Patches auf `main`. Geschlossen wurde nur, was nachweislich ersetzt ist; alle Branches bleiben erhalten.

## Ergebnis auf einen Blick

| Kategorie | PRs |
|---|---|
| Geschlossen – nachweislich ersetzt | #460, #333 (plus am Morgen #484, #485, #487, #488, #490–#493) |
| Klein und mergebereit – Entscheidung des Inhabers | #489 |
| Aktuell und wertvoll – Rebase nötig | #482, #481, #478, #476, #358 |
| Veraltet (über 200 Commits hinter `main`) – Entscheidung nötig | #471, #468, #455, #375, #334, #322, #316, #314, #281, #231, #215 |
| In Arbeit, nicht Teil der Sichtung | #496, #498, #499 |

## Geschlossen

- **#460 Gewohnheitsschicht:** Die Schicht ist seit `188ffa1c` auf `main` und wurde dort weiterentwickelt (`decision.ts` nutzt `habitActionModifier`). Es fehlte nur der Test. Er wurde aus dem bestehenden Branch `claude/habit-test-from-460` auf `main` übernommen (`0db10a7e`, Script `test:npc-habit`, lokal grün).
- **#333 Enceladus-Provenienz:** #358 beschreibt sich selbst als sauberer Nachfolger („Supersedes #333"); fünf von sieben gemeinsamen Dateien sind identisch, die beiden anderen in #358 bereinigt.

## Mergebereit

- **#489 WASD-Fokus (Earth):** Eine Zeile in `app/earth/EarthWalkableSurface.tsx`; Tastatursteuerung greift nicht mehr in Eingabefelder, Buttons und Dialoge ein. Lässt sich sauber auf `main` anwenden, Checks grün. Nicht selbst gemergt, weil es Spielverhalten ändert.

## Aktuell – Rebase nötig

| PR | Inhalt | hinter `main` | Checks | Hinweis |
|---|---|---:|---|---|
| #482 | Earth: historische Provenienz, Microregions, Mittelmeer-Reise (Nachfolger von #361) | 22 | 3 ✓ | 10 neue Dateien, nur `earthLandmarks.ts` überschneidet sich |
| #481 | Kognition: Körperkern, Interozeption, Regulation (Nachfolger von #459) | 24 | 9 ✗ · 3 ✓ | erst Fehlerursache klären |
| #478 | Performance: World-Reads pro Request zusammenführen | 204 | 2 ✓ | nur 2 neue Dateien – Rebase einfach |
| #476 | Earth: Café direkt aus der 2.5D-Szene betreten | 234 | 1 ✓ | Eingangslogik ist auf `main` inzwischen anders umgesetzt; der Koordinatenteil (`toSceneCoordinates`) fehlt dort noch. Prüfen, ob er noch gebraucht wird, sonst schließen |
| #358 | Enceladus-Probenprovenienz | 729 | 1 ✓ | nur neue Dateien, Rebase einfach |

## Veraltet – Entscheidung nötig

Alle über 200 Commits hinter `main`, keine Dateien inhaltsgleich auf `main`. Empfehlung je PR: entweder als neuer Auftrag nach `coordination/TASK-TEMPLATE.md` neu aufsetzen oder schließen.

| PR | Inhalt | Alter | Änderung | Checks | Besonderheit |
|---|---|---|---|---|---|
| #471 | Population: unveränderte Bedürfnis-Zeitstempel nicht anfassen | 09.10. | +56/−15 | 1 ✗ | berührt `engine.ts`/`tick.ts` |
| #468 | Forschung: O5-Zugangskontraste | 09.10. | +177/−1 | 5 ✗ | |
| #455 | Kognition: affektive Interozeption | 07.10. | +158/−1 | 6 ✗ | überschneidet sich thematisch mit #481 – zusammen entscheiden |
| #375 | Pflegenetzwerke und Stations-KI | 03.10. | +68 | 1 ✗ | **enthält Datenbank-Migration** |
| #334 | Beobachtung: atmosphärische Refraktion | 28.09. | +162/−1 | 3 ✗ | |
| #322 | Kulturelle Orte (CES) | 27.09. | +181 | 2 ✓ | |
| #316 | Langfristige Ziele aus sozialem Gedächtnis | 27.09. | +115/−8 | 4 ✓ | **enthält Datenbank-Migration** |
| #314 | Earth-Startsiedlung spielbar | 27.09. | +55 | 3 ✓ | |
| #281 | Sauerland-Shuttleport | 24.09. | +8 | 1 ✓ | |
| #231 | Agenten-Auftrag Earth-Logistik-Übergabe | 21.09. | +1939/−53 | 1 ✗ | sehr groß, 18 Dateien |
| #215 | Autonomer Akteur/Beobachter | 19.09. | +93/−1 | 1 ✗ | |

PRs mit Migrationen (#375, #316) dürfen nur als eigener Auftrag mit `risk_class: migration` wieder aufgenommen werden.

## Beobachtung

Bei #481 und #482 wurden die Vorgänger (#459, #361) korrekt geschlossen. Bei #494, #495 und #358 blieben die Vorgänger (#484, #485, #333) dagegen offen, bis diese Sichtung sie schloss. Künftig gehört zum Nachfolger-PR immer das Schließen des Vorgängers mit Verweis.
