# NOXIA Visual Bible

## Ziel

NOXIA soll als wissenschaftsorientierte Aufbau-, Wirtschafts- und Forschungssimulation visuell wie ein echtes Spiel-HUD wirken, nicht wie eine Webseite mit eingebettetem Grid. Die Kolonie ist der Hauptdarsteller; Navigation, Ressourcen, Forschung, Logistik und Bewohner liegen als kontextuelle HUD-Schichten darum.

## Verbindliche UI-Leitlinie

NOXIA besitzt **eine gemeinsame Benutzeroberfläche und Interaktionssprache** für Erde, Mond, Mars, Phobos, Deimos, Stationen und spätere Welten. Dasselbe Prinzip gilt für Rover, Fahrzeuge, Shuttles und Raumschiffe.

Der unterschiedliche Charakter entsteht aus Umgebung, Terrain, Beleuchtung, Gebäuden, Infrastruktur, Fahrzeugen, Assets und verfügbaren Funktionen — nicht aus jeweils neu erfundenen Dashboard-Themes.

Eine Funktion wie Robotik, Wissenschaft, Mining, Logistik oder Navigation ist eine NOXIA-Capability. Ist sie im aktuellen Kontext vorhanden, erscheint das gemeinsame Modul mit lokalen Daten und Aktionen. Ist sie nicht vorhanden, wird sie nicht eingeblendet.

Verbindliche Architekturentscheidung: `docs/decisions/ADR-unified-contextual-dashboard.md`.

## Bildsprache

- Near-Future statt Fantasy-Sci-Fi.
- Funktionale, reparierbare Technik: Paneele, Rohrleitungen, Kabelkanäle, Wartungsstege, Tanks, Antennen, Schleusen, Serviceflächen.
- Helle technische Materialien mit dunklen Strukturteilen; Umgebung prägt Verschmutzung und Patina.
- Mars: oxidrote Staubablagerung, trockene Regolithflächen, harte Schatten, geringe Vegetation nur in geschützten Habitaten.
- Mond: sehr kontrastreich, grauer Regolith, schwarze Schatten, keine atmosphärische Dunstwirkung.
- Erde: sauberer, grüner, etablierter; stärker institutionell und zivil.
- Phobos: rau, kleinräumig, felsig, provisorischer Charakter.
- Stationen: modular, kompakt, druckbeaufschlagt, sichtbare technische Infrastruktur.

Diese Unterschiede gelten für **Welt und Assets**, nicht für eine body-spezifische Neugestaltung der globalen NOXIA-Shell.

## Isometrische Außenassets

- Transparenter Hintergrund.
- Einheitliche 3/4-Isometrie.
- Bodenanker standardmäßig bei `[0.5, 0.82]`.
- Das Asset selbst enthält keine UI und keinen Text.
- Schatten dürfen Bestandteil des Assets sein, müssen aber weich und konsistent bleiben.
- Größenrelationen folgen dem kanonischen Footprint, nicht dem Bildmotiv.

## Gebäudevarianten

Ein kanonisches Gebäude kann mehrere Darstellungen besitzen:

- `exterior-isometric`
- `exterior-detail`
- `construction-foundation`
- `construction-frame`
- `construction-systems`
- `construction-commissioning`
- `interior-entry`
- `interior-main`

Die Simulation bleibt unabhängig von der Darstellung.

## Innenräume

Innenräume sind Orte derselben Welt, keine unabhängigen Illustrationen. Außenbau, Luftschleuse, Hauptraum und Spezialräume müssen dieselbe Material- und Formensprache teilen. Bevorzugtes Format für Raumansichten: 16:9 oder 3:2. Wiederkehrende technische Elemente wie Türen, Paneele, Leuchten, Möbel und Terminals werden als Props wiederverwendet.

## NPCs

NPC-Identität und visuelles Profil bleiben getrennt. Ein NPC kann Portrait, Full-Body-Darstellung und Sprite-Animationen besitzen. Portraits verwenden konsistente Brustbild-Kadrierung und Lichtführung. Bewegungen werden bevorzugt als kontrollierte Sprite-Strips oder CSS/Canvas-Animationen umgesetzt statt als frei generiertes GIF.

## Animation

Geeignet für kurze Loops:

- Statusleuchten
- Ventilatoren
- Pumpen
- Bohrköpfe
- Fördertechnik
- Türen
- Rover
- Drohnen
- NPC Idle/Walk/Work

Technisches Zielformat ist bevorzugt Sprite-Strip/WebP oder APNG. GIF bleibt Fallback für externe Vorschau, nicht Primärformat im Spiel.

## HUD

- Koloniefläche maximieren.
- Globales Dashboard-Look-and-feel bleibt auf allen Himmelskörpern identisch.
- Topbar, Cockpit, Kartenwerkzeuge, Tooltip-/Inspector-Stil, Eigentumsfarben und Overlay-Konventionen sind gemeinsame UI-Bausteine.
- Ressourcen als kompakte Leiste direkt über der Welt.
- Rechte Seite als kontextabhängiger Inspector statt statischer Dauerleiste.
- Planen & Bauen als expliziter Modus/Drawer.
- Innenraum, Bewohner, Baufortschritt und Wartung als kontextuelle Ansichten.
- Primäre Weltaktionen bleiben immer sichtbar, sekundäre Informationen werden eingeklappt.
- Capability-Module werden nur angezeigt, wenn sie im aktuellen Standort/Fahrzeug tatsächlich verfügbar sind.
- Keine eigene Moon-, Mars-, Earth-, Phobos- oder Vehicle-Dashboard-Farbsprache ohne explizite Architekturentscheidung.

## Fahrzeuge und Raumschiffe

Auch Fahrzeuge erhalten keine jeweils eigenständig erfundene Dashboard-Familie. Ein Rover, Zug, Flugzeug, Shuttle oder Raumschiff nutzt dieselben NOXIA-Interaktionsmuster und setzt seine Ansicht aus vorhandenen Fähigkeiten zusammen.

Unterschiede dürfen sichtbar werden durch:

- Fahrzeug-/Schiffssilhouette und Schemata
- reale Instrumentdaten
- installierte Module
- verfügbare Steuer- und Betriebsfunktionen
- Betriebsumgebung und Missionskontext

Nicht durch willkürlich wechselnde globale Navigation, Tooltip-Logik, Statusfarben oder Panel-Geometrie.

## Asset Governance

Kanonische Spielobjekte bleiben über ihre `entityId` definiert. Bilddateien definieren weder neue Entitäten noch neue systemübergreifende IDs. Systemübergreifendes Wissen und Mappings werden nicht lokal erfunden; fehlende Daten gehen über den vorgesehenen Knowledge-Graph-Request-Workflow.
