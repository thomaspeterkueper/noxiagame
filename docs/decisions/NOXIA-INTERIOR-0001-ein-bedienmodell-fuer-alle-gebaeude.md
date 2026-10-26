# NOXIA-INTERIOR-0001 – Ein Bedienmodell für alle Gebäude

Status: accepted (Richtung), Umsetzung proposed
Datum: 2026-10-26
Bezug: `docs/gameplay/hospitality-venues.md`, `coordination/open/20261017-1418-core-to-interiors-cultural-places.md`, Requests W-2/W-3 (Weltkarte)

## Entscheidung (Thomas, 26.10.2026)

Jedes Gebäude hat in etwa dieselbe Steuerungslogik. Unterschiedlich sind das Wissen der Figuren darin und die Einrichtung.

## Was das heißt

**Gleich in jedem Gebäude (ein Bauteil, einmal gebaut):**
- Bewegung: WASD, Klick auf einen Platz zum Hinsetzen, „Zum Tresen/Empfang/Schalter gehen“, Weg um die Möbel herum, ESC verlässt.
- Personen: Klick wählt, Kurzname über der Figur (Mann/Frau/Name), Porträt und Beschreibung in der rechten Tafel, Gespräch mit kurzer Eingabe; Personal spricht am Bedienplatz zuerst; Gäste setzen sich dazu.
- Rechte Tafel: nur, was gerade gebraucht wird – Person, Karte bzw. Angebot des Hauses, Statuszeile; geschlossen-Tafel mit Grund und Öffnungszeit.
- Bestellen/Buchen: Knopf am Bedienplatz oder am Tisch, Zahlung im Moment der Buchung, Bestelltes sichtbar beim Gast.

**Je Gebäude verschieden (Daten, kein Code):**
- Einrichtung: Grundriss aus einer Vorlage (`lib/game/buildings/interiors/templates/*`) plus Möbel, Bedienplatz, Sichtbereiche, Größe nach Grundfläche; Stil (Boden, Wand, Licht) je Gebäudeart.
- Wissen: was die Figuren von ihrem Platz aus sehen (lokale Fakten), was sie über die Gegend wissen (Ortswissen), was sie mitbekommen haben (Mitbekommenes), wie sie Neue einführen (Haltung je Haus), was ihre Rolle weiß (Akademie: Kurse, Verwaltung: Anträge, Hafen: Abflüge).
- Angebot: Karte des Lokals, Zimmer des Hotels, Kurse der Akademie, Schalter der Verwaltung – dieselbe Kachel-Oberfläche mit Bild, Name, Preis.

## Stand

Heute gibt es vier Innenraum-Systeme nebeneinander: `CafeWalkableInterior` (Lokale, Hotel – am weitesten), `LandmarkWalkableInterior` (reale Orte wie Kirche, Bahnhof), `LegacyBuildingInterior` (Räume als Bilderfolge, Kolonien) und `FacilityInterior` (Zonen mit `InteriorTopologyScene`). Sie teilen Figuren und Porträts, sonst wenig.

## Vorschlag

1. Gastronomie zieht aus `CafeWalkableInterior` den allgemeinen Teil als `WalkableInterior` heraus: Bewegung, Sitzen, Wege, Personenwahl, rechte Tafel, Gespräch, Bedienplatz, Angebotskacheln. Das Lokal wird die erste Einrichtung dieses Bauteils – Verhalten unverändert.
2. Eine Einrichtung ist ein Datensatz: Vorlage, Möbel, Plätze, Bedienplatz, Stil, Fakten-Lieferanten (Funktionen, die aus Daten Sätze machen), Angebots-Lieferant (Karte, Zimmer, Kurse).
3. Danach wandern die anderen Gebäude Stück für Stück hinein – zuerst die realen Orte aus `LandmarkWalkableInterior`, dann Akademie, Verwaltung, Hafen –, jeweils vom zuständigen Teilprojekt mit seinem Wissen und Angebot.

## Abgrenzung

Gastronomie baut Schritt 1 und 2 und hält das Lokal dabei spielbar. Schritt 3 liegt bei den Teilprojekten der jeweiligen Gebäude (Innenräume, Bevölkerung und Ökonomie, Erde).
