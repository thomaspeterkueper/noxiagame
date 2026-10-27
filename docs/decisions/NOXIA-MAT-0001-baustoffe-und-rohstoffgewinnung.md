# NOXIA-MAT-0001 – Bauen verbraucht Material; Rohstoffe kommen aus dem Land

Status: accepted (Richtung: Thomas, 28.10.2026 – „richtiger Verbrauch, das ist auch für die Welt jenseits der Erde wichtig und macht alles realistischer“); Parameter vorläufig, Umsetzung offen
Datum: 2026-10-28
Bezug: NOXIA-FOOD-0002 (Lebensmittelkette, Verfahren mit Eingängen), NOXIA-ECON-0001 (Frontier-Prinzip), NOXIA-PHYSICS-0001 (Kausalität), NOXIA-ENERGY-0001 (Einheiten), `docs/core/RESOURCE_INVENTORY_ECONOMY_MAP.md`, Flurstücke der Weltkarte (`docs/workstreams/world-map.md`)

## Ausgangslage

- Ein Gebäude kostet heute nur Credits (`building_definitions.cost_credits`); das Geld verschwindet, kein Material wird verbraucht.
- Das Spiel kennt sechs Güter: Wasser, Energie, Metall, Bauteile, Forschungsproben, Grundnahrung (`resource_type`). Holz, Stein, Sand, Zement, Tiere gibt es nicht.
- Rohstoffe erzeugt auf der Erde nur die allgemeine Mine (Metall). Getreide ist als Fachmodell gerechnet (NOXIA-FOOD-0002), aber nicht live.
- Gebäude erzeugen heute auch ohne Eingänge (Request `20261027-0930-core-to-core-production-input-gating.md`).

## Entscheidung

1. **Bauen verbraucht Material.** Jeder Bautyp hat eine Stückliste (Baustoffe je Gebäude bzw. je m² Geschossfläche) und Arbeit. Credits bezahlen Arbeit und zugekauftes Material, nicht das Gebäude „aus dem Nichts“.
2. **Material liegt irgendwo.** Es kommt aus dem eigenen Lager, wird vom Markt gekauft (NPC-Händler, andere Spieler) oder fehlt – dann wartet die Baustelle, und der Engpass wird benannt (wie bei der Lebensmittelkette). Material muss zur Baustelle gebracht werden; Transport ist Lieferzeit, keine Teleportation.
3. **Rohstoffe kommen aus dem Land, das man besitzt.** Was auf einem Flurstück möglich ist, bestimmt seine reale Nutzung (Kataster, OpenStreetMap). Andere Himmelskörper nutzen dieselben Verfahren mit ihren Umgebungen (Regolith statt Lehm, Habitat statt Feld).
4. **Ein Katalog, viele Orte.** Güter und Verfahren sind ortsunabhängig, wie in NOXIA-FOOD-0002: jedes Verfahren nennt Umgebungen (`earth_forest`, `earth_field`, `earth_grassland`, `earth_quarry`, `regolith`, `habitat`, `industry`), Eingänge, Ausgänge, Dauer, Arbeit, Energie.
5. **Übergang ohne Stillstand.** Solange Märkte und Ketten nicht stehen, kauft die Baustelle fehlendes Material automatisch zum Marktpreis von einem staatlichen bzw. NPC-Lieferanten (transparent ausgewiesen). Wer selbst produziert, baut billiger und unabhängiger.

## Güter (neu, vorläufig)

| Gut | Einheit | Herkunft | Verwendung |
|---|---|---|---|
| Rundholz | m³ | Wald (Holzeinschlag) | Sägewerk, Brennholz, Papier |
| Schnittholz | m³ | Sägewerk | Dachstuhl, Holzbau, Möbel |
| Bruchstein | t | Steinbruch | Schotter, Mauerwerk |
| Schotter / Kies | t | Brecher, Kiesgrube | Beton, Straßen, Gleisbett |
| Sand | t | Sandgrube, Brecher | Beton, Mörtel, Glas |
| Kalkstein / Zement | t | Steinbruch → Zementwerk (Energie!) | Beton, Mörtel |
| Beton | t | Mischwerk (Zement, Kies, Sand, Wasser) | Fundament, Massivbau |
| Ziegel | Stück bzw. t | Ziegelei (Lehm, Energie) | Mauerwerk |
| Stahl | t | bestehendes Metall → Stahlwerk | Hallen, Bewehrung |
| Getreide, Mehl, … | kg | NOXIA-FOOD-0002 | Ernährung, Futter |
| Milch, Fleisch | kg | Tierhaltung | Ernährung |
| Tiere (Rinder, Schweine, Hühner, Schafe) | Stück | Zucht | Bestand, nicht als Ware „aus dem Nichts“ |

## Verfahren (vorläufige Größenordnungen, durch den Knowledge Graph zu bestätigen)

| Verfahren | Umgebung | Eingang | Ausgang | Hinweise |
|---|---|---|---|---|
| Holzeinschlag nachhaltig, 1 ha/Jahr | Wald | Arbeit, Diesel/Energie | ≈ 10 m³ Rundholz (Zuwachs) | Vorrat bleibt; Nachhaltigkeit als Regel |
| Kahlschlag, 1 ha | Wald | Arbeit, Energie | Vorrat des Bestands (oft 250–400 m³) | Pflicht zur Wiederaufforstung; Fläche trägt Jahrzehnte nichts; Umwandlung in Acker braucht Genehmigung |
| Sägen | Industrie | 1 m³ Rundholz, Energie | ≈ 0,6 m³ Schnittholz + Restholz | Restholz → Brennstoff/Spanplatten |
| Getreideanbau, 1 ha | Feld | Saatgut, Energie, Arbeit | ≈ 7,5 t Weizen (Juli–August) | aus NOXIA-FOOD-0002 |
| Weide/Stall, Rinder | Grünland, Stall | Futter (Gras, Getreide), Wasser | Milch, Kälber, Fleisch | Tiere leben, altern, brauchen Pflege; Grünland trägt nur begrenzt viele Tiere |
| Gesteinsabbau | Steinbruch | Energie, Sprengstoff, Arbeit | Bruchstein → Schotter | nur an vorhandenen Steinbrüchen (OSM `landuse=quarry`); neuer Steinbruch = Genehmigung, langer, teurer Vorgang |
| Beton mischen | Industrie | Zement, Kies, Sand, Wasser, Energie | Beton | |

## Stückliste je Bautyp (vorläufig, Größenordnung je m² Geschossfläche)

| Bauform | Mineralisch (Beton, Ziegel, Schotter) | Holz | Stahl |
|---|---|---|---|
| Wohnhaus massiv | ≈ 1 t | ≈ 0,05–0,1 m³ (Dachstuhl) | ≈ 30 kg |
| Holzhaus | ≈ 0,3 t (Fundament) | ≈ 0,3 m³ | ≈ 10 kg |
| Halle (Stahlbau) | ≈ 0,5 t (Bodenplatte) | – | ≈ 50 kg |
| Habitat (Mars, Mond) | Regolith gesintert oder Beton aus Regolith | – | Stahl/Aluminium, Bauteile |

Abriss liefert einen Teil zurück (Recycling: Schotter aus Beton, Altholz, Schrott) – Kreislauf statt Senke.

## Bezug zur Weltkarte

- Flurstücksnutzung aus dem Kataster (`earth_parcels.usage`): Wald → Holzeinschlag, Ackerland → Feldbau, Grünland → Weide, Wohnbaufläche → Bauen. Wer Wald kauft, kann Holz schlagen; wer Acker kauft, kann säen.
- Vorhandene Steinbrüche, Sand- und Kiesgruben aus OpenStreetMap sind besondere Flurstücke mit Abbaurecht.
- Nutzungsänderung (Wald roden, Acker bebauen) ist ein Antrag bei der Gemeinde: Zeit, Gebühr, ggf. Auflagen (Ersatzaufforstung). Später entscheidet die Politik des Bezirks.
- Die Karte zeigt den Zustand: geschlagener Wald wird Lichtung, Felder wechseln mit der Jahreszeit, Weiden zeigen Tiere.

## Jenseits der Erde

Dieselben Regeln: Auf dem Mars gibt es kein Holz; Baustoffe sind Regolith (Ziegel, Sinterplatten), Metall aus Bergbau, Bauteile aus der Fabrik, alles mit viel Energie. Was vor Ort nicht entsteht, muss mit Frachtkosten geliefert werden – das macht Orte unterschiedlich teuer und Handel sinnvoll (Frontier-Prinzip).

## Reihenfolge (Vorschlag)

1. Core: Produktion nur mit Eingängen (bestehender Request 0930).
2. Core: neue Güter und Einheiten (Holz, Stein, Sand, Zement, Beton, Ziegel, Stahl) im Inventar; Stücklisten an `building_definitions`.
3. Core: Baustelle verbraucht Material (eigenes Lager, sonst automatischer Zukauf vom Markt mit ausgewiesenem Preis).
4. Weltkarte: Holzeinschlag und Feldbau auf eigenen Flurstücken (Nutzung aus dem Kataster), Steinbruch an OSM-Steinbrüchen.
5. Ökonomie: Märkte und Preise für die neuen Güter; NPC-Betriebe (Sägewerk, Kieswerk, Bauernhof) als Arbeitgeber.
6. Tierhaltung mit lebenden Tieren (Anschluss an NOXIA-LIVING-appearance-clothing-heritage-animals).

## Requests

| Request | Inhalt |
|---|---|
| `coordination/open/20261028-0040-core-to-core-construction-materials.md` | Güter, Stücklisten, Materialverbrauch der Baustelle, Übergang mit Zukauf |
| `coordination/open/20261028-0041-earth-to-core-land-use-primary-production.md` | Verfahren auf Flurstücken (Wald, Acker, Grünland, Steinbruch) als Produktionsquellen |
| `coordination/open/20261028-0042-core-to-kg-material-parameters.md` | Kanonische Werte aus dem Knowledge Graph statt vorläufiger Zahlen |
