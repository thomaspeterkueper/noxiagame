# Teilprojekt Bevölkerung und Ökonomie

Maßgeblich: `docs/decisions/NOXIA-LIVING-0006` bis `0010`, `NOXIA-FIN-0001`, `NOXIA-OMNI-0001`, `docs/research/colony-run.md`.

## Stand

- Schattenbetrieb Wohnen läuft live (`NOXIA_HOUSING_SHADOW`). Einzug in staatlichen Wohnraum gebaut, Schalter `NOXIA_HOUSING_PUBLIC_PLACEMENT` aus.
- Arbeitgeber leben von einer 14-Tage-Reserve (erster Lohnlauf Tick 2136). Laufende Einnahmen fehlen.
- Automatische Gebäudeausschüttung ist aus. Erlöse nur aus echten Zahlungen.
- Bestellung im Lokal: `order_hospitality_item` und `/api/game/hospitality/order` (Migration `20261010110000`).
- Lokale auf der Erde durch Kauf und Umbau realer Häuser (R-13, Migration `20261025180000`, live 25.10.2026): Kauf als versteuerte Überweisung an den Ort, Umbau zu Café/Bar/Restaurant/Hotel mit Bauzeit, Plätze nach Hausgröße. Startcafé steht jetzt in der Hauptstraße 72; Metropol und Balkan Grill sind staatliche Lokale.
- Hafenkantine live an allen sechs Orten mit Hafen (NOXIA-LIVING-0013, Migration `20261013100000`): Bewohner kaufen zuerst im Lokal, sonst in der Kantine; wer nichts zahlen kann, bekommt eine Notration ohne Geldfluss.

## Offene Aufgaben

1. Prüfskript `supabase/tests/public_housing_placement.test.sql` laufen lassen, danach Schalter für den Einzug.
2. ✅ **Personal für Lokale (25.10.2026, Migration `20261025210000_venue_staffing.sql`, live).** `run_venue_staffing` läuft jeden Tick vor der Lohnrunde: Lokale stellen ein, bis `staff_capacity` besetzt ist (eine Stelle je Lokal und Tick, Rolle `service`, 55 Cr/Tag). Ein Arbeitgeber stellt nur ein, wenn sein Konto sieben Tageslöhne seiner Lokal-Belegschaft samt neuer Stelle deckt. Bewerber sind zuerst übernommene Menschen des realen Ortes ohne Arbeit (`earth-house:*`, `earth-local:*`) im Umkreis von etwa 5 km; gibt es keinen, kommt auf der Erde jemand aus dem realen Ort dazu (eigenes Konto mit ausgewiesenem Startbestand 980 Cr, wohnt über dem Lokal, wenn dort eine Wohnung frei ist – Miete 200 Cr an den Eigentümer). Der Arbeitgeber folgt dem Eigentümer: Wer ein Lokal kauft, zahlt dessen Personal. Übergangsreserve für die Lokale des Ortes: 3 850 Cr (14 Tageslöhne für 5 Stellen) an den öffentlichen Akteur der Erde, ausgewiesen als `bootstrap:employer:<actor>:venues`. Bewohner kaufen jetzt auch in Bar (8 Cr) und Restaurant (12 Cr), aber nur dort, wo jemand arbeitet; unter mehreren bezahlbaren Lokalen wählen sie gestreut, billigere häufiger (∝ 1/Preis, erster Schritt zu Aufgabe 11). Probe in zurückgerollter Transaktion: Metropol 2, Balkan Grill 3 Personen eingestellt, erste Konsumrunde verteilt sich auf alle Lokale.
   Befunde:
   - **Startcafé:** Das Unternehmen des Eigentümers hat 18 Cr; Mikas Lohn (55 Cr/Tag) wird nicht gezahlt, der zweite Platz bleibt frei. Einlage über `POST /api/game/npc-economy/corp` (`fund_player_corp`) – eine Oberfläche dafür fehlt.
   - **Ort ohne Einnahmen:** Auf der Erde ist die Konsumsteuer 0 %. Der öffentliche Akteur zahlt aus derselben Kasse auch seine vier anderen Stellen (295 Cr/Tag); die Reserve reicht so etwa eine Woche, danach tragen nur Verkäufe in Metropol und Balkan Grill. **Entschieden (Thomas, 25.10.2026): Konsumsteuer auf der Erde 19 %** (Migration `20261025220000_earth_consumption_tax.sql`, live). Startwert; die Politik kann ihn ändern (Gouverneur über `setTaxRates`, 0–50 %; die Erde hat noch keinen Gouverneur). Die Steuer ist wie bisher im Preis enthalten: von 100 Cr gehen 19 an die Koloniekasse und von dort als Fiskaltransfer an den öffentlichen Akteur. Sie gilt auch für Gebäudekäufe. **Später:** eigene Sätze je Land, sobald die Erde nach Staaten aufgeteilt ist (heute ist die Erde ein einziger Ort, `colony_settings` gilt je Ort).
   - **Erde ist ein Ort:** Bewohner wählen unter allen Lokalen der Erde, nicht nur in ihrer Stadt (heute auch das selbst gebaute Café in Peru). Nötig: Lokale nach Entfernung zur Person filtern (Anschluss an Aufgabe 11).
3. Ortsspielraum: Mittellosigkeit einrechnen (Arbeitslosigkeit erhöht ihn derzeit).
4. Wahrnehmung im Lokal: „selber Sichtbereich" statt „selber Raum", bevor Begegnungen dort auf Stimmung wirken.
5. Hunger und Durst etablieren – **entschieden (Thomas, 12.10.2026): ja, auch für Spieler.** Entwurf: `docs/decisions/NOXIA-LIVING-0012-hunger-and-thirst.md` (Status: proposed). Kurz: `hunger` und `thirst` ersetzen `sustenance` in drei Schritten (Bestandswerte übernehmen, `sustenance` als `min(hunger, thirst)` ableiten, dann entfernen); Spielerwerte in `player_needs`, beim Lesen aus letztem Essen/Trinken und **aktiver Spielzeit** berechnet – **entschieden (12.10.2026): offline ändert sich nichts, Mangel ist vorerst nur sichtbar**, Untergrenze 0,25; eine Wirkungstabelle `hospitality_item_effects` für Spieler und Bewohner (Getränk → Durst, Kuchen → Hunger, Mahlzeit → beides). **Der Status ist für den Spieler sichtbar:** Hunger und Durst als Anzeige in der Topbar, Wirkung je Posten auf der Karte. Offene Fragen in NOXIA-LIVING-0012 am Ende. Voraussetzung für Aufgabe 9.
6. Rückbau und Verkauf von Gebäuden schreiben Credits ohne Gegenkonto gut (`app/api/game/build/route.ts`).
7. Siehe Request R-2.
8. Startcafé braucht Personal: Der Platzhalter-Wirt ist entfernt, ein Café ohne Personal ist ein Automatencafé ohne Einstiegsgespräch. Prüfen, ob `20261010090000_earth_cafe_host.sql` live angewendet ist (aus Teilprojekt Gastronomie).
9. Ausgeben im Lokal: Die Oberfläche sendet bei `POST /api/game/hospitality/order` jetzt `recipientPersonId`, wenn der Spieler für eine Person im Raum bestellt. Route und `order_hospitality_item` werten das Feld noch nicht aus. Gewünscht (Thomas, 12.10.2026): Die Eigenschaften der Person ändern sich – ihr Hunger bzw. Durst wird gestillt (nach Aufgabe 5, `hospitality_item_effects`), dazu Wirkung auf Beziehung und Stimmung. Entwurf: NOXIA-LIVING-0012 Abschnitt 7. Zu bauen: Prüfung, dass die Person in diesem Gebäude ist (`person_interior_presence`); Wiederholung per `requestId` wirkt nur einmal (Geld, Bedürfnis, Beziehung, Stimmung in einer Transaktion); Beziehungseffekt skaliert mit dem Bedarf der Person; neue Tabelle `person_player_relationships` nach den Regeln aus NOXIA-LIVING-0008 – eine Beziehung Person ↔ Spieler gibt es bisher nicht; Stimmung über ein `population_events`-Ereignis, nicht direkt in `person_affect`. Erst nach Aufgabe 5 Schritte 1–3 (aus Teilprojekt Gastronomie).
10. ~~Essensangebot an bewohnten Orten (aus R-3).~~ Erledigt 13.10.2026: Hafenkantine überall, dauerhaft, mit Notration (NOXIA-LIVING-0013). Rest: Spieler können sie noch nicht betreten (Request an Gastronomie).
11. Wahl unter mehreren Lokalen am Ort nach Reiz statt nur nach Preis (aus R-1). **Erster Schritt live (13.10.2026):** Lokale vor der Kantine, erstes bezahlbares Angebot, Gleichstand gestreut je Person und Tick. Offen: Reiz aus Preis, Wirkung auf das drängende Bedürfnis, Geselligkeit/`variety` und Öffnungszeit (R-4), Tageszeit (R-5).
12. Angebote für Spieler als Daten (aus R-10): Stellen und Aufträge, die ein Spieler annehmen kann – Anbieter, Ort, Lohn, Annahme über den Server. Heute gibt es Stellen nur für Bewohner (LIVING-0010). Zuständigkeit für Fracht- und Schiffsstellen mit dem Handel abstimmen.
13. Zeitzonen, Sprachen und Kulturen – **entschieden (Thomas, 13.10.2026): wichtig, die Welt ist nicht deutschsprachig mit Kulisse** (in China spricht man häufiger Mandarin als Deutsch). Entwurf: `docs/decisions/NOXIA-LIVING-0014-time-zones-languages-cultures.md` – Zeitzone für Spieler und Erdorte, Sprachen je Person (aus Herkunft, nie aus Aussehen) und je Ort, Gespräche in der Sprache der Figur mit spürbarer Übersetzung, Kultur als Biografie einzelner Personen. **Kanon (Thomas, 14.10.2026):** Übersetzung um 2100 nahezu perfekt – Sprache ist Zugehörigkeit, kein Hindernis; Mars läuft nach Sol; auf dem Mars entsteht aus der Sprachvielfalt eine eigenständigere Kolonialsprache, wie bei den Galut-Schichten von Mishkenaz. **Kanon (26.10.2026):** Sie heißt **Marsianisch** – Englisch, dazu Chinesisch und etwas Mishkenaz (darf nicht fehlen), plus Technikjargon der ersten Expeditionen; Mond und Stationen laufen nach UTC; wo Menschen länger isoliert leben, entsteht überall ein lokaler Dialekt.
14. Fehler im Bevölkerungs-Cron seit 25.10.2026: `runSurfacePresenceProjection failed … invalid input syntax for type uuid: "null"` (Vercel-Laufzeitfehler, `/api/cron/population`). Irgendwo wird ein fehlender Wert als Text „null“ in eine UUID-Spalte gegeben. Ursache suchen.
15. ✅ **Gesprächsprotokoll und Abbruchsatz (27.10.2026, Wunsch Thomas; 28.10.: Anliegen, reale Meldung, Figuren untereinander, Wirkung aufs Handeln, tägliche Auswertung, in der Alpha wird nichts gelöscht).** Ausnahmsweise im Gesprächsteil gebaut, der sonst bei der Gastronomie liegt (G-6). Tabelle `npc_conversation_log` mit drei Auswertungssichten (Migration `20261027200000`, live). Wiederholte Fragen machen die Figur knapp, dann folgt „Ich habe keine Zeit, sie hier mit dir zu vertrödeln.“ und 10 Minuten Abweisung (`lib/game/cognition/conversationRepeat.ts`, Route 1.2.0). Erste Auswertung und Abfragen: `docs/reviews/npc-gespraeche-testphase.md`. Offen vor öffentlichem Start: Hinweis an Spieler, Aufbewahrungsfrist.
16. ✅ **Mond: Bauen und Laufen (27.10.2026, Wunsch Thomas, ausnahmsweise; die Oberflächen haben keinen festen Besitzer).** Ursachen:
    - **Bauen:** Seit dem Start in der begehbaren Ansicht fehlt dort jeder Bauweg. Klick auf freie Fläche zeigt jetzt Koordinaten und „Hier bauen → Karte“; der Kopfknopf heißt „← Karte · Bauen“.
    - **Laufen:** Ohne Anzug darf man nur in Bauten mit Luft und Druckkorridoren gehen, Shackleton hatte aber keine Druckkorridore. Man saß im Habitat fest. Jetzt verbinden Röhren Habitat, Lebenserhaltung, Lager und Werkstatt (`DashboardMoonSurface.tsx` 1.1.0).
    - **WASD:** läuft bis an die Wand, statt 4 m vor ihr stehenzubleiben (`PlanetaryWalkableSurface.tsx` 1.1.0, gilt auch für Mars, Phobos und Deimos).
    - Personen blockieren nicht.
    - **Offen:**
      - Bauen direkt in der begehbaren Ansicht (Fläche vorwählen, Gebäude setzen);
      - 17 Eisbohrer und eine Mine auf dem Mond ohne Lage (`x_m`/`y_m` leer) – unklar, wo sie stehen.
17. ✅ **Verhaltensaufzeichnung der Testphase (28.10.2026, Wunsch Thomas, ausnahmsweise; querschnittlich, kein festes Teilprojekt).** `player_activity_log` mit Sichten für Sitzungen, tote Klicks und Wutklicks, Fehler, Klicks und Laufwege (Migration `20261028110000`, live). Erfasst wird allgemein über `lib/telemetry/playerActivity.ts` im Root-Layout. Laufwege melden die begehbaren Ansichten von Mond und Mars, die Innenräume und die Koloniesicht; die begehbare Erdoberfläche noch nicht. Die tägliche Auswertung um 7:34 Uhr liest Gespräche und Verhalten. Doku: `docs/reviews/spielerverhalten-testphase.md`. Offen vor öffentlichem Start: Hinweis, Ablehnen-Möglichkeit, Aufbewahrung.

## Requests aus anderen Teilprojekten

Ein Request ist eine Bitte eines anderen Teilprojekts an dieses. Erledigtes hier abhaken und im anfragenden Teilprojekt vermerken.

### R-1 (Gastronomie, 13.10.2026): Bar und Restaurant baubar machen

Innenraum, Figuren, Gesprächswissen, Eintritt und Gebäudeansicht sind fertig (`docs/gameplay/hospitality-venues.md`). Es gibt aber kein einziges solches Gebäude, weil beide Arten nicht gebaut werden können.

- `building_definitions`: je eine aktive Zeile für `bar` und `restaurant`. Zum Vergleich das Café: Kategorie `life`, Stufe 1, 900 Credits, 1 Tick Bauzeit, überall erlaubt. Vorschlag: Bar 1 800 Credits (so steht es schon im lokalen Katalog), Restaurant 2 400 Credits, beide 2 Ticks.
- `lib/game/buildings/index.ts`: `bar` steht dort auf `planned: true`; `restaurant` fehlt.
- Zu entscheiden: ab welcher Ortsstufe (siehe `docs/gameplay/settlement-tiers.md` – Café ab Siedlung, Bar ab Ort?) und ob Spieler sie als zusätzliche Einrichtung bauen dürfen.
- Stellen: Bar 2, Restaurant 3 Personalplätze (Aufgabe 2). Ohne Personal sind beide geschlossen.

**Antwort (Bevölkerung und Ökonomie, 13.10.2026):** übernommen, noch nicht gebaut. Bereits geklärt durch `settlement-tiers.md` Abschnitt 5: Spieler dürfen Bar und Restaurant als zusätzliche Einrichtung bauen und daraus Einnahmen beziehen. Offen und von Thomas zu entscheiden: Ortsstufe (Vorschlag: Bar und Restaurant ab Stufe 2 Ort; das Café bleibt die Standardausstattung ab Stufe 1) und die Preise (Vorschlag aus dem Request übernommen: Bar 1 800, Restaurant 2 400, je 2 Ticks). Weil die Stufe noch nirgends ausgelöst wird (`settlement-tiers.md`), wäre die Stufengrenze vorerst nur eine dokumentierte Regel, keine Sperre.

Fund dazu, gilt für alle Lokale: Bewohner wählen in `run_npc_consumption` immer das billigste Angebot am Ort, bei Gleichstand nach `tile_entities.id`. In Tharsis Hub Sauerland stehen zwei Cafés; eines hat alle 19 Verkäufe, das andere keinen. Mit Bar und Restaurant würde jedes weitere Lokal am Ort dauerhaft leer bleiben. Vor R-1 live: Wahl unter gleichwertigen Angeboten streuen (deterministisch nach Person und Tick) oder nach Gewohnheit (`person_habits`) – Aufgabe 11, zusammen mit R-5.

### R-2 (Gastronomie, 13.10.2026): Karten für Bar und Restaurant anlegen

Ersetzt Aufgabe 7. Zeilen in `hospitality_menu`; Vorschlag, an Getränk 3 / Kuchen 5 / Mahlzeit 8 des Cafés ausgerichtet:

| `entity_id` | `item_code` | `label` | Credits |
|---|---|---|---|
| `bar` | `drink` | Getränk | 3 |
| `bar` | `snack` | Snack | 4 |
| `bar` | `longdrink` | Longdrink | 6 |
| `restaurant` | `drink` | Getränk | 3 |
| `restaurant` | `dessert` | Nachtisch | 5 |
| `restaurant` | `starter` | Vorspeise | 6 |
| `restaurant` | `main` | Hauptgericht | 12 |

Die Oberfläche zeigt eine neue Karte ohne weitere Änderung. Für Bewohner fehlt dazu der Eintrag in `npc_service_catalog` (heute nur `cafe` / `cafe_meal`), sonst kaufen sie in Bar und Restaurant nichts.

**Antwort (Bevölkerung und Ökonomie, 13.10.2026):** Karte wie vorgeschlagen übernommen. Die Wirkung der Posten auf Hunger und Durst ist in `NOXIA-LIVING-0012` Abschnitt 5 ergänzt (`hospitality_item_effects`), sodass dieselbe Tabelle Spieler und Bewohner bedient. Die Zeilen in `hospitality_menu` kommen mit R-1 in dieselbe Migration – ohne baubares Gebäude ist eine Karte wirkungslos. Für Bewohner wird `npc_service_catalog` nicht um weitere `sustenance`-Dienste erweitert, sondern zieht mit LIVING-0012 Schritt 3 auf die Kartenposten um.

### R-3 (Gastronomie, 13.10.2026): Käufe der Bewohner sind selten

Im Lokal erscheinen jetzt die Bewohner als Gäste, die dort wirklich gekauft haben (`person_consumption_events`, letzte Stunde). Bisher gibt es 19 Käufe insgesamt, etwa einen alle paar Stunden – das Café ist deshalb meist leer bis auf das Personal. Kein Fehler der Anzeige; ob häufiger gegessen und getrunken wird, hängt an Bedarf, Geld und `min_interval_ticks`, also an den Aufgaben 5 und 9.

**Antwort (Bevölkerung und Ökonomie, 13.10.2026), Befund aus den Live-Daten:**

- 17 von 32 Bewohnern liegen unter der Kaufschwelle (`sustenance` < 0,65), Mittelwert aller 0,61. Geld ist genug da (Guthaben im Schnitt 700–1 700 Credits).
- 15 dieser 17 leben an Orten **ohne jedes Essensangebot**: Mars / Tharsis Hub (10, im Schnitt 0,40), Phobos (2), Prometheus Station (2), Mond / Shackleton (1). Sie können gar nicht kaufen.
- Essensangebote gibt es nur in Tharsis Hub Sauerland (zwei Cafés, 7 Bewohner) und Q1 (Café und Speisehalle, 1 Bewohner). Alle 19 Käufe fanden im selben Café in Sauerland statt.
- Gekauft wird nur in jedem sechsten Tick und nur unter 0,65.

Das leere Lokal liegt also vor allem am Angebot, nicht an Bedarf oder Geld. Hunger und Durst (LIVING-0012) erhöhen die Häufigkeit – Durst sinkt schneller –, lösen das aber nicht allein. Nötig sind Essensangebote an den bewohnten Orten. Nach `settlement-tiers.md` wäre das die Standardausstattung ab Stufe 1 (Café, automatisch, staatlich), die noch nicht ausgelöst wird. Neue Aufgabe 10.

### R-4 (Gastronomie, 13.10.2026): Öffnungszeiten als Daten

Der Innenraum kennt jetzt Öffnungszeiten nach Koloniezeit (`VENUE_HOURS` in `lib/game/hospitality/venues.ts`: Café 6–20, Restaurant 11–23, Bar 17–2) und zeigt außerhalb davon „geschlossen“. Die Simulation weiß davon nichts.

- Öffnungszeiten als Eigenschaft der Gebäudeart oder des Gebäudes (der Betreiber legt sie fest); der Innenraum liest sie dann statt der festen Werte.
- `order_hospitality_item` und die Käufe der Bewohner lehnen außerhalb der Zeit ab – heute kann ein Bewohner um 3 Uhr im Café kaufen und erscheint dann als Gast im geschlossenen Raum. Der Spieler wird nur von der Oberfläche aufgehalten, nicht vom Server.
- Personal arbeitet in Schichten, die zur Öffnungszeit passen (hängt an Aufgabe 2 und `person_interior_presence`).
- Zu entscheiden: Das Startcafé neuer Spieler ist nachts geschlossen. Entweder öffnet es durchgehend, oder der Einstieg bekommt einen anderen Ort.

**Antwort (Bevölkerung und Ökonomie, 13.10.2026):** übernommen. Vorschlag: Öffnungszeiten je Gebäudeart als Standard (Tabelle `venue_hours`), überschreibbar je Gebäude durch den Betreiber; `order_hospitality_item` und `run_npc_consumption` prüfen serverseitig. Die Hafenkantine ist rund um die Uhr offen und fängt die Nacht auf.

**Entschieden (Thomas, 13.10.2026): Das Startcafé ist von 23:00 bis 6:00 Uhr geschlossen – nach der echten Ortszeit des Spielers, nicht nach Koloniezeit.** Folgen:

- Für den Spieler gilt seine Uhr: Wer abends um 23:30 Uhr spielt, findet das Startcafé geschlossen und wird zur Hafenkantine verwiesen; ab 6:00 Uhr gibt es das Einstiegsgespräch.
- Bewohner leben weiter nach Koloniezeit (ein Tick ist eine Stunde). Ihre Käufe im Startcafé richten sich nach den Öffnungszeiten in Koloniezeit. Ein und dasselbe Café kann also für einen Spieler zu und für Bewohner offen sein – wie bei den Bedürfnissen gibt es bewusst zwei Uhren.
- Die Zeitzone des Spielers fehlt bisher. Vorschlag: `profiles.time_zone` (IANA-Name, z. B. `Europe/Berlin`), beim Anmelden aus dem Browser übernommen und gespeichert; der Server prüft damit in `order_hospitality_item`. Ohne gespeicherte Zone gilt UTC.
- Gilt vorerst nur für das Startcafé. Ob andere Lokale für Spieler ebenfalls nach Ortszeit öffnen, ist offen.

### R-5 (Gastronomie, 13.10.2026): Ausgehen nach Tageszeit

Damit sich die drei Lokale unterscheiden: Bewohner gehen morgens ins Café, mittags und abends ins Restaurant, abends in die Bar. Gewichtung der Käufe nach Stunde (`circadian.ts`) und nach Bedürfnis (Aufgabe 5); Freizeit und Geselligkeit als Anlass, nicht nur Hunger. Folgt auf R-2 und R-3.

**Antwort (Bevölkerung und Ökonomie, 13.10.2026):** übernommen als Teil von Aufgabe 11 (Reiz eines Angebots). Tageszeit wird ein Gewicht im Reiz, nicht eine feste Regel. Geselligkeit als Anlass braucht einen zweiten Kaufauslöser neben dem Essen (`social` oder `variety` niedrig) – folgt nach Hunger und Durst (Aufgabe 5).

### R-6 (Gastronomie, 13.10.2026): Wohnen über dem Lokal

Der Innenraum zeigt eine Treppe „PRIVAT ↑“, sobald ein Gastronomiegebäude `residential_capacity` hat; das Personal weiß, dass oben gewohnt wird. Heute hat kein solches Gebäude Wohnplätze.

- Wohnplätze für Café, Bar und Restaurant (als Variante oder Ausbau), Vorschlag: 1–2.
- Der Wirt wohnt bevorzugt über seinem Lokal; sonst Vermietung mit Miete an den Eigentümer.
- Zu entscheiden: eigene Gebäudeart „Wohn- und Geschäftshaus“ oder Ausbau eines bestehenden Lokals.

**Antwort (Bevölkerung und Ökonomie, 13.10.2026) – entschieden (Thomas, 13.10.2026):** Wohnen über dem Lokal ist ein **Gebäude-Ausbau**; manche Lokale und Geschäfte haben die Wohnung schon von Anfang an. **Ob ein Gebäude sie hat, ist Zufall und hängt nicht an der Gebäudeart** – manche haben sie, manche nicht. Umsetzung: Beim Entstehen eines Gebäudes wird einmal gewürfelt, deterministisch aus der Gebäude-ID (Vorschlag: etwa jedes dritte Lokal oder Geschäft), und das Ergebnis als `residential_capacity` (1–2) am Gebäude gespeichert – es wird nicht bei jedem Lesen neu berechnet. Wer keine Wohnung hat, kann sie als Ausbau nachrüsten (Kosten und Bauzeit offen). Der Wohnungsmarkt (NOXIA-LIVING-0010) vergibt die Plätze bereits; neu sind die Vorliebe des Wirts für die Wohnung über seinem Lokal und die Miete an den Eigentümer. Bestehende Lokale bekommen den Wurf einmalig per Migration.

### R-7 (Gastronomie, 13.10.2026): Hotel und Gästezimmer

Vorbild SunDog: Im Hotel mietet man am Empfang ein Zimmer und ruht sich aus. Der Innenraum zeigt bereits „ZIMMER ↑“, sobald ein Gebäude `transient_capacity` hat.

- Gebäudeart `hotel` (oder Gasthof = Restaurant mit Gästezimmern), baubar, mit `transient_capacity`.
- Zimmerpreis je Nacht, Buchung als versteuerte Überweisung wie bei `order_hospitality_item`; belegte Zimmer zählen gegen die Plätze.
- Wirkung der Übernachtung: Erholung für Spieler und Reisende (zusammen mit Hunger und Durst, Aufgabe 5); Reisende als Personen, die nur vorübergehend am Ort sind.
- Gastronomie baut danach Lobby und Empfang als Innenraum und den Knopf „Zimmer nehmen“.

**Antwort (Bevölkerung und Ökonomie, 13.10.2026):** grundsätzlich übernommen, nach LIVING-0012. Hängt an zwei Entscheidungen: **(Thomas)** Gibt es Erholung als drittes Spielerbedürfnis (dann nach denselben Regeln wie Hunger und Durst: nur sichtbar, offline eingefroren)? Und Reisende als vorübergehende Personen – ein eigenes Modell, das es noch nicht gibt. Buchung eines Zimmers kann `order_hospitality_item` als Vorlage nehmen.

**Nachtrag Gastronomie (14.10.2026):** Thomas hat entschieden, das Hotel einzubauen; Gastronomie hat die drei Datenpunkte unten selbst gebaut (`20261014090000_hotel_rooms.sql`: Gebäudeart `hotel`, 6 Zimmer je neuem Hotel, `room_night` 40 Credits, Belegungsprüfung als Trigger auf `player_hospitality_orders`, Nacht = 24 Stunden Echtzeit). Bleibt bei euch: Nacht in Koloniezeit, Erholung, Reisende, und ob Bar/Restaurant Gästezimmer per Ausbau bekommen (R-6-Muster).

**Nachtrag Gastronomie (13.10.2026, abends):** Das Hotel ist von innen fertig – Lobby, Empfang, Treppe, Zimmer buchen als Posten `room_night` über `order_hospitality_item`, Belegung aus `player_hospitality_orders` der letzten 24 Stunden, Gebäudeansicht, Eintritt (`hotel` → hospitality). Damit es ein Hotel gibt, fehlt:

- `building_definitions`: Zeile `hotel` (Vorschlag: Kategorie `life`, Stufe 2, 3 600 Credits, 3 Ticks, `transient_capacity` 6) und `lib/game/buildings/index.ts`; spielerbaubar wie Bar und Restaurant (R-1). Alternativ Gästezimmer als Ausbau eines Lokals (`transient_capacity` > 0) – der Innenraum zeigt dann ebenfalls „ZIMMER ↑“ und die Buchung.
- `hospitality_menu`: `hotel` / `room_night` / „Zimmer für eine Nacht“, Vorschlag 40 Credits. Für Lokale mit Gästezimmern dieselbe Zeile unter ihrem `entity_id`.
- `order_hospitality_item`: Für `room_night` prüfen, dass ein Zimmer frei ist (Buchungen der letzten 24 Stunden < `transient_capacity`) und der Gast nicht schon eines hat; heute hält nur die Oberfläche das ein. Dazu die Nacht in Koloniezeit statt 24 Stunden Echtzeit, sobald es dafür eine Regel gibt.
- Wirkung: Erholung (Entscheidung offen), Reisende als vorübergehende Personen, die Zimmer belegen.

### R-8 (Gastronomie, 13.10.2026): Gerüchte als Wissen der Personen, Auskunft gegen Geld

Das Personal erzählt jetzt, was am Ort geschehen ist (`lib/game/hospitality/hearsay.ts`, aus Käufen, Baustellen und `population_events`). Das ist aber ein Blick des Lokals auf die Daten: Niemand hat es wirklich erfahren, niemand erinnert sich, und es wandert nicht weiter.

- Wissensspuren je Person: wer was gesehen oder von wem gehört hat, mit Alter und Verlässlichkeit; Weitergabe bei Begegnungen, im Lokal besonders. Der Innenraum liest dann das Wissen der anwesenden Person statt `venueState`.
- Auskunft als Ware nach SunDog (in der Bar kauft und verkauft man „Info“ beim Wirt): Preis, was eine Auskunft enthält (Preise anderer Orte, Stellen, Aufträge), und was der Spieler selbst verkaufen kann. Buchung über den Server, nicht im Gespräch.
- Gastronomie baut danach den Posten „Auskunft“ am Tresen.

**Antwort (Bevölkerung und Ökonomie, 13.10.2026):** übernommen als eigener Baustein (eigene Entscheidung, nach LIVING-0012). Anschluss an das bestehende soziale Gedächtnis (`lib/game/personSocialMemory.ts`): Wissensspuren mit Quelle, Alter und Verlässlichkeit, Weitergabe bei Begegnungen. Auskunft gegen Geld als besteuerter Transfer wie eine Bestellung. Gerüchte über die Hafenkantine („auf Phobos gibt es nur Ration“) sind ein erster Anwendungsfall (LIVING-0013).

### R-9 (Gastronomie, 13.10.2026): Lehren aus SunDog für Bedürfnisse und Waren

Quelle: Spielbeschreibung unter https://gamesoffame.wordpress.com/sundog/ (von Thomas genannt). Was davon nicht im Lokal liegt:

- **Sichtbare Balken:** SunDog zeigt vier Balken – Ernährung, Ruhe, Kraft, Gesundheit. Für Aufgabe 5 heißt das: Hunger und Durst (und Erholung, R-7) des Spielers stehen dauerhaft sichtbar in der Kopfzeile, nicht nur als Zahl im Profil. Essen kauft man im Lokal; wer lange unterwegs ist, ohne zu essen, bekommt Folgen. Das Lokal zeigt dann je Posten, was er stillt.
- **Alkohol hat einen Preis:** In SunDog kann Bier zur Ohnmacht führen, und man wird ausgeraubt. Zu entscheiden, ob Getränke der Bar eine Nebenwirkung haben (z. B. Wirkung auf Leistung im nächsten Tick). Kein Raub ohne ein Sicherheitsmodell.
- **Ware beim Wirt:** In SunDog bekommt man in der Bar über „Info“ auch Gegenstände, legale und illegale; der Handel findet in einer Nische mit einer Person aus der Bar statt. Ergänzt R-8: Ob das Lokal Ort für Geschäfte zwischen Personen und Spieler wird, und ob es verbotene Ware gibt. Die Sitznischen der Bar sind im Innenraum vorhanden.
- **Bilder als gemeinsamer Bestand:** Die Posten der Karte haben jetzt gezeichnete Bilder (`app/earth/HospitalityItemIcon.tsx`, Schlüssel ist `item_code`). Wenn Waren, Inventar und Markt ebenfalls Bilder bekommen (SunDog: Gegenstände per Ziehen und Ablegen), sollte es ein gemeinsamer Bestand mit einer Regel für Größe und Stil werden. Neue Zeilen in `hospitality_menu` (R-2) bitte mit den dort genannten Codes, sonst erscheint das Ersatzbild.

**Antwort (Bevölkerung und Ökonomie, 13.10.2026):** Sichtbare Balken sind in LIVING-0012 Abschnitt 6 vorgesehen (Hunger, Durst; Erholung offen, siehe R-7). „Wer lange unterwegs ist, bekommt Folgen“ ist vorerst nicht so: Mangel beim Spieler ist nur sichtbar (Entscheidung 12.10.2026). **Zu entscheiden (Thomas):** Nebenwirkung von Alkohol – vorerst keine, solange Mangel nichts kostet? Kartencodes: R-2 wie vorgeschlagen; neu sind `water` und `ration` der Hafenkantine.

### R-10 (Gastronomie, 13.10.2026): Echte Angebote für den Einstieg, Einführung in jedem Gebäude

Entscheidung (Thomas, 13.10.2026): Jedes Gebäude kann Neue in die Welt von NOXIA einführen, jedes auf seine Art; die Hinweise kommen von den Leuten, die dort arbeiten. Ziel ist, dass der Spieler ins Herumkommen gerät – etwa durch eine Stelle auf einem Handelsraumschiff „oder andere spannende Sachen“.

In Café, Bar und Restaurant ist die Haltung gebaut (`lib/game/hospitality/introductions.ts`, Feld `introduction` der Gesprächsroute). Das Personal darf aber kein Angebot erfinden. Es fehlt:

- **Angebote als Daten:** offene Stellen, die ein Spieler annehmen kann (Mitflug oder Arbeit auf einem Handelsschiff, Aushilfe in einem Betrieb), und Aufträge (Lieferung, Botengang) – mit Anbieter, Ort, Lohn und Annahme über den Server. Heute gibt es Stellen nur für Bewohner.
- **Zuordnung zum Haus:** welche Art Angebot wo zu hören ist – Bar eher das Riskante und Einträgliche, Café das Solide, Hotel Reisen und Ausflüge. Das Lokal liest dann die Angebote seines Ortes und gibt sie dem Personal als Fakten mit; der Knopf zum Annehmen gehört an den Tresen, nicht ins Gespräch.
- **Andere Gebäude:** Verwaltung, Akademie, Markt, Raumhafen brauchen dieselbe Einführung mit eigener Haltung. Das Muster (Haltung plus Hinweise, nur fürs Personal) lässt sich übernehmen; welches Teilprojekt die Innenräume dieser Gebäude führt, ist zu klären.
- Hängt mit R-8 (Auskunft gegen Geld) und R-9 (Ware beim Wirt) zusammen: Ein Angebot kann auch eine Auskunft sein, die etwas kostet.

**Antwort (Bevölkerung und Ökonomie, 13.10.2026):** Angebote als Daten übernommen als Aufgabe 12. Stellen für Spieler gehören zum Arbeitsmarkt hier; Mitflug und Arbeit auf Handelsschiffen berühren Handel und Schiffe und werden dort abgestimmt.

### R-11 (Gastronomie, 25.10.2026): Alter einer Person als Wissen des Spielers

Entscheidung Thomas, 25.10.2026: Über einer Figur steht in der Spielansicht nur „Mann“, „Frau“, „Junge“, „Mädchen“ usw.; kennt man die Person, ihr Name; weiß man das Alter, in Klammern dahinter – „Thomas Küper (58)“. Die Beschriftung ist gebaut (`lib/game/population/personSceneLabel.ts`, Erdszene und Lokal). Das Alter fehlt, weil `player_person_identity_knowledge` nur Name und Zustand kennt.

- Spalte oder eigener Wissenssatz: `known_age_years` bzw. `known_birth_year` je Spieler und Person, gelernt wie der Name (im Gespräch genannt, aus Dokumenten, von Dritten); Quelle und Tick wie beim Namen.
- `GET /api/game/population` und `/api/game/hospitality/guests` liefern dann `knownAgeYears`; die Oberfläche hängt es an (`personSceneLabel` nimmt das Feld schon an).
- Dazu das Spieljahr: Alter = Spieljahr − Geburtsjahr. Das Spieljahr (2086 in der Kopfzeile) hat im Code keine gemeinsame Quelle; bitte eine Funktion dafür.

### R-12 (Erdkarte, 25.10.2026): Bestehende Gebäude der Erdkarte kaufen

**Stand 25.10.2026, mittags: auf Wunsch von Thomas im Teilprojekt Erdkarte gebaut** (er brauchte es sofort). Bitte prüfen und übernehmen – vor allem Preisformel, Bewohner realer Häuser und die Buchung.
- Migration `20261025110000_earth_real_building_purchase.sql`: `buy_earth_building` (atomar: Guthaben prüfen, Spieler −Preis, öffentlicher Akteur der Erde +Preis als `npc_ledger`-Eintrag `income` mit Referenz `building_purchase:<osm>:player:<id>`, neue `tile_entities`-Zeile `acquired_building` mit `source_ref`, Wohnzuweisungen mit `region_feature_id` des Grundrisses ziehen mit, Mietverhältnisse bekommen das Unternehmen des Spielers als Vermieter); `demolish_earth_building` (nur eigene gekaufte, nur unbewohnt; Grundriss nach `earth_cleared_buildings`).
- Preis (`lib/worldlab/buildingOffer.ts`, mit Tests): Geschossfläche × Satz je Art (Wohnhaus 12, Mehrfamilienhaus 10, Schuppen 6, Halle 5, Fabrik 4 Cr/m²) + Grundfläche × 2 Cr/m² + 10 × Miete je Abrechnung; mindestens 800 Cr. Ein Einfamilienhaus von 100 m² kostet so etwa 2 600 Cr.
- Nicht verkäuflich: Gotteshäuser, öffentliche Gebäude (Rathaus, Schule, Krankenhaus, Bahnhof, Bücherei …), `historic`, und alles, worauf schon ein NOXIA-Gebäude steht.
- Wohnplätze eines gekauften Wohnhauses: 1 je 40 m² Geschossfläche (`residential_capacity`). Heute wohnt in realen Häusern noch niemand – der Wohnungsmarkt vergibt dort noch keine Plätze.
- Schnittstelle: `GET/POST /api/game/building-offer` wie oben vorgeschlagen, dazu `POST { action: 'demolish', entityId }`.
- Nachtrag 25.10.2026 (Thomas: „echte Personen, neu angelegt“; Migration `20261025120000_earth_building_residents_and_conversion.sql`): Beim Kauf eines Wohnhauses ziehen 1–4 (Mehrfamilienhaus bis 8) neue Personen ein (`simulation_tier = background`, Konto mit 980 Cr Startbestand als `endowment`, Mietvertrag 200 Cr je 720 Ticks an `profile_economic_actors` des Käufers, `origin = market`). Abriss bringt sie in staatlichen Wohnraum. Umbauen = Nutzung ändern zu halben Baukosten (abgebucht wie ein Bau, ohne Gegenbuchung – dieselbe Senke wie `/api/game/build/spatial`).
- Offen hier: Arbeit und Einkommen für die neuen Bewohner (sonst nach etwa fünf Mieten Räumung); ob Bau- und Umbaukosten an einen Empfänger (Baufirma, Gemeinde) gehen sollen statt in eine Senke.

Entscheidung Thomas, 25.10.2026: Reale Gebäude der Erdkarte, die noch niemandem im Spiel gehören, kann ein Spieler **kaufen**. Ersetzen geht nur über den Kauf.

- **Geld geht an die Gemeinde** (öffentlicher Akteur des Ortes, auf der Erde z. B. Sundern) – als Transfer nach NOXIA-FIN-0001, keine Senke.
- **Bewohnte Gebäude:** Die Bewohner bleiben und zahlen künftig Miete an den neuen Eigentümer.
- **Mieteinnahmen erhöhen den Kaufpreis.** Ein vermietetes Haus kostet mehr als ein leeres gleicher Größe.
- **Abreißen nur selbst gekaufter Gebäude.** Danach darf man an der Stelle bauen (Bau über `/api/game/build`, Platz ist der alte Grundriss).

Was die Erdkarte schon hat und liefert:
- Jedes Gebäude der Karte trägt seine OSM-Kennung (`osm:way:<id>`, in den Kacheldaten als `i`), dazu Grundfläche (m²), Geschosse, Art (Wohnhaus, Mehrfamilienhaus, Halle, Fabrik, Kirche, Schuppen), Anschrift und Lage.
- Gebäude, die ein NOXIA-Gebäude belegt (Grundriss überdeckt), zeichnet die Karte schon als NOXIA-Gebäude mit Eigentümerfarbe. Ein gekauftes Haus erscheint also automatisch als eigenes, sobald es als `tile_entities`-Zeile mit Lage und Grundriss existiert.
- Die Tafel eines Gebäudes fragt das Angebot ab und zeigt „Kaufen“, sobald die Schnittstelle unten antwortet. Bis dahin zeigt sie nichts zum Kauf (gebaut, `app/world-lab/WorldPanels.tsx`).

Gebraucht wird (Vorschlag für die Schnittstelle, Änderungen gern – bitte in `world-map.md` vermerken):

`GET /api/game/building-offer?source=osm:way:123&lat=…&lon=…&areaM2=…&levels=…&kind=house`
→ `{ forSale: true, price, seller: "Gemeinde Sundern", residents, rentPerInterval, reason? }` oder `{ forSale: false, reason: "gehört bereits …" | "Wahrzeichen" | … }`

`POST /api/game/building-offer` mit `{ source, lat, lon }` (Werte zu Fläche und Art prüft der Server selbst nach)
→ `{ entityId }`. Atomar: Preis neu berechnen, Guthaben prüfen, Transfer Käufer → Gemeinde, `tile_entities`-Zeile anlegen (Eigentümer Spieler, Lage, Drehung, Grundriss, `residential_capacity`, Quelle `osm:…`, eindeutig je Quelle), Mietverhältnisse der Bewohner auf den neuen Vermieter umstellen.

Offen und hier zu entscheiden:
- **Wer wohnt in einem realen Haus?** Heute wohnen die Bewohner der Erde nur in NOXIA-Wohnblöcken; OSM-Häuser sind leer. Vorschlag: Ein Wohnhaus hat eine Kapazität aus Fläche × Geschosse (etwa 1 Platz je 40 m² Wohnfläche); Bewohner bekommt es erst, wenn der Wohnungsmarkt (NOXIA-LIVING-0010) dort Plätze vergibt. Dann ist „bewohnt“ eine echte Spielgröße und keine Schätzung.
- **Preisformel.** Vorschlag: Bodenwert (`land_value` der Kachel) × Grundfläche + Bauwert (Fläche × Geschosse × Satz je Art) + Mietertrag × Faktor (z. B. zehn Jahresmieten).
- **Was nicht verkäuflich ist:** Vorschlag: Kirchen, Rathaus, Schulen, Bahnhof und andere Wahrzeichen (öffentliche Gebäude) nicht; Industrie ja.

### R-12 (Gastronomie, 25.10.2026): Was eine Figur vom Spieler weiß – Name, Gefälligkeiten

**Entscheidung (Thomas, 25.10.2026): Dass sich Figuren erinnern, ist wichtig für das Spielgefühl – bitte vorziehen.**

Gespräch im Startcafé, 25.10.2026: Der Spieler sagt „Nenn mich Thomas“, Mika antwortet „das merke ich mir“ – und kann es nicht. `npc_player_conversation_memory` hält nur die letzten drei Wortwechsel als Text (`recent_exchanges`); der Name ist beim nächsten Besuch sehr wahrscheinlich schon aus dem Fenster gerutscht, und ein ausgegebener Kaffee bleibt ebenso nur als Satz hängen. Die Figur verspricht also etwas, das das Spiel nicht hält.

- Spiegel zu `player_person_identity_knowledge`: ein Wissenssatz je Person und Spieler – Name, unter dem sie den Spieler kennt (`known_player_name`), gelernt aus dem Gespräch (Quelle, Tick), dazu zählbare Gefälligkeiten (ausgegeben, geholfen) mit Zeit. Keine freie Textablage, sondern Felder, die die Gesprächsroute als Fakt mitgibt („Der Spieler heißt Thomas; er hat dir am 25.10. einen Kaffee ausgegeben“).
- Lernen des Namens: serverseitig aus der Spieleräußerung (Muster „nenn mich …“, „ich heiße …“, „ich bin …“) oder über einen Marker der Figur wie bei `[[ACTION:ACCEPT_CREDITS]]; die Oberfläche könnte ergänzend „Vorstellen“ als Knopf anbieten, wenn ihr das lieber ist.
- Gefälligkeiten: `recipientPersonId` der Bestellroute (Aufgabe 9) schreibt den Eintrag; die Gesprächsroute liest ihn. Hängt mit R-8 (Wissensspuren) zusammen – dies wäre der erste Satz solcher Spuren.
- Bis dahin: Die Gesprächsroute sollte der Figur sagen, dass sie sich nur an die letzten Wortwechsel erinnert, damit sie kein „das merke ich mir“ verspricht – das übernimmt Gastronomie.

### R-13 (Gastronomie, 25.10.2026): Bestehende Gebäude kaufen und zum Lokal umbauen

Entscheidung (Thomas, 25.10.2026): Auf der Erde soll ein Café nicht als eigenes Gebäude gebaut werden. Man kauft ein bestehendes Gebäude des realen Ortes und baut es zum Café, zur Bar, zum Restaurant oder Hotel um – sofern es nicht schon eines ist. Das selbst gebaute Startcafé soll weg, sobald das geht.

- **Gebäude als Kaufobjekt:** Ein reales Gebäude aus `region_features` (Grundriss, Adresse) wird beim Kauf zu einer `tile_entities`-Zeile mit Verweis auf das Kartengebäude (W-4). Preis nach Fläche und Lage (Vorschlag: Grundfläche × Satz je Ort; die Innenstadt teurer); Verkäufer ist vorerst der Ort (`location_public_actors`), später der jeweilige Eigentümer.
- **Umbau als Nutzung:** Statt neuer Gebäudearten eine Nutzung am Gebäude (`cafe`, `bar`, `restaurant`, `hotel`); Umbaukosten und Bauzeit wie heute die Baukosten (Café 900, Bar 1 800, Restaurant 2 400, Hotel 3 600 Credits), Personalplätze und `transient_capacity` nach Größe. Ein Gebäude, das in den Kartendaten schon Lokal ist (`amenity` cafe/bar/restaurant, `tourism` hotel), ist nicht umbaubar – es ist bereits eines und gehört zunächst dem Ort.
- **Startcafé:** Übergang – entweder auf ein reales Gebäude an der Hauptstraße übertragen (das Personal, die Käufe und die Kennung `tile_entities.id` behalten, nur Grundriss und Adresse wechseln), oder beim ersten gekauften Café stilllegen. Vorschlag: übertragen, damit Mika und die Historie bleiben.
- **Wohnung über dem Lokal (R-6)** ergibt sich dann aus dem gekauften Haus: Geschosse über dem Erdgeschoss sind Wohnungen.
- Gastronomie liefert: Lokalart aus der Nutzung lesen, Grundriss nach Gebäudegröße, Bar- und Restaurantraum für die realen Lokale (Metropol, Balkan Grill), sobald sie Gebäude mit Nutzung sind.
- **Stand Erdkarte (W-4, 25.10.2026):** Die Karte liefert je Gebäude die OSM-Kennung (`i` in den Kacheln, `tile_entities.source_ref`) und die heutige Nutzung (`u`, `lib/worldlab/buildingUse.ts`); die Gebäudetafel zeigt Adresse, Größe, Nutzung, „Kaufen“/„Betreten“. Ein NOXIA-Gebäude mit `source_ref` steht automatisch am realen Grundriss. Hier noch zu tun:
  - ✅ **Lokale aus OSM:** Häuser, die laut OSM schon Lokal sind, nicht verkaufen bzw. nicht umbaubar machen – Gastronomie hat dafür `venueKindForRealPlace(tags)` (`lib/game/hospitality/venues.ts`) – in `notForSaleReason` bzw. `conversions` (`app/api/game/building-offer/route.ts`).
  - ✅ **Startcafé übertragen:** an der bestehenden `tile_entities`-Zeile `source_ref` auf das gewählte Haus setzen und Lage, Breite, Tiefe, Drehung aus `buildingFacts` übernehmen; die Karte zeichnet es dann auf dem Grundriss, das selbst gebaute Café verschwindet von selbst. Welches Haus an der Hauptstraße, entscheidet Thomas. – Gewählt: Hauptstraße 72 (siehe unten), änderbar.
  - **Gebäude aus OSM-Relationen** haben Kennungen wie `osm:relation:123:member:0`; Kaufweg und `buy_earth_building`/`acquire_earth_building` lassen nur `osm:(way|relation):<Zahl>` zu. Solche Häuser zeigen deshalb „Nicht verkäuflich: unbekanntes Gebäude“.

**Erledigt (Bevölkerung und Ökonomie, 25.10.2026)** – Migration `20261025180000_earth_venue_conversion.sql`, live eingespielt; Probe Kauf → Umbau → Abschluss in zurückgerollter Transaktion bestanden.

1. **Gebäude als Kaufobjekt.** Auf dem Kauf aus R-12 aufgebaut: `tile_entities.source_ref` ist die OSM-Kennung aus W-4. Neu übernimmt ein Trigger beim Anlegen die OSM-Tags (`source_tags`) und Geschosse (`building_levels`) aus `region_features`; Grundfläche steht wie bisher in `footprint_width_m` × `footprint_depth_m`. Preis wie in R-12 (Geschossfläche × Satz je Art + Grundfläche + Mietertrag; die Lage geht noch nicht ein, siehe unten). **Verkäufer ist der Ort** (`location_public_actors`), gebucht jetzt als versteuerte Überweisung wie `order_hospitality_item` (`noxia_taxed_purchase`: Käufer −Preis, Ort +netto, Koloniekasse +Steuer nach `colony_settings.tax_transaction`; auf der Erde derzeit 0 %). Gilt für `buy_earth_building` und `buy_earth_parcel`.
2. **Umbau als Nutzung.** Die Nutzung ist `tile_entities.entity_id` (`cafe`, `bar`, `restaurant`, `hotel`) – dieselben Schlüssel, die Karte, Bestellung, Personal und Innenraum schon lesen; es gibt keine neuen Gebäudearten. `POST /api/game/building-offer { action: 'convert' }` → `start_earth_venue_conversion`: Kosten wie der bisherige Neubau (900 / 1 800 / 2 400 / 3 600), sofort abgebucht; nach der Bauzeit (1 / 2 / 2 / 3 Ticks = Stunden) setzt `complete_due_earth_conversions` (stündlicher Cron `/api/cron/builds`) die Nutzung. Während des Umbaus bleibt das Haus `acquired_building` mit `conversion_plan`. Plätze nach Größe (`lib/worldlab/venueConversion.ts`, mit Tests): Personal nach `venueSizeForArea` (Café 1/2/3, Bar 1/2/3, Restaurant 2/3/4, Hotel 2/2/3); Wohnplätze 1 je 40 m² der **Obergeschosse** (R-6), wer dort wohnt, behält seinen Platz; im Hotel sind die Obergeschosse Zimmer (1 je 25 m², 2–30). Mindestgrundfläche: Café 40, Bar 50, Restaurant 70, Hotel 90 m². Andere Nutzungen bleiben bei R-12 (halber Preis, sofort). Auf der Erde lässt `/api/game/build/spatial` Café, Bar, Restaurant und Hotel nicht mehr neu bauen.
3. **Reale Lokale gehören dem Ort.** Häuser mit `amenity` cafe/bar/pub/restaurant (u. a.) oder `tourism` hotel (gleiche Regel wie `venueKindForRealPlace`, in SQL `real_venue_kind`) sind nicht verkäuflich („Lokal des Ortes“) und nicht umbaubar. In Sundern angelegt als staatliche Gebäude: **Metropol** (Bar, Hauptstraße 76) und **Balkan Grill** (Restaurant, Hauptstraße 68). Bar und Restaurant sind aktive Gebäudearten (R-1, Stufe 2) mit den Karten aus R-2.
   **Geändert (Thomas, 25.10.2026): Reale Lokale sind kaufbar, aber teurer, weil schon ausgebaut.** Nicht verkäuflich bleiben nur öffentliche Gebäude, Gotteshäuser und Wahrzeichen. Zum Preis kommt der Ausbauwert (= Umbaukosten der Lokalart: Café 900, Bar 1 800, Restaurant 2 400, Hotel 3 600; `fitOutValue` in `lib/worldlab/buildingOffer.ts`), auch beim Flurstückskauf. Gehört das Lokal schon dem Ort (Metropol, Balkan Grill), wechselt nur der Eigentümer – Kennung, Ausbau und Käufe bleiben; ein reales Lokal ohne Eintrag wird beim Kauf gleich mit seiner Lokalart angelegt, Personal nach Größe, Wohnungen in den Obergeschossen, ohne neu erzeugte Bewohner. Ein gekauftes Lokal darf zu einer anderen Lokalart umgebaut werden. Migration `20261025200000_earth_real_venue_purchase.sql`, live; Probe (Metropol übernehmen, neues reales Café kaufen) in zurückgerollter Transaktion bestanden. Metropol kostet damit etwa 4 400 Credits.
4. **Startcafé übertragen**, nicht gelöscht: dieselbe `tile_entities.id`, Personal, 63 Käufe und Eigentümer bleiben; Grundriss und Adresse sind jetzt die des realen Hauses **Hauptstraße 72** (Geschäftshaus, 12 × 11,6 m, gleich gegenüber dem alten Platz), 2 Personalplätze, 3 Wohnplätze im Obergeschoss. Die Verankerung des Personals auf der Karte ist mitgezogen.

Offen:
- ✅ **Lage im Preis** (entschieden Thomas, 25.10.2026: Vorschlag übernommen): Aufschlag auf Bau- und Bodenwert nach Abstand zur nächsten Ortsmitte (OSM-Ortspunkt `place=*` aus `region_features`), linear fallend bis zum Rand – Stadt +100 % bis 3 km, Kleinstadt +60 % bis 1,2 km, Stadtteil +30 % bis 800 m, Dorf +25 % bis 500 m, Weiler +10 % bis 250 m (`locationFactor` in `lib/worldlab/buildingOffer.ts`, mit Tests). Gilt für Häuser und Flurstücke; die Miete bleibt außen vor. Hauptstraße 72 liegt rund 510 m von der Mitte Sunderns: Faktor 1,34. Das Angebot liefert `location: { factor, place, distanceM }`.
  **Später konkreter auszuarbeiten (Thomas, 25.10.2026):** Bodenschätze, Infrastruktur (Anschluss an Straße, Bahn, Versorgung), Fertigungsanlagen in der Nähe und Erholungswert als weitere Lagefaktoren.
- Umbaukosten gehen wie Baukosten in eine Senke ohne Gegenkonto (wie R-12, Aufgabe 6) – ob künftig an eine Baufirma oder die Gemeinde, ist offen.
- Bewohner kaufen in Bar und Restaurant noch nichts: `npc_service_catalog` kennt nur `cafe` (siehe Antwort zu R-2, zieht mit LIVING-0012 Schritt 3 um).
- Die übrigen selbst gebauten Cafés (Q1, Peru) sind nicht betroffen.
- Fragen und Anschluss an Gastronomie: G-4 in `hospitality.md`; an die Erdkarte: W-5 in `world-map.md`.

### R-14 (Gastronomie, 27.10.2026): Personal für die Bank an der Hauptstraße 140

Die staatliche Bank der Erde steht seit `20261027090000_earth_bank_sparkasse.sql` am realen Ort der Sparkasse in Sundern, BeratungsCenter Hauptstraße 140 (`osm:way:246890726`). Kennung, Konten und Eigentum bleiben. Es arbeitet dort aber **niemand**: `person_assignments` hat für die Bank keine aktive Stelle. Der Innenraum zeigt deshalb Automatenbetrieb, und am neuen Beratungstisch gibt es kein Gespräch.

- **Bitte:** Die Bank wie ein Lokal Personal einstellen lassen, bis `staff_capacity` (jetzt 4) besetzt ist. Das könnte über `run_venue_staffing` laufen oder über einen gleichartigen Lauf für öffentliche Gebäude.
- **Rollen:** 2 × Schalter, 1 × Beratung, 1 × Büro. Der Innenraum verteilt die Plätze in dieser Reihenfolge: Schalter, Beratung, zweiter Schalter, Büro. Wer zuerst kommt, steht am Schalter, wer als Zweites kommt, sitzt an der Beratung.
- **Lohn:** zahlt der öffentliche Akteur der Erde, wie bei Metropol und Balkan Grill.
- **Gilt ebenso für:** Akademie, Verwaltung, Raumhafen und Warenhaus, soweit sie leer sind. Ohne Personal kann dort niemand Auskunft geben.

### R-15 (Gastronomie, 27.10.2026): Lernschwellen serverseitig durchsetzen

Thomas, 27.10.2026: „so wie es in der Bank schon existiert auch bei anderen Gebäuden Zugang zu Lernmodulen öffnen, damit man bestimmte Dinge überhaupt erst nutzen kann“.

**Was schon da ist:** Jedes begehbare Gebäude zeigt rechts unter „Wissen hier“, welches Wissen es verlangt oder wofür es hilft. Das Lernmodul öffnet sich gleich im Raum (Liste in `lib/game/interiors/learningGates.ts`, API `GET /api/game/learning/gates?kind=…`). Durchgesetzt wird bisher nur der Kredit (`hasCreditClearance` in `app/api/game/bank/route.ts`). Die übrigen Schwellen stehen als `need: 'helps'`. Sie stammen aus dem Wissenskatalog (`lib/knowledge/data.ts`), der sie den Gebäuden schon zuordnet.

**Bitte:** Entscheiden und serverseitig sperren. Danach in `learningGates.ts` den Eintrag auf `need: 'required'` setzen; Anzeige und Wissen des Personals ziehen dann von selbst nach.

| Schwelle | Modul | Vorschlag, was sie sperrt | Wo |
|---|---|---|---|
| `UNL:NOX:bank-collateral` | „Was ist ein Sicherheitenwert?“ | Reiter „Sicherheiten“ und Kredit über 50 % des Rahmens | Bank-API |
| `UNL:NOX:bank-compound` | „Was ist Zinseszins?“ | Festgeld bzw. Zinseszins-Vorschau, falls es das geben soll | Bank-API |
| `UNL:NOX:advanced-trading` | „Was ist Arbitrage?“ | Handel zwischen Orten, Kauf- und Verkaufsaufträge über einer Menge | Warenhaus/Markt |
| `UNL:NOX:land-value` | „Was ist Bodenwert?“ | Kauf eines Hauses oder Flurstücks (`buy_earth_building`, `buy_earth_parcel`) | Verwaltung/Hauskauf |

Für die Raumhafen-Schwellen (`UNL:NOX:NAV:ORBITAL`, `UNL:NOX:NAV:CURVATURE`) ist nichts zu tun: Sie wirken schon über die Navigationsgüte (`lib/knowledge/navigationProficiency.ts`).

**Hinweis:** Für Sicherheitenwert, Arbitrage, Bodenwert und Bahnkrümmung liefert SSF noch kein Modul. Die Tafel sagt dann „Lernmodul folgt“. Eine Sperre ohne Modul würde den Weg ganz verschließen. Deshalb erst sperren, wenn SSF das Modul hat (KB-REQUEST-0003 bei SSF).

### R-16 (Gastronomie, 27.10.2026): Gekaufte Häuser als Sicherheit

Die neue Beratungsmappe in der Bank (`bankAdvice` in `lib/game/bank/bankInterior.ts`) rechnet mit `collateralTotal` aus `calcCollateral`. Als Sicherheit zählen dort nur Fördergebäude (Mine, Solar, Eisbohrer, Wasserrecycler) und Schiffe.

Auf der Erde hat ein Spieler aber vor allem gekaufte Häuser und Lokale mit Mieteinnahmen (R-12, R-13). Sie zählen bisher nicht.

**Bitte:** Ertragswert gekaufter Häuser (Miete) und Lokale (Umsatz) als Sicherheit aufnehmen. Danach den Satz „als Sicherheit zählen hier Gebäude mit Förderertrag und Schiffe“ in `bankAdvice` anpassen.

### R-17 (Erdkarte, 28.10.2026): Einstiegsquiz – Ergebnis zeigen und weiter nutzen

Thomas, 27.10.2026: „Was passiert aktuell mit den Antworten der Fragen, die die Person zu Beginn gestellt werden?“ – und auf den Befund hin: „Ja mache das“.

**Stand heute:** `app/api/game/onboarding-quiz/route.ts` erzeugt 7 Fragen aus verschiedenen Fachgebieten (Claude Haiku, sonst fester Ersatzsatz). Die Lösungen liegen nur auf dem Server (`onboarding_quiz_attempts`). Ausgewertet wird nur die Zahl der richtigen Antworten. Daraus wird eine Stufe 1–6, gespeichert in `profiles.knowledge_level`. Welche Antwort gewählt wurde, wird nicht gespeichert. Gelesen wird die Stufe nur von der Akademie (`app/dashboard/SchoolOverlay.tsx`, Schwierigkeit der Aufgaben). Wer überspringt, hat Stufe 1. Keine Freischaltungen, kein Einfluss auf Startort, Geld oder Beruf. Live: ein Versuch, 7/7, Stufe 6.

**Was fehlt:**

1. **Ergebnis zeigen.** Der Server gibt `score`, `total` und `level` zurück, `WelcomeSetup.tsx` (`submitQuiz`) springt aber gleich zu den Startkarten. Vorschlag: eine Zeile vor den Karten, etwa „7 von 7 richtig – du beginnst in der Akademie auf Stufe 6“, mit dem Hinweis, dass sich die Stufe später anpasst.
2. **Stufe anpassen.** Heute bleibt die Stufe für immer, wie das Quiz sie gesetzt hat. Vorschlag: Die Akademie hebt oder senkt `knowledge_level` nach den letzten Ergebnissen (z. B. 4 von 5 richtig auf derselben Stufe → eine Stufe höher, 1 von 5 → eine tiefer), serverseitig in `app/api/game/school/route.ts`.
3. **Stärken je Fachgebiet nutzen.** Jede Frage hat ein Fachgebiet (`domain`). Vorschlag: Ergebnis je Fachgebiet im Versuch speichern (nicht die einzelnen Antworten) und als Anregung verwenden – Akademie-Aufgaben aus schwächeren Gebieten, Hinweise auf passende Stellen (R-10, Aufgabe 12). Bleibt diagnostisch: keine Freischaltungen, kein Alter (wie bisher im Code festgehalten).

**Zuständigkeit:** Es gibt kein eigenes Teilprojekt für Akademie und Einstieg. Wissen und Lernschwellen liegen schon hier (R-15). Wenn ein Teilprojekt „Bildung“ entsteht, zieht der Request dorthin um.

### R-18 (Gastronomie, 28.10.2026): Preise und Dienstleistungen je Haus durch den Betreiber

Thomas, 28.10.2026: „Der Betreiber eines Lokals oder auch Ladens etc. sollte die Möglichkeit haben, selbst Preise und Dienstleistungen anzupassen; standardmäßig gilt die Toilette als frei für jeden.“ Anlass: In der Gesprächsauswertung (G-6) hat eine Passantin einen Spieler zum Balkan Grill geschickt, um dort auf die Toilette zu gehen.

**Was schon da ist (Gastronomie):**
- Jedes Lokal hat eine WC-Tür. Der Spieler kann hingehen und sie benutzen.
- Die Hausregel steht in `lib/game/hospitality/venueServices.ts` (`ToiletRule`: verfügbar, Preis, nur für Gäste). Standard: frei für jeden.
- Das Personal kennt die Regel. Fragt jemand nach der Toilette, steht sie vorn in seinen Gesprächsfakten.
- Der Innenraum liest schon `services` aus `GET /api/game/hospitality/guests` (`venueServiceRules(data.services)`). Fehlt das Feld, gilt der Standard.

**Bitte:**
1. **Speichern je Haus:** Preise der Karte und Dienstleistungen je Haus (`tile_entities.id`), z. B. eine Tabelle `venue_price_overrides(tile_entity_id, item_code, price_credits, active)`. Dazu Dienstleistungen wie `toilet` mit `price_credits` und `guests_only`. Ohne Eintrag gilt die heutige Karte (`hospitality_menu`) bzw. „Toilette frei“.
2. **Ändern dürfen:** nur der Eigentümer bzw. Betreiber (`profile_id`, Betreiberkonto). Gilt für Lokale ebenso wie für Läden und andere Häuser mit Angebot.
3. **Liefern:** `services: { toilet: { available, priceCredits, guestsOnly } }` in `/api/game/hospitality/guests`; die Karte mit den Hauspreisen in `/api/game/hospitality/order`.
4. **Bezahlen:** Eine kostenpflichtige Toilette als Posten über denselben Buchungsweg wie die Karte, z. B. `item_code = 'toilet'`. Der Innenraum zeigt dann „kostet X Cr“, kann es aber erst mit diesem Weg abbuchen.
5. **Später, Bedienung:** Die Einstellungstafel für den Eigentümer (Preise, Toilette frei / nur Gäste / Gebühr) baut Gastronomie im Innenraum, sobald gespeichert werden kann.

**Anregung (Thomas):** Die Toilettenfrage war vermutlich ein Test, wie das Spiel reagiert. Sie zeigt aber ein echtes Bedürfnis. Wenn Bedürfnisse der Figuren weiter ausgebaut werden (R-9), wäre „Toilette“ ein Grund, ein Lokal zu betreten, ohne etwas zu kaufen. Für den Betreiber ist das eine Entscheidung zwischen Gastfreundschaft und Einnahme.

