# NOXIA-EARTH-0003 — Persistente Geografie und autonome Ortsentwicklung

Status: vorgeschlagene Architekturentscheidung (Implementierung separat)
Datum: 2026-10-29
Bereiche: Earth (Geodaten), Core (Weltzustand/Ticks), Interiors (Gebäudedetail)

## Entscheidung
Eine reale Region wird nach erfolgreichem, qualitätsgeprüftem Import **einmal** als versionierte, persistierte Basiskarte abgelegt. Danach ist die lokale NOXIA-Simulation die Autorität für den fortgeschriebenen Weltzustand. Kartenaufrufe lesen primär lokale persistierte Daten und lösen keinen synchronen externen Geodatenimport aus. Neue Regionen werden über einen getrennten Importjob erschlossen; optionale spätere Aktualisierungen sind bewusst freigegebene, überprüfbare Quellenupdates, niemals stille Überschreibungen.

## Drei getrennte Datenebenen
1. `base_geography`: Herkunft, Lizenz, Importzeit, WGS84-Identität, Quell-Feature-ID, normalisierte Geometrie, Prüfsumme, Vollständigkeitsgrad, unveränderliche Snapshot-Version.
2. `world_state`: Spielgebäude, Eigentum, Ressourcen, Straßenbau, Abrisse, NPC-/Spieleraktionen, Ökologie und Tick-Ereignisse. Nur Simulation/autorisiert ausgeführte Aktionen mutieren diese Ebene.
3. `projection`: für Karte/Walkable/Innenräume abgeleitete Darstellung der beiden Ebenen. Kein eigener persistierter konkurrierender Weltzustand.

Zunächst vorhandene Tabellen `celestial_regions` und `region_features` auf Wiederverwendung, bestehende Referenzen und Migrationsrisiken prüfen. Keine parallelen Datensilos schaffen.

## Import und Quellenfusion
- Für neue Orte: Registrieren → Region/Grid-Kacheln planen → mehrstufige Geodatenquellen laden → normalisieren/deduplizieren → Lizenz und Provenienz pro Objekt → Qualitätsprüfung → atomare Publikation des Snapshots.
- Quellen nach räumlicher Genauigkeit, Zeitstempel, Lizenz, Aktualität und Verlässlichkeit bewerten; Widersprüche sichtbar lassen statt ungeprüft zu mischen.
- Mehrere Quellen (z. B. OSM, amtliche offene Geodaten, geeignete Höhenmodelle) nur im Rahmen kompatibler Nutzungsbedingungen kombinieren.
- Bei unvollständigem Import einen explizit partiellen Snapshot mit Qualitätsstatus erzeugen; keine falsche Vollständigkeit vorspiegeln.
- Große Orte und Metropolen kachelweise und resumierbar importieren; idempotente Jobs, Backoff, Rate Limits, Wiederaufnahme nach Ausfall, deduplizierte Jobs.
- Importdauer nicht in den synchronen HTTP-Request legen. Job-Status und abgeschlossene Kacheln anzeigen; HTTP 504 darf keine Datenintegrität gefährden.
- Snapshot nach Publikation nicht mehr in place überschreiben; Refresh erzeugt neue Kandidatenversion und einen reviewbaren Delta-Plan.

## Autonome Entwicklung
- Ab Import bestimmen NOXIA-Ticks, Spieler, NPCs und simulierte Umweltprozesse die Entwicklung.
- Zerstörte Bauwerke bleiben zerstört, neue Bauwerke entstehen im Weltzustand, Straßen können geändert werden; Geodaten-Refresh darf Änderungen nicht zurückrollen.
- Ereignis-/Änderungsjournal mit Ereignis-ID, Simulationszeit, Auslöser, Betroffenen, Vorher/Nachher und Kausalbezug.
- Historische Spielzustände und Zeitreisen lesen vergangene Snapshots/Events; sie verändern nicht den aktuellen Zustand.
- Regionen ohne aktive Spieler können serverseitig in größeren Zeitschritten fortgeschrieben werden; deterministische Replays/Tests soweit möglich.

## Qualität und Sicherheit
- Verschiedene Ortsslugs dürfen niemals die gleiche Spielerposition oder alten UI-Labels unbeabsichtigt übernehmen (Vuiteboeuf/El Haouaria Regression).
- Ein importierter Ort gilt nur dann als `ready`, wenn Quellzuordnung, geografische Plausibilität, Region-Features und Commit konsistent sind.
- Altbekannte Karten bleiben bei Quellen-Ausfall verfügbar; kein HTTP-Request an Overpass auf jedem Kartenaufruf.
- Monitoring: Snapshot-Alter, Abdeckung, Importdauer, ausstehende Jobs, Fehler, Quellen und Lizenzhinweise.
- Kein direktes Schreiben in Produktionsdaten ohne Freigabe und Migrations-/Rollbackplan.

## Lizenzen
- OSM-Attribution und ODbL-Bedingungen beachten; Lizenz- und Provenienzmetadaten bis in die Karten-UI und eventuelle exportierte Daten erhalten.
- Abgeleitete OSM-Datenbanken und unabhängige Spielwelt-Daten logisch getrennt halten; Vermischung/Weitergabe juristisch überprüfen.
- Referenzen: https://osmfoundation.org/wiki/Attribution_Guidelines ; https://osmfoundation.org/wiki/Licence_and_Legal_FAQ

## Erste Umsetzungswelle / Definition of Done
1. Ist-Architektur: DB-Schema, Materializer, Trigger, Map-API, Geocoder und vorhandene Jobs prüfen.
2. Snapshot-/Statusvertrag und sichere schrittweise Migration mit Rückweg definieren.
3. Import als asynchronen Job mit Test-Kachel starten; bestehende Snapshots priorisieren.
4. Kartenabruf konsequent aus Snapshot + Weltzustand; externer Import nur bei nicht registrierten Orten und explizitem Importauftrag.
5. Test Vuiteboeuf: Nach erfolgreichem Import ohne externen Dienst laden; NPC-Abriss bleibt nach Reload und Quellenupdate erhalten; Ortslabels und Koordinaten bleiben korrekt.
6. Skalierungs- und Lizenztests für weitere Orte dokumentieren.

Kein Anspruch, dass diese Architektur mit diesem Dokument bereits implementiert ist.
