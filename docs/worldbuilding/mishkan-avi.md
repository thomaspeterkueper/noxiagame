# Mishkan Avi – Siedlung am Valles Marineris

Status: **Im Spiel angelegt (27.10.2026), noch ohne Bewohner.** Name von Thomas (27.10.2026); die übrigen Festlegungen sind Annahmen, denen Thomas zugestimmt hat („beim Rest folge ich deinen Annahmen“, 27.10.2026). Bezug: `docs/characters/adar-berger-line.md`, NOXIA-LIVING-0013, NOXIA-LIVING-0014, `docs/lore/marsianisch-wortliste.md`.

Notation: **[W]** von Thomas festgelegt, **[S]** Annahme für NOXIA, **[R]** reale Vorlage, **[OFFEN]** zu entscheiden.

## Wesen

- [W] Neue, sehr kleine Siedlung direkt am Valles Marineris, nahe dem Monolithen der Axis Kammer (entdeckt 2087).
- [W] Hier leben Zereya (85) und ihre Tochter Soraya Adar (61). Soraya kam 2085–2086 zum Mars, Zereya 2086 – also gerade zum Spielbeginn 2086 (Thomas, 28.10.2026). Die Siedlung ist entsprechend neu. Der Monolith wird erst 2087 entdeckt.
- [S] Kein Handelsplatz und keine Werft. Ein stiller Ort, den man nicht zufällig findet: Wer hierher kommt, will hierher.

## Lage

- [S] Rand der Melas Chasma, dem breiten Mittelteil des Valles Marineris, etwa 10,5° S / 72,5° W (287,5° O). Melas ist der Abschnitt, in dem der Graben am tiefsten und breitesten ist; die Axis Kammer liegt „tief unter dem Valles Marineris“.
- [R] Gelände aus dem vorhandenen Mars-Datensatz `mars_mgs_mola_463m` (MOLA), wie beim Tharsis Hub. Kein erfundenes Terrain nötig.
- [OFFEN] Genaue Lage der Axis Kammer zur Siedlung – Sichtweite, ein Abstieg, ein Tunnel?

## Zeit

- [W] Sol-Zeit (NOXIA-LIVING-0014).
- [S] Ortssonnenzeit nach Längengrad, wie die Rover-Teams sie heute führen: Mishkan Avi liegt etwa 30° östlich des Tharsis Hub (102° W). Dort ist es rund zwei Marsstunden später als im Tharsis Hub. Wer zwischen beiden funkt, merkt es.

## Größe und Ausstattung

- [S] Außenposten (Ortsstufe 0), anfangs etwa 12 Bewohner, Obergrenze 60.
- [S] Gebäude, alle staatlich: Landeplatz, ein kleines Habitat, eine Verwaltung (Heimatort-Registrierung), dazu die Hafenkantine im Landeplatz mit **Automat** (NOXIA-LIVING-0013: kleine Kantine, nur Automat).
- [S] Ein richtiges Lokal gibt es nicht – das ist hier eine echte Gelegenheit für einen Spieler (NOXIA-LIVING-0013).
- [S] Öffentliches Konto („Mishkan Avi – Öffentliche Dienste“) und Koloniekasse mit Steuersätzen 0, wie Phobos.

## Menschen

- [W] Zereya und Soraya, Anlage über die Brücke für Buchfiguren (`CanonicalCharacterRef`, `docs/canonical-character-bridge.md`) nach den Regeln „Vor Aktivierung“. Keine Namen für Nachkommen erfinden.
- [S] Übrige Bewohner (etwa 10): Menschen, die wegen der beiden oder wegen der Axis Kammer hier sind – Pflege und Versorgung, Technik für Landeplatz und Lebenserhaltung, ein oder zwei Forschende. Gewöhnliche Bewohner der Simulation, ausdrücklich **keine** Nachkommen der Linie.
- [S] Herkunft gemischt wie auf dem Mars üblich; einige Redborn.

## Sprache

- [S] Eigener Dialekt des Marsianischen („Mishkan-Dialekt“) mit der stärksten Mishkenaz-Schicht des Mars: Hier wird Mishkenaz nicht nur in Silben benutzt, sondern auch in ganzen Wendungen gesprochen, weil Soraya und Zereya es täglich sprechen. *olam* und *-ref* (Überlieferung) sind hier gebräuchlicher als anderswo – Zereyas Zeitprofil färbt ab.
- [S] Besucher hören den Unterschied sofort; die Übersetzung gibt den Sinn wieder, nicht den Klang.

## Einbau ins Spiel (vor dem Anlegen zu klären)

Ein neuer Ort ist heute nicht nur ein Datenbankeintrag:

- 63 Stellen im Code lesen `locations`; keine filtert nach Sichtbarkeit. Ein neuer Ort erscheint sofort in Weltabfragen, Reiseliste und Übersichten.
- Deimos ist an 29 Stellen fest verdrahtet (Oberflächenansicht, Sonnensystem, Andocken, Ankunftskontrolle, Schiffe, Logistikknoten). Für Mishkan Avi braucht es dieselben Stellen – oder besser einen allgemeinen Weg für kleine Mars-Oberflächenorte, damit nicht jeder neue Ort Code braucht.
- Reisen auf der Marsoberfläche (Tharsis Hub ↔ Mishkan Avi, rund 2 260 km Großkreis): **je nach Entfernung und Möglichkeiten verschiedene Wege** (Thomas, 27.10.2026), nach den Definitionen im OTA – siehe Abschnitt „Verkehr“.

**Entschieden (Thomas, 27.10.2026): allgemein statt einzeln.** Kleine Mars-Oberflächenorte bekommen einen gemeinsamen Weg im Code; Mishkan Avi ist der erste Fall, nicht ein weiterer Sonderfall wie Deimos.

Reihenfolge-Vorschlag:

1. ~~Allgemeinen Mars-Oberflächenort im Code ermöglichen.~~ Erledigt 27.10.2026 (`lib/game/locationBody.ts`, Commit `801a418c`): Körper aus `celestial_body_id`; Reise über die Marsbahn (Bahn-Aliasse in `orbits.ts`, Server meldet Orte aus der DB an); gemeinsame Mars-Ansicht für jeden Mars-Oberflächenort; Geländedatensatz über den Weltrahmen geteilt.
2. ~~Migration: Ort, Weltrahmen auf MOLA, Konto, Kasse, Gebäude, Kantine mit Automat.~~ Erledigt 27.10.2026 (`20261027100000_mishkan_avi.sql`), mit `simulate_tick = false` bis Bewohner da sind.
3. Bewohner, danach Zereya und Soraya über die Buchfiguren-Brücke.
4. Dialekt und Wortliste in die Gespräche.

Noch offen aus dem Umbau:

- **Reise Tharsis Hub ↔ Mishkan Avi** läuft vorerst als kürzester Flug über die Landeplätze (Untergrenze 10 s, wie Mars ↔ Phobos), weil beide Orte die Marsbahn teilen. Eigene Zeiten nach Entfernung und Fahrweg (R0-Route mit Rover für die Nähe) folgen mit einem Mars-Oberflächennetz.
- **Baurechte:** Mars-Gebäude mit `allowedLocations: ['mars']` sind an Mishkan Avi noch nicht baubar; Gebäude ohne Einschränkung (z. B. Café) schon. Nächster Schritt: `allowedLocations` nach Körper (`body:mars`).
- Gelände: Der MOLA-Datensatz ist katalogisiert, aber ohne geladene Kacheln – wie am Tharsis Hub. Gebäude stehen auf `terrain_status = unresolved`; es wird kein flaches Ersatzgelände erfunden.

Berührt die Teilprojekte Erdkarte und Gastronomie nicht, wohl aber die Dashboard- und Reiseteile – Zuständigkeit klären.

## Verkehr (nach OTA)

Quellen im OverTime Archive (Drive):

- **OTA-TEC-0090 „Mars-Fahrwege“** (v1.3, 18.10.2026): Infrastrukturklassen ohne feste Entwicklungsleiter – **R0** markierte Route, **R1** planierte Piste, **R2** stabilisiert, **R3** gesintert, **R4** Schwerlaststraße, **G1** Schiene/Beamway, **G2** fortgeschrittener Guided Transport. Phasen: frühe Außenstation (R0/R1), industrielles Wachstum (R1/R2, R3/R4 an Knoten, G1 als Kandidat), reifes Netz (R2/R4 plus G1 auf Hochlastkorridoren). Kritikalität C0–C3; eine zweite Spur im selben Korridor ist keine geografische Redundanz. NOXIA leitet Reisezeit, Baukosten und Wartung selbst ab.
- **OTA-TEC-0038 Erkundungsrover Typ P** (Mond-Standardtyp, Frühphase, bemannt) und **OTA-TEC-0039 VEX-47** (Explorationsdrohne) – die vorhandenen Fahrzeug-Dossiers für die Oberfläche.
- **OTA-TEC-0091 Mars-Versorgungstrassen** – Energie, Wasser, Daten; gemeinsame Führung mit Fahrwegen nur, wenn ein Straßenschaden nicht alle Lebensadern zugleich trifft.
- Erde-Mond-Verkehr (CYGNUS CTV, PELICAN, ASCE-Shuttle) ist definiert; ein Dossier für **lange Strecken auf dem Mars** (Hopper, Fluggerät, suborbital) habe ich nicht gefunden. [OFFEN]

Folgerung für Mishkan Avi [S]:

- Außenposten in Phase A: **R0-Route** zum nächsten Ort, R1 nur an Landeplatz und Habitat. Wenig Verkehr, Kritikalität C1 – ein Ausfall verzögert, gefährdet aber nicht.
- 2 260 km bis Tharsis Hub sind für einen Rover auf R0 eine Fahrt über viele Sol. Regelverkehr daher eher über den Landeplatz (Shuttle oder Hopper), der Rover für die Nähe – Axis Kammer, Grabenrand, Außenstellen.
- Im Spiel wählt die Reise das Verkehrsmittel nach Entfernung und vorhandenem Fahrweg, nicht nach Ortsnamen: kurze Strecke mit Fahrweg → Rover; lange Strecke ohne Fahrweg → Flug über die Landeplätze.

