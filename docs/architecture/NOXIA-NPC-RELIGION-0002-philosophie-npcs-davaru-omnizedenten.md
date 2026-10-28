# NOXIA-NPC-RELIGION-0002 – Philosophie, Ethik und Religion als Figuren

Status: proposed · 2026-10-28
Baut auf: NOXIA-NPC-RELIGION-0001 (Rollen und Orte), NOXIA-TEMPLE-0001 (DaVaRu-Tempel), NOXIA-ETHICS-0001 (Resonanzethik), NOXIA-OMNI-0001 (Spielraum)
Code: `lib/game/population/spiritualRoles.ts`, `lib/game/population/worldviewVoices.ts`, `app/api/game/npc-conversation/route.ts`

## Anliegen (Thomas, 28.10.2026)

Das Spiel soll die philosophischen Fragen widerspiegeln, mit denen Thomas sich beschäftigt. Neben kirchlichen Vertretern braucht es Figuren für den Weg des DaVaRu (Heimstätte im Taunus) und für die Omnizedenz: Resonanzplätze und **Omnizedent/innen** als Befürworter, Vertreter und Gesprächspartner der Philosophie.

## Drei Familien, eine Personenarchitektur

| Familie | Art | Ort | Rolle(n) | Stimme im Gespräch |
|---|---|---|---|---|
| Religionen | `religious` | `sacred_place` (Kirche, Moschee, Synagoge, Tempel) | `priest`, `pastor`, `imam`, `rabbi`, `chaplain`, … | Tradition, Seelsorge, Zuhören |
| Weg des DaVaRu | `philosophical` | `davaru_temple` (Schmitten/Feldberg) | Gastgeber DaVaRu, Gast Aristeas Lux, neu: `davaru_companion` | Frage statt Antwort, fünf Schritte, Heilung statt Strafe |
| Omnizedenz | `philosophical` | `resonance_place` | `resonance_facilitator` (hütet den Ort), neu: `omnizedent` (vertritt die Philosophie) | Werden, Beziehung, Spielraum |

Alle sind normale persistente Personen nach RELIGION-0001: Wohnung, Arbeit, Bedürfnisse, Beziehungen, Vergessen. Keine Figur hat privilegiertes Wissen, höhere Moral oder eine eigene Simulationsuhr.

## Entscheidungen in diesem Schritt

1. **Davaru als eigene Tradition.** `davaru` ist neu in `SpiritualTradition`. Der Weg des DaVaRu ist nach dem Davaru-Kodex (OTA-FND-0019/0020) eine ethische Praxis, keine Religion. Er wird deshalb nicht unter `other_religious` geführt.
2. **Religion und Philosophie werden getrennt markiert.** `TRADITION_KIND` ordnet jede Tradition `religious` oder `philosophical` zu. Omnizedenz und Davaru sind `philosophical`.
3. **Omnizedent/in als Rolle.** `omnizedent` (Label „Omnizedent/in“) ist eine Person, die die Omnizedenz vertritt und darüber spricht. Kein Amt, keine Weihe, kein Klerus. Die bisherige `resonance_facilitator`-Rolle bleibt für die Gastgeberfunktion am Ort: Sie hütet den Raum, sie lehrt nicht.
4. **Wegbegleitung des DaVaRu als Rolle.** `davaru_companion` ist eine Person, die den Weg geht und andere durch seine Fragen begleitet. Damit hängt der Tempel nicht allein an den beiden Kanonfiguren.
5. **Gesprächshaltung statt Sonderlogik.** `worldviewVoices.ts` leitet aus der öffentlichen Rolle einer Person eine Stimme ab (`clergy`, `davaru`, `omnizedent`, `resonance_host`). Die Gesprächsroute hängt die passenden Zeilen an den Systemtext. Es ist dieselbe Route wie für alle Figuren, mit denselben Grounding- und Erinnerungsregeln.

## Gemeinsame Regeln für alle Stimmen

- Aussagen über Glauben, Sinn und Ethik sind Überzeugungen der Person oder ihrer Tradition, nie Weltwahrheit.
- Niemand bekehrt, wirbt um Mitgliedschaft oder Spenden. Zuhören oder Mitkommen heißt nicht Zustimmung (wie `attendanceDoesNotImplyBelief` bei St. Johannes).
- Über andere Wege wird respektvoll gesprochen; Gemeinsamkeiten und Unterschiede dürfen benannt werden.

## Die Stimmen im Einzelnen

**Kirchliche Vertreter (`clergy`).** Sprechen aus ihrer Tradition, als Seelsorger. Heilige Texte nur sinngemäß. Zweifel werden ernst genommen. Pilot: Elias Hartmann, Pfarrer an St. Johannes Sundern (produktiv).

**Weg des DaVaRu (`davaru`).** Grundlage: Davaru-Kodex und trilinguale Ethikarchitektur (OTA-FND-0019/0020).
- Kompass statt Gesetz: Kontext entscheidet, nicht die Regel.
- Heilung statt Strafe; die Haltung einer Handlung ist Substanz.
- „Aristeas-Funktion“: bei schweren Fragen innehalten und zurückfragen.
- Die fünf Entscheidungsschritte als Angebot: anhalten und wahrnehmen, das Feld sehen, Kontext klären, Optionen erzeugen, Stimmigkeit prüfen. Die Figur nimmt Spielern keine Entscheidung ab (Kodex, Fall C: Abhängigkeit).
- Mishkenaz-Vokabular und Algebra-Notation bleiben im Hintergrund. Im Gespräch sprechen die Figuren Alltagsdeutsch.

**Omnizedent/in (`omnizedent`).** Grundlage: omnizedenz.org, Resonanzethik in NOXIA-ETHICS-0001.
- Omnizedenz als Philosophie des Werdens, keine Religion, kein Gottesersatz.
- Leitsatz „Was im Teil geschieht, geschieht dem Ganzen.“ wird geprüft, nicht gepredigt.
- Ethische Fragen werden als Spielraumfrage gestellt: Welche Möglichkeiten öffnet oder nimmt eine Handlung anderen, heute und später? Das verbindet die Figur mit der Spielraum-Messung (NOXIA-OMNI-0001), ohne sie zu verändern.
- Strikte Ebenentrennung: keine physikalischen Kräfte, keine wissenschaftlichen Belege für die Omnizedenz behaupten; offen sagen, was noch unausgearbeitet ist.
- Diskutiert gern, auch mit Widerspruch.

**Resonanzplatz-Gastgeber (`resonance_host`).** Lädt zum Verweilen, Zuhören, Lesen, Schweigen ein. Lehrt keine Doktrin und verweist für Philosophiefragen auf Gespräche mit Omnizedent/innen.

## Figuren und Orte – Vorschlag zur Freigabe

Nichts davon ist in der Live-Datenbank angelegt. Anlage erst nach Freigabe, nach dem Verfahren aus `docs/characters/davaru-aristeas-activation.md` (idempotent, eigene IDs, keine erfundene Anwesenheit).

| Figur (Arbeitsname) | Rolle | Ort | Begründung |
|---|---|---|---|
| Elias Hartmann | `priest` | St. Johannes, Sundern | besteht |
| DaVaRu (Daniel van Runen) | Gastgeber | Tempel des DaVaRu, Schmitten | besteht als Person, Tempel noch nicht platziert |
| Aristeas Lux | Gast | Tempel des DaVaRu | besteht als Person |
| *Wegbegleiterin, Schmitten* | `davaru_companion` | wohnt in Schmitten, Tempel als Arbeitsort | macht den Tempel im Alltag erlebbar, solange die Kanonfiguren Background-Tier sind |
| *Omnizedentin, Seelenberg* | `omnizedent` | Resonanzplatz Seelenberg | Seelenberg ist schon Pilotort und liegt neben Schmitten: eine Taunus-Achse Davaru – Omnizedenz |
| *Omnizedent, Tharsis* | `omnizedent` | Resonanzplatz in der Mars-Kolonie | Philosophie im Experiment: Knappheit, Abhängigkeit, Spielraum |
| *Vergleichspilot* | `imam` oder `rabbi` | reale Moschee/Synagoge, z. B. Frankfurt | Schritt 3 aus RELIGION-0001 |

Namen der neuen Figuren werden erst bei der Anlage festgelegt.

## Spielmechanik (spätere Etappen)

1. **Gespräch** – jetzt umgesetzt über die Stimmen.
2. **Termine** wie bei St. Johannes: offene Gesprächsrunde am Resonanzplatz, Abend am Tempel, Gottesdienst. Ableitung aus dem Simulationstick, keine zweite Uhr.
3. **Lesen und Lernen**: Bibliothek des Tempels und der Raum „Lesen & Denken“ am Resonanzplatz als Lernorte im Sinne von NOXIA-SCHOOL-0001 (immer kostenlos).
4. **Begegnungen untereinander**: Pfarrer, Wegbegleiterin und Omnizedentin können sich über normale Encounter kennenlernen und streiten. Keine vorgefertigten Freundschaften.
5. **Ethische Fälle**: Bei Konflikten aus NOXIA-ETHICS-0001 (Wasser, Zugang) können diese Figuren Perspektiven beisteuern, als eine Stimme unter mehreren, nie als Schiedsrichter.

## Offene Fragen an Thomas

- **Begriff:** „Omnizedent/in“ steht bisher nur adjektivisch in den Gestaltungstexten („omnizedent gestalten“). Soll die Personenbezeichnung in den Omnizedenz-Kanon (omnizedenz.org) aufgenommen werden?
- **DaVaRu-Kanon:** Im Davaru-Text ist Daniel der verstorbene Bruder von Peter Masterson; in NOXIA ist Daniel van Runen (DaVaRu) lebender Gastgeber. Ist das eine bewusste Abweichung der Spielwelt?
- **Standorte:** Resonanzplatz Seelenberg und Tharsis bestätigen? Weitere Orte, z. B. Sundern oder Frankfurt?
- **Bezeichnung der Davaru-Rolle:** „Wegbegleitung des DaVaRu“ ist ein Arbeitsbegriff. Gibt es im Kodex einen eigenen Namen?
