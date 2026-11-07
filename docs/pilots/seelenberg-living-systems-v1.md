# Seelenberg – Living Systems Pilot (Entwurf)

Status: Pilotkonzept, keine Live-Migration / kein Deployment
Stand: 2026-10-27
Ort: Seelenberg, Schmitten im Taunus, Hessen
Anwendungsraum: Erde / globaler WGS84-Raum; lokale metrische Projektion
Grundsatz: **Ein persistierter Weltzustand, mehrere Ansichten.** Keine separate Erde oder zusätzliche Simulations-Source-of-Truth.

## Ziel
An einem überschaubaren realen Ort eine nachvollziehbare Kausalkette von Produktion, Transport, Lager, Versorgung, Nachfrage und Einwohnerreaktion implementieren und deterministisch testen. Es geht um einen Vertical Slice; nicht um vollständige individuelle Simulation aller realen Einwohner.

## Evidenzlage
- Gemeinde Schmitten: Seelenberg 554 Einwohner (Angabe auf Ortsteilstatistik-Seite, Erhebungszeitpunkt vor Import verifizieren), Gemarkungsfläche 341 ha, Höhenlagen 424–614 m.
- OSM: Straßen, Gebäude-Footprints, Landnutzung, Wald, Wege; ODbL-Namensnennung und Attributionspflicht beachten.
- Höhenmodell: vor Import amtliche Quelle, Auflösung und Lizenz festlegen.
Quellen:
- https://www.schmitten.de/leben-wohnen/gemeindeportrait/ortsteile/
- https://www.schmitten.de/leben-wohnen/gemeindeportrait/ortsteile/seelenberg/
- https://www.openstreetmap.org/export
- https://www.geofabrik.de/de/data/download.html

## Spielbereich
- Initiales Datenfenster: ca. 1,5 x 1,5 km um den Ortskern; exakte Grenzen erst mit Geodaten und Projektion bestimmen.
- Unveränderliche Referenzlayer: reale Gebäudeumrisse, Verkehrswege und Gelände (mit Quellversion und Lizenz).
- Separater Simulationslayer: fiktive Nutzung, Ressourcen, Bewohner, Gebäude-Erweiterungen und Ereignisse.
- Fiktive Objekte nie als reale OSM- oder amtliche Tatsachen ausgeben.
- Bestehende Architektur respektieren: Erde = Geodaten; Core = Tick, Persistenz, Inventar; Gebäude = Funktionen; Darstellung = Projektion.

## Minimaler Simulationskern
12 benannte, rein fiktive Test-NPCs mit Haushalt, Bedarf, Arbeitsort, Tagesplan und Inventarbezug; Restbevölkerung nur aggregiert und optional.
Fiktive Einrichtungen: ein Lebensmittelproduzent, ein Depot, ein Lieferfahrzeug, eine Verkaufsstelle und Haushalte. Nicht behaupten, dass diese Nutzungen real existieren.
Kausalpfad: produzieren -> Transportauftrag -> Fahrzeugroute -> Depot-Lager -> Versorgung -> verbrauchter Bestand -> geänderte Nachfrage -> neuer Auftrag.
Nur wirklich verfügbare Gebäude-/Fahrzeugfähigkeiten einschalten. Kein zweites Balancing parallel zum Core.

## Drei deterministische Tests (isoliert, ohne Produktionsdaten)
1. Normalbetrieb: Lagerbestand steigt nur nach verbuchter Lieferung, sinkt bei Verbrauch; keine negative Menge.
2. Straße blockiert oder Fahrt verzögert: Ware bleibt im Transit, Versorgung sinkt; ein Auftrag/eine Warnung wird ausgelöst; keine Teleportation.
3. Zusatznachfrage: Nachfrage steigt; Preis/Auftrag reagiert nach derselben Core-Regel wie die strategische Sicht, ohne widersprüchliche Anzeige.

## Invarianten / Abnahme
- Jeder Gegenstand hat zu jedem Zeitpunkt genau einen Buchungsort: Ursprungslager, Fahrzeug, Ziellager oder verbraucht; Massenbilanz stimmt.
- Ticks sind bei gleicher Eingangslage deterministisch und idempotent.
- Gebäude, NPC und Fahrzeug zeigen in Karte und persönlicher Ansicht denselben persistierten Zustand.
- Geografische Koordinaten stimmen mit realen Quellen überein; Projektion und Snapshot sind dokumentiert.
- Keine personenbezogenen realen Einwohnerdaten aus Adressen ableiten.
- Keine Änderung von globalen Live-Balancingwerten oder Produktionsdaten; erst Sandbox/Featureflag, dann Tests, dann bewusster Rollout.
- 15-Minuten-Regel: Ein Spieler kann eine Lieferung disponieren, eine beobachtbare Folge sehen und eine Rückmeldung erhalten.

## Nächste technische Schritte
1. Earth-Datenpipeline und vorhandene Tabellen/API für Locations, Gebäude, NPCs, Fahrzeuge und Ticks auf aktuelle Implementierung prüfen; ggf. ADR ergänzen.
2. OSM-Snapshot für begrenzten Ausschnitt + lizenzierbares Höhenmodell importieren, Geometrien validieren.
3. Simulationsfixture und isolierte Seed-Routine mit erfundenen NPCs anlegen.
4. Drei reproduzierbare Tests schreiben, lokal/CI ausführen, Tick- und Bilanzlogs vergleichen.
5. Erst danach UI der strategischen/persönlichen Ansicht anbinden und Rolloutentscheidung treffen.

## Nicht-Ziele
- keine 1:1-Biografien realer Einwohner; keine realen Hausbesitzerzuordnung
- keine pauschale Umdeutung vorhandener Gebäude zu Produktionsstätten
- keine autonome Agentenpopulation und keine neuen separaten Wirtschaftssysteme im Pilot
