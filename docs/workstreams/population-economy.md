# Teilprojekt Bevölkerung und Ökonomie

Maßgeblich: `docs/decisions/NOXIA-LIVING-0006` bis `0010`, `NOXIA-FIN-0001`, `NOXIA-OMNI-0001`, `docs/research/colony-run.md`.

## Stand

- Schattenbetrieb Wohnen läuft live (`NOXIA_HOUSING_SHADOW`). Einzug in staatlichen Wohnraum gebaut, Schalter `NOXIA_HOUSING_PUBLIC_PLACEMENT` aus.
- Arbeitgeber leben von einer 14-Tage-Reserve (erster Lohnlauf Tick 2136). Laufende Einnahmen fehlen.
- Automatische Gebäudeausschüttung ist aus. Erlöse nur aus echten Zahlungen.
- Bestellung im Lokal: `order_hospitality_item` und `/api/game/hospitality/order` (Migration `20261010110000`).
- Hafenkantine live an allen sechs Orten mit Hafen (NOXIA-LIVING-0013, Migration `20261013100000`): Bewohner kaufen zuerst im Lokal, sonst in der Kantine; wer nichts zahlen kann, bekommt eine Notration ohne Geldfluss.

## Offene Aufgaben

1. Prüfskript `supabase/tests/public_housing_placement.test.sql` laufen lassen, danach Schalter für den Einzug.
2. Stellenkapazität: offene Stellen eines Lokals aus dessen Personalplätzen ableiten (`VENUE_LAYOUTS`, siehe `hospitality-venues.md` 6.1).
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
13. Zeitzonen, Sprachen und Kulturen – **entschieden (Thomas, 13.10.2026): wichtig, die Welt ist nicht deutschsprachig mit Kulisse** (in China spricht man häufiger Mandarin als Deutsch). Entwurf: `docs/decisions/NOXIA-LIVING-0014-time-zones-languages-cultures.md` – Zeitzone für Spieler und Erdorte, Sprachen je Person (aus Herkunft, nie aus Aussehen) und je Ort, Gespräche in der Sprache der Figur mit spürbarer Übersetzung, Kultur als Biografie einzelner Personen. **Kanon (Thomas, 14.10.2026):** Übersetzung um 2100 nahezu perfekt – Sprache ist Zugehörigkeit, kein Hindernis; Mars läuft nach Sol; auf dem Mars entsteht aus der Sprachvielfalt eine eigenständigere Kolonialsprache, wie bei den Galut-Schichten von Mishkenaz.

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
- Offen hier: Wer zieht in reale Häuser (Wohnungsmarkt)? Miete an Spieler als Vermieter (`player_corp`) wirklich abrechnen. Umbauen mit Bewohnern statt Abriss.

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
