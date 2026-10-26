# NOXIA-INTERIOR-0001 – Ein Bedienmodell für alle Gebäude

Status: accepted; Schritte 1 und 2 umgesetzt am 26.10.2026 (`app/interiors/WalkableInterior.tsx`, Einrichtung = `InteriorFitting`; das Lokal ist die erste Einrichtung in `app/earth/CafeWalkableInterior.tsx`)
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

## Umsetzung (26.10.2026)

`app/interiors/WalkableInterior.tsx` ist der Motor: Bewegung, Hinsetzen, Wege, Personen mit Kurzname und Porträt, Gespräch über `/api/game/npc-conversation`, Begrüßung am Bedienplatz, Besucher, die kommen und gehen, Bedienung am Tisch, Dinge im Raum (beim Spieler, bei einer Person, gebracht), rechte Tafel, geschlossen-Tafel, Stil für Boden, Wand, Fenster, Pflanzen, Teppich, Licht.

Eine Einrichtung (`InteriorFitting`) liefert: `kind` (Stilklasse), `layout` (Grundriss aus `lib/game/hospitality/venues.ts`), Namen, `service(figures)`, `closedText(figures)`, `furnitureLabel`, Dekor, Tresenaufbau, `visits` (Besucher aus echten Daten), `facts(self, ctx)`, `placeKnowledge`, `hearsay(self)`, `introduction(self)`, `things` (Bestelltes), `renderOffer(ctx)` (Karte, Zimmer, später Kurse und Schalter), `goToServiceLabel`, `greetsAtService`, `tableService`. Der Motor meldet seinen Augenblick (`InteriorContext`: Position, Platz, am Tisch, am Bedienplatz, gewählte Person, Figuren) an die Einrichtung zurück.

So baut man ein weiteres Gebäude ein: Grundriss als `VenueLayout` (Möbel, Plätze, Bedienplatz, Sichtbereiche aus der Innenraum-Vorlage), eine Stilklasse mit Farben in der CSS des Motors, eine Einrichtung mit eigenem Wissen und Angebot – etwa 150 Zeilen, kein Motor-Code. Verhalten des Lokals unverändert, im Browser geprüft.

## Zweite Einrichtung: Akademie (26.10.2026)

`app/earth/AcademyWalkableInterior.tsx` mit Grundriss und Wissen in `lib/game/academy/academyInterior.ts`: Lernraum mit sechs Doppelpulten, Tafel, Rednerpult, Sekretariat als Bedienplatz, Lehrbereich dahinter. Personal sind die Personen mit Arbeitszuweisung am Gebäude; am Sekretariat begrüßt es zuerst und kennt die echten Lernmodule (`/api/ssf/modules`: Anzahl, Beispiele, Fachgebiete) – nicht mehr. Das Angebot sind die Module als Kacheln; „Lernraum öffnen“ legt das bestehende `SchoolOverlay` darüber, dort wird gelernt und geprüft wie bisher. Eintritt: `EarthBuildingAccessLayer`, Art `academy`. Grundfakten für jedes Gebäude: `lib/game/interiors/baseFacts.ts`. Aufwand: ein Grundriss (60 Zeilen), eine Einrichtung (90 Zeilen), eine Stilklasse. Offen: `learn`, `teach`, `research`, `practice` fehlen im `INTERIOR_CAPABILITY_REGISTRY` (Vorlage der Akademie), zuständig Innenräume.

## Dritte Einrichtung: Verwaltung (26.10.2026)

`app/earth/AdminWalkableInterior.tsx`, Grundriss und Wissen in `lib/game/administration/adminInterior.ts`: Foyer mit Schalter (zwei Plätze), Wartebank, Aushang, Besprechungstisch; Büros dahinter (eine dritte Kraft arbeitet dort unsichtbar). Das Personal kennt die öffentlichen Zahlen des Ortes aus `/api/game/admin` – Einwohner, Gouverneur, Steuersätze – und ob der Spieler hier gemeldet ist; über Konten und Käufe anderer weiß es nichts. Der Aushang zeigt dieselben Zahlen; „Schalter öffnen“ legt die bestehende Rathaus-Tafel (`AdminOverlay`: Heimatort, Steuern, Kasse) darüber. Eintritt: Art `administration`.
