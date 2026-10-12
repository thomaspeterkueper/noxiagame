# NOXIA-GEO-0001 — Geologische Geschichte, Überdeckung und Beobachtungsbias
Status: PROPOSED — nur Entwurf, keine Änderungen an Laufzeit, Tabellen oder Migrationen
Datum: 2026-10-12; Review: 2027-10-12
Quelle: Nishiyama et al. 2026, https://doi.org/10.1029/2026GL124067
Forschungskontext: https://github.com/thomaspeterkueper/avi-modell/blob/main/docs/research/AVI-OBS-2026-10-12-MERCURY-geological-observation-bias.md

## Ziel
Planetare Simulation soll tatsächliche Geologie, erhaltene Spuren und detektierte Spuren separat modellieren; Kartendaten nicht unmittelbar als gesamte historische Wahrheit behandeln.

## Modell
- latent_world_state: Planet, Zelle, geologische Epoche, Dehnung/Verkürzung, thermischer Entwicklungsstand, Impact-/Vulkanismusereignisse.
- surface_preservation: Rauheitsskala, Material, Regolith, Sediment, Auslöschung/Überdeckung und Erosionsalter.
- observation_layer: Instrument, räumliche Auflösung, Qualität/Unsicherheit, Aufnahmedatum, Entdeckungswahrscheinlichkeit, Evidenz- und Provenienz-IDs.
- observed_features: typisierte erkannte Strukturen inklusive Konfidenz, Quelle, verwendete Modellversion.

Kern: O = Detect(Preserve(Evolution(initial_state, events)), sensor); stochastische Detektion und Fehlpositive berücksichtigen. Von Beobachtungsebene nicht irreversibel auf latente Geschichte zurückschreiben.

## Kostensparender Architekturvorschlag
1. Erstes MVP rein dokumentiert und offline testbar; keine Cronjobs, keine globalen permanenten Hochauflösungsfelder.
2. Grobe, deterministische Planetenzellen mit seed + version; geologische Historie ereignisbasiert, aggregierte Zustände gecacht.
3. Nur beim Betreten/Scannen einer Region fehlende LOD-Daten erzeugen, budgetiertes Job-Queueing und speicherbare Snapshots.
4. Sensor-/Spielerkenntnisse pro Beobachtung versioniert als Deltas ablegen, keine ständige Neuberechnung.
5. Reale Quellen (z.B. MESSENGER und künftig BepiColombo) als priorisierte Basiskarten; prozedurale Rekonstruktion stets als abgeleitet markieren.
6. Für Mars Überdeckung auch durch aeolische/fluviale Prozesse, für Mond Impaktauswurf und Rauheit berücksichtigen; bei fiktiven Planeten Parameterbereiche als Hypothesen kennzeichnen.

## Akzeptanztests
- Ein tektonisches Merkmal kann in latent_state existieren, nach Ejekta jedoch nicht in beobachteter Karte erscheinen.
- Bessere Sensorauflösung kann Beobachtbarkeit erhöhen, ohne historisches Ereignis zu ändern.
- Unverändertes seed+model_version+input erzeugt identischen Snapshot.
- Ein Befund behält Quelle/Unsicherheitsklasse und kann nach neuer Beobachtung revidiert werden.
- Testgrenzen für DB-Requests, CPU/Zeit und Speicher explizit messen, bevor Tick-Integration aktiviert wird.
- Ungeklärte Entstehung vs. Verdeckung bleibt als konkurrierende Hypothese erhalten.

## Integration
Vor Implementierung bestehende NOXIA Planet-/Geodaten-Pipelines, Standort-Snapshots, Cache- und Tick-Architektur prüfen; migrationsfreie Pilotphase bevorzugen. Keine Code- oder Datenbankschema-Änderung durch dieses Dokument.
