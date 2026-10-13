# Teilprojekt Bevölkerung und Ökonomie

Maßgeblich: `docs/decisions/NOXIA-LIVING-0006` bis `0010`, `NOXIA-FIN-0001`, `NOXIA-OMNI-0001`, `docs/research/colony-run.md`.

## Stand

- Schattenbetrieb Wohnen läuft live (`NOXIA_HOUSING_SHADOW`). Einzug in staatlichen Wohnraum gebaut, Schalter `NOXIA_HOUSING_PUBLIC_PLACEMENT` aus.
- Arbeitgeber leben von einer 14-Tage-Reserve (erster Lohnlauf Tick 2136). Laufende Einnahmen fehlen.
- Automatische Gebäudeausschüttung ist aus. Erlöse nur aus echten Zahlungen.
- Bestellung im Lokal: `order_hospitality_item` und `/api/game/hospitality/order` (Migration `20261010110000`).

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
10. Essensangebot an bewohnten Orten (aus R-3): Mars / Tharsis Hub, Phobos, Prometheus Station und Mond / Shackleton haben Bewohner, aber kein Café und keine Speisehalle. Zu entscheiden: Standardausstattung nach Ortsstufe jetzt auslösen (`settlement-tiers.md`: Café ab Stufe 1, staatlich) oder vorerst je Ort ein staatliches Café per Migration setzen.
11. Wahl unter mehreren Lokalen am Ort streuen (aus R-1): `run_npc_consumption` nimmt immer das billigste, bei Gleichstand dasselbe Gebäude. Zusammen mit R-5 (Ausgehen nach Tageszeit) und R-4 (Öffnungszeiten auch in der Kaufauswahl prüfen).

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

### R-5 (Gastronomie, 13.10.2026): Ausgehen nach Tageszeit

Damit sich die drei Lokale unterscheiden: Bewohner gehen morgens ins Café, mittags und abends ins Restaurant, abends in die Bar. Gewichtung der Käufe nach Stunde (`circadian.ts`) und nach Bedürfnis (Aufgabe 5); Freizeit und Geselligkeit als Anlass, nicht nur Hunger. Folgt auf R-2 und R-3.

### R-6 (Gastronomie, 13.10.2026): Wohnen über dem Lokal

Der Innenraum zeigt eine Treppe „PRIVAT ↑“, sobald ein Gastronomiegebäude `residential_capacity` hat; das Personal weiß, dass oben gewohnt wird. Heute hat kein solches Gebäude Wohnplätze.

- Wohnplätze für Café, Bar und Restaurant (als Variante oder Ausbau), Vorschlag: 1–2.
- Der Wirt wohnt bevorzugt über seinem Lokal; sonst Vermietung mit Miete an den Eigentümer.
- Zu entscheiden: eigene Gebäudeart „Wohn- und Geschäftshaus“ oder Ausbau eines bestehenden Lokals.

### R-7 (Gastronomie, 13.10.2026): Hotel und Gästezimmer

Vorbild SunDog: Im Hotel mietet man am Empfang ein Zimmer und ruht sich aus. Der Innenraum zeigt bereits „ZIMMER ↑“, sobald ein Gebäude `transient_capacity` hat.

- Gebäudeart `hotel` (oder Gasthof = Restaurant mit Gästezimmern), baubar, mit `transient_capacity`.
- Zimmerpreis je Nacht, Buchung als versteuerte Überweisung wie bei `order_hospitality_item`; belegte Zimmer zählen gegen die Plätze.
- Wirkung der Übernachtung: Erholung für Spieler und Reisende (zusammen mit Hunger und Durst, Aufgabe 5); Reisende als Personen, die nur vorübergehend am Ort sind.
- Gastronomie baut danach Lobby und Empfang als Innenraum und den Knopf „Zimmer nehmen“.

### R-8 (Gastronomie, 13.10.2026): Gerüchte als Wissen der Personen, Auskunft gegen Geld

Das Personal erzählt jetzt, was am Ort geschehen ist (`lib/game/hospitality/hearsay.ts`, aus Käufen, Baustellen und `population_events`). Das ist aber ein Blick des Lokals auf die Daten: Niemand hat es wirklich erfahren, niemand erinnert sich, und es wandert nicht weiter.

- Wissensspuren je Person: wer was gesehen oder von wem gehört hat, mit Alter und Verlässlichkeit; Weitergabe bei Begegnungen, im Lokal besonders. Der Innenraum liest dann das Wissen der anwesenden Person statt `venueState`.
- Auskunft als Ware nach SunDog (in der Bar kauft und verkauft man „Info“ beim Wirt): Preis, was eine Auskunft enthält (Preise anderer Orte, Stellen, Aufträge), und was der Spieler selbst verkaufen kann. Buchung über den Server, nicht im Gespräch.
- Gastronomie baut danach den Posten „Auskunft“ am Tresen.

### R-9 (Gastronomie, 13.10.2026): Lehren aus SunDog für Bedürfnisse und Waren

Quelle: Spielbeschreibung unter https://gamesoffame.wordpress.com/sundog/ (von Thomas genannt). Was davon nicht im Lokal liegt:

- **Sichtbare Balken:** SunDog zeigt vier Balken – Ernährung, Ruhe, Kraft, Gesundheit. Für Aufgabe 5 heißt das: Hunger und Durst (und Erholung, R-7) des Spielers stehen dauerhaft sichtbar in der Kopfzeile, nicht nur als Zahl im Profil. Essen kauft man im Lokal; wer lange unterwegs ist, ohne zu essen, bekommt Folgen. Das Lokal zeigt dann je Posten, was er stillt.
- **Alkohol hat einen Preis:** In SunDog kann Bier zur Ohnmacht führen, und man wird ausgeraubt. Zu entscheiden, ob Getränke der Bar eine Nebenwirkung haben (z. B. Wirkung auf Leistung im nächsten Tick). Kein Raub ohne ein Sicherheitsmodell.
- **Ware beim Wirt:** In SunDog bekommt man in der Bar über „Info“ auch Gegenstände, legale und illegale; der Handel findet in einer Nische mit einer Person aus der Bar statt. Ergänzt R-8: Ob das Lokal Ort für Geschäfte zwischen Personen und Spieler wird, und ob es verbotene Ware gibt. Die Sitznischen der Bar sind im Innenraum vorhanden.
- **Bilder als gemeinsamer Bestand:** Die Posten der Karte haben jetzt gezeichnete Bilder (`app/earth/HospitalityItemIcon.tsx`, Schlüssel ist `item_code`). Wenn Waren, Inventar und Markt ebenfalls Bilder bekommen (SunDog: Gegenstände per Ziehen und Ablegen), sollte es ein gemeinsamer Bestand mit einer Regel für Größe und Stil werden. Neue Zeilen in `hospitality_menu` (R-2) bitte mit den dort genannten Codes, sonst erscheint das Ersatzbild.
