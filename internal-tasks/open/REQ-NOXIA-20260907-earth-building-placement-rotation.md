# REQ-NOXIA-20260907 – Earth-Gebäude vor dem Bauen drehen

Status: open  
Repository: noxiagame  
Scope: Earth / Spatial Placement  
Priority: High  
Type: Internal Request

## Ausgangslage

Der aktuelle Earth-Baufluss ist site-first:

1. Stelle auf der Karte wählen.
2. Standort/Gelände prüfen.
3. „Bauen“ öffnen.
4. Gebäude wählen.
5. Der Bauauftrag wird derzeit sofort ausgelöst.

`/api/game/build/spatial` unterstützt `rotationDeg` bereits und persistiert den normalisierten Wert in `rotation_deg`. Die Earth-Karte rendert bestehende und laufende Bauten ebenfalls bereits mit `rotation_deg`. In der UI fehlt aber ein Platzierungs-/Vorschauschritt zwischen Gebäudeauswahl und POST.

## Ziel

Nach der Gebäudeauswahl soll eine Platzierungsvorschau an der bereits gewählten Stelle erscheinen. Der Spieler kann das Gebäude drehen und bestätigt erst danach den Bau.

## UX

- Gebäudeauswahl startet eine Preview statt sofortigem POST.
- Ghost/Footprint plus vorhandenes Map-Asset werden an `selectedSpot` gezeigt.
- Sichtbare Touch-/Maus-Buttons: `↶ 15°` und `↷ 15°`.
- Tastatur zusätzlich: `Q` / `E` sowie optional `←` / `→`.
- `Shift` + Drehen: 90°-Schritt.
- Aktuellen Winkel sichtbar anzeigen, z. B. `Rotation 45°`.
- `Bauen bestätigen` sendet den POST mit `rotationDeg`.
- `Zurück` bzw. `Esc` verwirft nur die Gebäudevorschau und behält die ausgewählte Stelle.
- Nach erfolgreichem Bau Preview und Rotation sauber zurücksetzen.

## Technische Anforderungen

- `rotationDeg` als UI-State in den bestehenden site-first-Flow integrieren.
- Normalisierung im Client ist optional; der Server bleibt kanonisch für `0 <= rotationDeg < 360`.
- POST an `/api/game/build/spatial` enthält `rotationDeg`.
- Preview-Footprint und Sprite müssen exakt denselben Winkel verwenden wie die spätere Darstellung.
- Keine neue DB-Migration, sofern das bestehende Feld `rotation_deg` ausreicht.
- Touch-Bedienung muss vollständig ohne Tastatur funktionieren.
- Gebäudeauswahl und Drehen dürfen keinen Bauauftrag auslösen; erst die explizite Bestätigung darf POSTen.

### Collision / Footprint

Vor Umsetzung prüfen, ob `lib/game/spatial/geometry.ts::overlaps` Rotationen berücksichtigt.

Der aktuelle Build-Route-Aufruf übergibt bei der Kollisionsprüfung nur Position und Breite/Tiefe. Für nicht-quadratische Footprints darf deshalb keine Diskrepanz entstehen zwischen:

- sichtbarer gedrehter Vorschau,
- persistierter Rotation,
- serverseitiger Kollisionsprüfung.

Falls `overlaps` aktuell axis-aligned arbeitet, soll entweder:

1. eine echte orientierte Rechteck-Kollision (OBB/SAT) implementiert werden, bevorzugt; oder
2. bewusst eine konservative AABB aus dem gedrehten Footprint abgeleitet und diese Semantik dokumentiert werden.

Client und Server müssen dieselbe geometrische Semantik verwenden.

## Akzeptanzkriterien

- Earth-Gebäude lassen sich vor Bestätigung über 360° drehen.
- Mindestens 15°-Schritte sind möglich.
- Maus und Touch funktionieren; Tastatur ist eine zusätzliche Bedienmöglichkeit.
- Der aktuelle Winkel ist sichtbar.
- Vorschau dreht Footprint und vorhandenes Gebäude-Asset unmittelbar.
- Nach Bestätigung wird exakt der gewählte Winkel gespeichert und nach einem Reload identisch gerendert.
- 0°, 45° und 90° werden für einen rechteckigen Footprint in den Kollisionstests abgedeckt.
- Vor `Bauen bestätigen` wird kein Bauauftrag erzeugt.
- Karten-Drag/Pan, Spot-Auswahl und Site-Panel bleiben funktionsfähig.
- Tests decken Winkelnormalisierung, Request-Payload, Cancel/Confirm und Rotations-Kollision ab.

## Nicht Teil dieses Requests

- Nachträgliches Drehen bereits fertiger Gebäude.
- Freie Gestenrotation per Mausdrag.
- 3D-Rotation.
