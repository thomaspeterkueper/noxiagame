# NOXIA Spatial World Model

## Ziel

Das bisherige 32×24-Raster ist kein Weltkoordinatensystem mehr. Die kanonische Position von Objekten wird in lokalen Metern gespeichert. Ein Raster darf weiterhin als lokale Spielmechanik eingesetzt werden, z. B. innerhalb eines Gebäudes, Campus oder Raumhafens.

## Drei Datenschichten

1. **Observed** — reale Mess-/Kartendaten, soweit vorhanden: Topographie, Koordinaten, Gewässer, Krater, Geologie usw.
2. **Derived** — aus Observed-Daten berechnete Spiellayer: Gefälle, Hydrologie, Befahrbarkeit, Baugrundqualität, Einstrahlung, Routenpotenzial.
3. **Simulated** — NOXIA-Zustand: Gebäude, Infrastruktur, Fahrzeuge, Waren, Spieleraktionen, zukünftige Landschaftsänderungen.

Observed wird nicht durch simulierte Daten überschrieben. Die Simulation referenziert die reale/planetare Grundlage.

## Koordinaten

Jeder Standort besitzt einen `location_spatial_frames`-Datensatz. Erde, Mond und Mars können dabei einen realen planetaren Ursprung besitzen; innerhalb des Standortes arbeitet NOXIA mit lokalen Metern:

- `x_m`: lokal Ost/West
- `y_m`: lokal Nord/Süd
- `z_m`: Höhe relativ zum Standortbezug
- `rotation_deg`: Ausrichtung

`tile_row` / `tile_col` bleiben vorerst als Legacy-Kompatibilität erhalten, sind aber nicht mehr Source of Truth.

## Bauflächen

`build_sites` modelliert kontinuierliche Bauflächen: Grundstück, Campus, Distrikt, Innenbereich, Pad oder Untergrundbereich. Ein Site kann einen Polygon-Footprint besitzen.

Optional darf ein Site ein lokales `build_grid` definieren. Dieses Raster existiert ausschließlich innerhalb des Sites und wird in Meterkoordinaten aufgelöst.

## Gebäude und Erweiterungen

Ein Weltgebäude besitzt Position + Footprint. Erweiterungen nutzen die bereits vorhandene kanonische Relation `tile_entities.parent_id + slot` bzw. `player_builds.parent_id + slot`.

Damit gilt:

`Standort → Site → Hauptgebäude → Erweiterungen/Module`

Eine Erweiterung verbraucht kein neues Weltfeld. Sie ist ein adressierbares Kindobjekt des konkreten Hauptgebäudes.

## Prozedurale Welt

NOXIA generiert eine kanonische Welt deterministisch aus `canonical_seed`. Für Erde, Mond und Mars soll der Seed reale Daten nicht ersetzen, sondern die Ableitung und Ergänzung reproduzierbar machen.

Pipeline:

`Observed data → spatial frame → derived terrain/hydrology/buildability → sites/infrastructure → simulated objects`

Renderer sind Projektionen dieses Modells und dürfen keine eigene Weltgeometrie erfinden.
