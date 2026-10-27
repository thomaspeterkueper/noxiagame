# Mishkan Avi – Siedlung am Valles Marineris

Status: **Entwurf, nicht im Spiel angelegt.** Name von Thomas (27.10.2026); die übrigen Festlegungen sind Annahmen, denen Thomas zugestimmt hat („beim Rest folge ich deinen Annahmen“, 27.10.2026). Bezug: `docs/characters/adar-berger-line.md`, NOXIA-LIVING-0013, NOXIA-LIVING-0014, `docs/lore/marsianisch-wortliste.md`.

Notation: **[W]** von Thomas festgelegt, **[S]** Annahme für NOXIA, **[R]** reale Vorlage, **[OFFEN]** zu entscheiden.

## Wesen

- [W] Neue, sehr kleine Siedlung direkt am Valles Marineris, nahe dem Monolithen der Axis Kammer (entdeckt 2087).
- [W] Hier leben um 2100+ Zereya (um die 99) und ihre Tochter Soraya Adar (um die 75). Soraya kam 2085–2086 zum Mars, Zereya 2086.
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
- Reisen auf der Marsoberfläche (Tharsis Hub ↔ Mishkan Avi, rund 2 260 km Großkreis): mit Rover, Hopper oder Shuttle? [OFFEN]

Reihenfolge-Vorschlag:

1. Allgemeinen Mars-Oberflächenort im Code ermöglichen (Darstellung, Reise, Andocken), getestet an Mishkan Avi mit `simulate_tick = false`.
2. Migration: Ort, Weltrahmen auf MOLA, Konto, Kasse, Gebäude, Kantine mit Automat.
3. Bewohner, danach Zereya und Soraya über die Buchfiguren-Brücke.
4. Dialekt und Wortliste in die Gespräche.

Berührt die Teilprojekte Erdkarte und Gastronomie nicht, wohl aber die Dashboard- und Reiseteile – Zuständigkeit klären.
