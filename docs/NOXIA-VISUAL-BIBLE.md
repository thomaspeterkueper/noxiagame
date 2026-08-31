# NOXIA Visual Bible

## Ziel

NOXIA soll als wissenschaftsorientierte Aufbau-, Wirtschafts- und Forschungssimulation visuell wie ein echtes Spiel-HUD wirken, nicht wie eine Webseite mit eingebettetem Grid. Die Kolonie ist der Hauptdarsteller; Navigation, Ressourcen, Forschung, Logistik und Bewohner liegen als kontextuelle HUD-Schichten darum.

## Bildsprache

- Near-Future statt Fantasy-Sci-Fi.
- Funktionale, reparierbare Technik: Paneele, Rohrleitungen, Kabelkanäle, Wartungsstege, Tanks, Antennen, Schleusen, Serviceflächen.
- Helle technische Materialien mit dunklen Strukturteilen; Umgebung prägt Verschmutzung und Patina.
- Mars: oxidrote Staubablagerung, trockene Regolithflächen, harte Schatten, geringe Vegetation nur in geschützten Habitaten.
- Mond: sehr kontrastreich, grauer Regolith, schwarze Schatten, keine atmosphärische Dunstwirkung.
- Erde: sauberer, grüner, etablierter; stärker institutionell und zivil.
- Phobos: rau, kleinräumig, felsig, provisorischer Charakter.
- Stationen: modular, kompakt, druckbeaufschlagt, sichtbare technische Infrastruktur.

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
- Ressourcen als kompakte Leiste direkt über der Welt.
- Rechte Seite als kontextabhängiger Inspector statt statischer Dauerleiste.
- Planen & Bauen als expliziter Modus/Drawer.
- Innenraum, Bewohner, Baufortschritt und Wartung als kontextuelle Ansichten.
- Primäre Weltaktionen bleiben immer sichtbar, sekundäre Informationen werden eingeklappt.

## Asset Governance

Kanonische Spielobjekte bleiben über ihre `entityId` definiert. Bilddateien definieren weder neue Entitäten noch neue systemübergreifende IDs. Systemübergreifendes Wissen und Mappings werden nicht lokal erfunden; fehlende Daten gehen über den vorgesehenen Knowledge-Graph-Request-Workflow.
