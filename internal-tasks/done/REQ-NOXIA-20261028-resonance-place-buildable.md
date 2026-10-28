---
id: REQ-NOXIA-20261028-RESONANCE-PLACE-BUILDABLE
title: Resonanzplatz als baubares Gebäude – zuerst Tharsis Hub
status: done
source: NOXIA-NPC-RELIGION-0002
created: 2026-10-28
priority: normal
affects: [Buildings, Construction, Mars, Population]
---

# Anliegen

Thomas (28.10.2026): Resonanzplätze der Omnizedenz an mindestens einer Marskolonie oder Station. Auf der Erde nutzen sie reale Orte (Sundern: Hubertushalle). Auf dem Mars gibt es keine realen Orte; dort braucht es ein echtes Gebäude.

# Stand

- Innenraum `resonance-place-standard-v1` und Facility-Katalog `resonance_place` existieren.
- `resonance_place` ist aber kein baubarer `tile_entities.entity_id`: keine Baukosten, keine Bauzeit, kein Eintrag im Baukatalog.
- Theodor Grün (`mars-tharsis-omnizedent-001`) lebt im Tharsis Hub. Er arbeitet als Techniker an der Wasseraufbereitung und ist Omnizedent aus Überzeugung, hat aber noch keinen Resonanzplatz.

# Erbeten

1. `resonance_place` als baubaren Gebäudetyp aufnehmen: Baukosten und Material nach NOXIA-MAT-0001, kleiner Grundriss, kein Personalbedarf (Resonanzbegleitung ist freiwillig und ohne Lohnsatz).
2. Erster Bau im Tharsis Hub über den normalen Bauweg, nicht per Seed. Finanzierung aus echten Mitteln, z. B. einem Gemeinschaftsakteur oder dem öffentlichen Budget, keine Geldschöpfung (Spielökonomie-Regel).
3. Danach kann NPC-RELIGION-0002 die Resonanzrunde auf Tharsis an diesen Ort hängen. Dafür muss `realPlaceActivity` neben `region_feature_id` auch `tile_entity_id` als Ort kennen.

# Nicht Teil dieser Anfrage

Keine Theologie im Gebäude, keine Sonderwirkung auf Spielraum oder Stimmung. Der Ort bietet nur Raum für Gespräch, Lesen und Stille.

# Ergebnis (28.10.2026)

Auf Wunsch von Thomas hier gebaut statt bei Core („hier selbst bauen“).

- `resonance_place` ist baubar: `building_definitions` (1500 Cr, 2 Ticks, Migration `20261028143000_resonance_place_buildable.sql`) und `lib/game/buildings/index.ts`; Grundfläche 20 × 16 m (`lib/game/spatial/footprints.ts`). Innenraum und Facility-Katalog bestanden schon.
- Gebaut wird über den normalen Spielerbau (`/api/game/build/spatial`, `player_builds`), bezahlt vom Bauherrn. Kein Seed, keine Geldschöpfung.
- `realPlaceActivity` kennt jetzt neben realen Orten auch gebaute Gebäude (`HostPlace.kind = 'built'`). Steht im Tharsis Hub ein Resonanzplatz, lädt Theodor Grün dort an Tag 6 der Woche um 19 Uhr zur Resonanzrunde ein und geht selbst hin.
- Offen: Noch hat niemand auf Tharsis einen Resonanzplatz gebaut.
