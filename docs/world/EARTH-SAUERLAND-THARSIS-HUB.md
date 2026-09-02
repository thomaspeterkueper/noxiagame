# EARTH START — THARSIS HUB SAUERLAND

**Status:** kanonisch  
**Stand:** 02.09.2026  
**Geltung:** NOXIA Earth-Start, Weltkarte, Visuals, Seed-Daten und spätere Runtime-Logik

## Grundentscheidung

Der Spielstart auf der Erde ist nicht länger ein generischer Earth-/LEO-Terminal. Der gemeinsame Startpunkt ist realweltlich im **Sauerland, Nordrhein-Westfalen, Deutschland** verankert und heißt **Tharsis Hub Sauerland**.

Als regionale Referenz gilt **Sundern (Sauerland)**. Die exakte Parzelle beziehungsweise exakten Koordinaten sind noch nicht kanonisiert. Deshalb darf die Spielkarte nicht behaupten, einen realen Katasterausschnitt metergetreu zu reproduzieren. Sie ist eine verdichtete, topografisch plausible Sauerland-Repräsentation.

## Was auf der Karte sofort lesbar sein muss

Der Standort soll auch ohne Beschriftung als Erde und möglichst als mitteleuropäischer Mittelgebirgsraum lesbar sein. Dafür braucht die Karte gleichzeitig:

- bewaldete Höhenzüge und dichte Waldinseln,
- offene Wiesen- und Landwirtschaftsflächen,
- einen Talzug mit Bach oder kleinem Fluss,
- kleinteilige zivile Bebauung beziehungsweise einen Siedlungsrand,
- normale Straßen, Nutzfahrzeuge, Leitungen und bestehende Infrastruktur,
- den technisch deutlich weiterentwickelten Tharsis Hub als eingebetteten Fremdkörper, nicht als isolierte Science-Fiction-Basis.

Die zentrale Bildidee lautet: **Raumfahrt-Infrastruktur ist in eine bewohnte, gewachsene Landschaft hineingebaut worden.**

## Maßstab und Abstraktion

Die Runtime bleibt bei **32 × 24 Tiles**. Ein Tile ist keine feste Anzahl realer Meter. Straßen, Wald, Talzug, Siedlung und Hub werden zugunsten von Spielbarkeit und Lesbarkeit verdichtet.

Das reale Sauerland ist der geografische Anker. Die konkrete Karte ist eine spielerische Modellfläche. Damit können später reale Namen, Landschaftsformen oder Verkehrsbezüge ergänzt werden, ohne dass die heutige Karte einen falschen Anspruch auf exakte Geografie erhebt.

## Tharsis Hub

Der Hub liegt im südöstlichen Kartenbereich auf vorbereiteten Hardstand-/Betonflächen. Er besteht aus realen, belegenden Modulen und ist kein einzelnes Gebäudesprite.

Initial vorhanden:

- Spaceport Core,
- zwei Standard-Pads,
- ein Mini-Pad,
- Service-Modul,
- Spaceport Storage,
- öffentliche Verwaltung,
- Akademie,
- Warenlager plus Lagererweiterung.

Schiffe sind eigenständige Entities und gehören nicht dauerhaft in Pad-Grafiken. Die Pads bleiben Infrastruktur. Parkkapazität und aktive Start-/Landeoperationen bleiben getrennte Größen.

## Visuelle Identität Sauerland

Die Earth-Visuals bleiben heller und ziviler als Mars oder Mond. Der Sauerland-Standort benötigt zusätzlich eine eigene Material- und Landschaftssprache:

- sattes, aber nicht tropisches Grün,
- Fichten-/Mischwaldwirkung statt generischer Parkbäume,
- Wiesen, Böschungen, feuchte Bachränder,
- dunkler Asphalt mit Reparaturflicken und Entwässerung,
- Leitplanken, kleine Brücken, Bushaltestellen, Strom-/Telekommunikationsmasten,
- funktionale Gewerbe- und Lagerbauten,
- normale Wohnhäuser im Siedlungsrand,
- Hub-Gebäude mit Glas, hellem Beton/Verbundwerkstoffen, Metall, Servicezugängen und sichtbarer Wartbarkeit.

Branding bleibt sparsam. Sichtbares `noχ1ᐃ` ist auf ausgewählten staatlichen Hub-Gebäuden zulässig. Wohnhäuser, Landschaft, normale Fahrzeuge, Straßen und Standardcontainer bleiben unmarkiert.

## Benötigte Asset-Gruppen

### Bereits grundsätzlich vorhanden

- Grass-/Dirt-/Forest-/Farmland-/City-/Concrete-Tiles,
- Road-Bitmask 0–15,
- öffentliche Hub-Gebäude und Spaceport-Module,
- erste zivile Fahrzeuge, Servicefahrzeuge und getrennte Schiffe.

### Sauerland-spezifisch noch zu produzieren

- bewaldete Hang-/Höhen-Tiles,
- Waldrandvarianten mit Höhenwirkung,
- Bach-/Flussufer und kleine Brücke,
- Wiesen-/Böschungsübergänge,
- zwei bis drei regionale Wohnhausvarianten,
- kleines Gewerbe-/Werkstattgebäude,
- Leitplanke,
- Bushaltestelle,
- Strom-/Versorgungsmast,
- unbeschriftete Wegweiser-/Schildträger,
- Straßenrandbäume und Hecken,
- zusätzliche parkende zivile Fahrzeuge.

## Spielmechanische Konsequenzen

Der Earth-Start ist kein leerer Bauplanet. Fläche hat bereits eine Nutzung. Wald, Siedlungsanschluss, Landwirtschaft, Talraum und Infrastruktur erzeugen echte räumliche Einschränkungen. Das soll später in Landwert, Genehmigung, Eigentum/Nutzung, Ausbaukosten und Konflikte um Flächen einfließen.

Öffentliche Startinfrastruktur ist gemeinsam nutzbar. Spieler starten im selben realen Earth-Hub, nicht mit jeweils einem privaten Duplikat desselben Raumhafens.

## Datenquellen im Repro

- `lib/game/seeds/earthStartSeed.ts` — Startanlagen und Modulpositionen
- `lib/game/locations/sauerlandTharsisHub.ts` — Standortidentität, Zonen, Landmarken, Asset-Bedarf
- `lib/grid/locationMaps.ts` — verdichteter Terrain-Layer
- `lib/assets/catalog.ts` — Gebäudevisuals
- `lib/assets/vehicleCatalog.ts` — bewegliche Fahrzeuge und Schiffe
- `docs/visual/NOXIA-VISUAL-BIBLE.md` — globale Perspektive, Licht, Stil und technische Visualregeln

## Noch bewusst offen

Nicht festgelegt sind derzeit die exakten GPS-Koordinaten beziehungsweise das konkrete Grundstück des Tharsis Hub. Solange diese Entscheidung fehlt, wird in Daten und UI nur die regionale Verankerung **Sauerland / Sundern (Sauerland)** behauptet.
