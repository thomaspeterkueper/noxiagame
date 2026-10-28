# NOXIA-NPC-RELIGION-0002 – Philosophie, Ethik und Religion als Figuren

Status: accepted (Rollen und Stimmen), Figuren in Vorbereitung · 2026-10-28
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

## Figuren und Orte

Nichts davon ist in der Live-Datenbank angelegt. Anlage nach dem Verfahren aus `docs/characters/davaru-aristeas-activation.md` (idempotent, eigene IDs, keine erfundene Anwesenheit). Je Ort wird zuerst geprüft, ob ein realer Ort materialisiert ist; erst dann bekommt eine Figur Wohnung und Arbeitsort.

**Standorte für Resonanzplätze und Omnizedent/innen (entschieden, Thomas 28.10.2026):**

| Ort | Stand in NOXIA | Hinweis |
|---|---|---|
| Sundern | Erdregion vorhanden, St. Johannes mit Elias Hartmann produktiv | Begegnung Pfarrer – Omnizedent/in im selben Ort möglich |
| Frankfurt am Main | prüfen | Großstadt mit vielen Traditionen; naheliegend für den Vergleichspiloten (Moschee/Synagoge) |
| Erongo (Namibia) | Erdregion `earth-namibia-erongo` vorhanden | Resonanzplatz außerhalb Europas |
| Dvārakā | als Reiseziel gewünscht, Region noch nicht materialisiert | Ursprungsort von Mishkenaz im Kanon; Bezug zu Omnizedenz und Davaru |
| mindestens eine Marskolonie oder Station | Tharsis-Hub vorhanden | Philosophie im Experiment: Knappheit, Abhängigkeit, Spielraum |

**Weg des DaVaRu:** bleibt beim Tempel in Schmitten/Großer Feldberg.

| Figur | Rolle | Ort | Stand |
|---|---|---|---|
| Elias Hartmann | `priest` | St. Johannes, Sundern | besteht |
| DaVaRu (Daniel van Runen) | Gastgeber | Tempel des DaVaRu, Schmitten | besteht als Person, Tempel noch nicht platziert |
| Aristeas Lux | Gast | Tempel des DaVaRu | besteht als Person |
| Wegbegleiter/in | `davaru_companion` | Schmitten | geplant, Bezeichnung offen |
| Johanna Lind | `omnizedent` | Sundern; Resonanzrunde in der realen Hubertushalle; wohnt im öffentlichen Wohnblock | **produktiv** (`earth-sundern-omnizedent-001`) |
| Teodor Varga | Techniker, Omnizedent aus Überzeugung | Tharsis Hub; arbeitet an der Wasseraufbereitung, wohnt im öffentlichen Habitat | **produktiv** (`mars-tharsis-omnizedent-001`), Resonanzplatz fehlt noch |
| weitere Omnizedent/innen | `omnizedent` | Frankfurt, Erongo, Dvārakā | geplant |
| Vergleichspilot | `imam` oder `rabbi` | z. B. Frankfurt | Schritt 3 aus RELIGION-0001 |

Namen weiterer Figuren werden erst bei der Anlage festgelegt.

### Pilot Sundern und Tharsis (28.10.2026)

Angelegt mit Migration `20261028124500_omnizedent_pilots_sundern_tharsis.sql`, nach demselben Muster wie Elias Hartmann. Beide sind normale aktive Personen: Wirtschaftsakteur, Startbestand, sechs Bedürfnisse, Lebensstand, Aussehen, Wohnung über ein gestelltes Mietverhältnis im öffentlichen Bestand. Per SELECT geprüft: je genau eine Person, keine Dubletten.

- **Johanna Lind, Sundern.** Arbeitsort ist die real importierte Hubertushalle (OSM-Gemeindezentrum), kein dupliziertes Gebäude. Arbeitgeber ist der „Resonanzkreis Sundern“, ein kleiner Gemeinschaftsakteur. Wie beim Pfarrer gibt es keinen Lohnsatz und damit kein künstliches Einkommen. Wöchentlich trägt sie die **Offene Resonanzrunde** (Tag 3 der Woche, 19 Uhr, zwei Stunden). Das läuft über dieselbe Ortsaktivität wie St. Johannes, die dafür auf eine Gastgeberliste (`REAL_PLACE_HOSTS`) verallgemeinert wurde, ohne zweite Uhr. Gottesdienst und Resonanzrunde überschneiden sich nicht.
- **Lose Bekanntschaft Johanna – Elias.** Bewusst unter der Besuchsschwelle (Zuneigung 0,48 statt 0,5): Keiner geht automatisch zum Termin des anderen. Ob daraus mehr wird, entscheiden echte Begegnungen.
- **Teodor Varga, Tharsis Hub.** Er arbeitet als Techniker an der bisher unbesetzten Wasseraufbereitung (Lohn aus dem öffentlichen Dienst nach `role_wage_rates`). Omnizedent ist er aus Überzeugung, nicht von Beruf. Das passt zu einer Kolonie von 30 Menschen. Einen Resonanzplatz gibt es auf dem Mars noch nicht; der braucht ein echtes, baubares Gebäude: `internal-tasks/open/REQ-NOXIA-20261028-resonance-place-buildable.md`.
- **Gesprächshaltung.** Beide öffentlichen Rollen werden von `worldviewVoices` als `omnizedent` erkannt (Test vorhanden).

## Spielmechanik (spätere Etappen)

1. **Gespräch** – jetzt umgesetzt über die Stimmen.
2. **Termine** wie bei St. Johannes – für Sundern umgesetzt (Resonanzrunde). Offen: Abend am Tempel, Resonanzrunde auf Tharsis (braucht `tile_entity` als Ort).
3. **Lesen und Lernen**: Bibliothek des Tempels und der Raum „Lesen & Denken“ am Resonanzplatz als Lernorte im Sinne von NOXIA-SCHOOL-0001 (immer kostenlos).
4. **Begegnungen untereinander**: Pfarrer, Wegbegleiterin und Omnizedentin können sich über normale Encounter kennenlernen und streiten. Keine vorgefertigten Freundschaften.
5. **Ethische Fälle**: Bei Konflikten aus NOXIA-ETHICS-0001 (Wasser, Zugang) können diese Figuren Perspektiven beisteuern, als eine Stimme unter mehreren, nie als Schiedsrichter.

## Entscheidungen Thomas (28.10.2026)

- **Begriff „Omnizedent/in“:** vorläufig nur in NOXIA, im Spiel und in den Romanen. Nicht in den Omnizedenz-Kanon (omnizedenz.org) übernehmen; ob sich der Begriff etabliert, zeigt sich später.
- **DaVaRu:** bleibt der lebende Gastgeber Daniel van Runen. Der verstorbene Bruder (Peters Bruder im Roman) ist nur Namensgeber und muss im Spiel nicht auftauchen. Keine Kanonabweichung, die aufgelöst werden müsste.
- **Standorte:** Sundern, Frankfurt, Erongo, Dvārakā und mindestens eine Marskolonie oder Station (siehe oben).

## Offen

- **Bezeichnung der Davaru-Rolle:** „Wegbegleitung des DaVaRu“ bleibt Arbeitsbegriff, bis ein eigener Name gefunden ist. Der Code-Schlüssel `davaru_companion` kann bleiben; nur das Label ändert sich dann.
