---
id: REQ-NOXIA-20261028-RESONANCE-PLACE-BUILDABLE
title: Resonanzplatz als baubares Gebäude – zuerst Tharsis Hub
status: open
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
- Teodor Varga (`mars-tharsis-omnizedent-001`) lebt im Tharsis Hub. Er arbeitet als Techniker an der Wasseraufbereitung und ist Omnizedent aus Überzeugung, hat aber noch keinen Resonanzplatz.

# Erbeten

1. `resonance_place` als baubaren Gebäudetyp aufnehmen: Baukosten und Material nach NOXIA-MAT-0001, kleiner Grundriss, kein Personalbedarf (Resonanzbegleitung ist freiwillig und ohne Lohnsatz).
2. Erster Bau im Tharsis Hub über den normalen Bauweg, nicht per Seed. Finanzierung aus echten Mitteln, z. B. einem Gemeinschaftsakteur oder dem öffentlichen Budget, keine Geldschöpfung (Spielökonomie-Regel).
3. Danach kann NPC-RELIGION-0002 die Resonanzrunde auf Tharsis an diesen Ort hängen. Dafür muss `realPlaceActivity` neben `region_feature_id` auch `tile_entity_id` als Ort kennen.

# Nicht Teil dieser Anfrage

Keine Theologie im Gebäude, keine Sonderwirkung auf Spielraum oder Stimmung. Der Ort bietet nur Raum für Gespräch, Lesen und Stille.
