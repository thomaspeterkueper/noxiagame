# Alpha 0.1 — Raumhafen / Landeplatz als Reisezentrum

Stand: 23.06.2026

## Entscheidung

Reisen gehört nicht mehr primär in die Anzeige „Deine Orte“, sondern an den Landeplatz / Raumhafen.

## Ziel-Flow

1. Spieler klickt auf Landeplatz / Raumhafen.
2. Overlay zeigt eigene Schiffe am aktuellen Ort.
3. Falls mehrere Schiffe dort stehen: Schiff auswählen / aktivieren.
4. Ziel wählen.
5. Overlay zeigt Energiebedarf, Reichweite und Flugzeit.
6. Flug starten.

## Werft-Flow

Die Werft bleibt für:

- Schiffe kaufen
- später: reparieren
- später: umbauen
- später: Module / Antrieb / Frachtraum verwalten

## Kurzfristiger Alpha-Fix

Das akute Problem ist der fehlende Rückflug von Stationen wie Prometheus. Die Ursache: `StationOverlay` besitzt Travel-Props, nutzt sie aber noch nicht. Zusätzlich reicht `DashboardClient` diese Props aktuell nicht vollständig an `StationOverlay` durch.

Minimaler Fix:

- `DashboardClient` gibt `allLocations`, `cargo`, `shipRange`, `currentTick`, `inTransit`, `onTravel` an `StationOverlay` weiter.
- `StationOverlay` erhält einen sichtbaren Abflug-/Docking-Block oder nutzt dasselbe Reiseoverlay wie der Landeplatz.

## Nächster System-Fix

Die API besitzt bereits `ships?action=list` und liefert alle Schiffe des Spielers. Für echte Mehrschiff-Auswahl fehlt noch:

- `ships?action=activate&shipId=...`

Diese Aktivierung sollte prüfen:

- Schiff gehört dem Spieler.
- Schiff steht am aktuellen Standort oder Aktivierung ist bewusst remote erlaubt.
- Nur ein Schiff ist danach `is_active = true`.
- `profiles.active_ship_id` wird synchronisiert.
