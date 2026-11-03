# NOXIA-SCHIFF-ZURUECKLASSEN-0001 – Linienflug mit eigenem Schiff

Stand: 03.11.2026 · Entscheidung Thomas: Variante 2 – der Linienflug ist auch mit eigenem Schiff möglich, das Schiff bleibt am Abflugort geparkt. Später: mehrere eigene Schiffe, angeheuerte Piloten.

## Befund

- Mit eigenem Schiff ist **der Ort des Schiffs der Ort des Spielers**. `profiles.current_location` ist dann veraltet (alle acht Schiffsbesitzer stehen dort auf „earth“, obwohl ihre Schiffe auf Mars oder Mond liegen).
- Der Server lehnt den Linienflug deshalb ab (`NOXIA_PASSENGER_HAS_SHIP`, Migration 20261003190000).
- 14 Datenbankfunktionen lesen `ships.location`: `noxia_start_transit`, `noxia_complete_transit`, `noxia_spot_trade`, `noxia_fulfill_trade_order`, `noxia_crew_sign_on`, `noxia_buy_ship_type`, `noxia_authorize_ascent`, `noxia_dock_vessel_impl`, `noxia_reserve_docking_port_impl`, `noxia_provision_lunar_ascent_shuttle`, `noxia_transfer_staged_surface_shuttle_cargo`, `noxia_sync_surface_to_orbit_ship_from_transport_job`, `noxia_start_passenger_transit`, `handle_new_profile`. Dazu Routen: trade, ships, bank, crew, missions, journeys, profile und das Dashboard.

## Zielbild

Der Spieler hat einen eigenen Ort, das Schiff auch. Sie sind nur „zusammen“, wenn der Spieler an Bord ist.

- `profiles.aboard_ship_id` (nullable): das Schiff, auf dem der Spieler gerade ist. Offen für mehrere Schiffe.
- **Ort des Spielers** = Ort des Schiffs, wenn an Bord, sonst `profiles.current_location`.
- Schiffsbefehle (Abflug, Handel mit Schiffsfracht, Andocken) gelten nur für das Schiff, auf dem der Spieler ist. Ohne Schiff am Ort gilt der Spediteur-Pfad (`profile_cargo`).
- **Linienflug mit Schiff:** Ticket kaufen, Spieler geht von Bord, das Schiff bleibt `docked` am Abflugort. Bei Ankunft setzt der Server `current_location`.
- **An Bord gehen:** nur, wenn Spieler und Schiff am selben Ort sind. Dort gilt wieder der Schiffs-Pfad.
- **Später, derselbe Mechanismus:** angeheuerter Pilot fliegt ein Schiff, ohne dass der Spieler an Bord ist (Schiff wandert, Spieler nicht); mehrere Schiffe (wählen, an Bord welches).

## Stufen

1. **Datenmodell:** Spalte `aboard_ship_id`; Nachziehen der Bestandsspieler (an Bord ihres aktiven Schiffs, `current_location` = Ort des Schiffs); `noxia_complete_transit` hält `current_location` bei Bordflug synchron.
2. **Schiffsbefehle prüfen, ob an Bord** (Abflug, Handel, Andocken, Besatzung, Aufstieg); sonst klare Meldung „Dein Schiff liegt in X“.
3. **Linienflug erlauben:** `noxia_start_passenger_transit` ohne Schiffsverbot; setzt `aboard_ship_id = null`; Abfluganbieter und Ticketschalter fragen den Ort des Spielers.
4. **An Bord gehen:** Aktion plus Anzeige im Ticketschalter und im Schiffsbereich („Dein Schiff liegt in X – Linienflug hin oder dorthin fliegen“).
5. **Prüfung:** Datenbanktests mit Rücknahme (Bestandsspieler, Flug mit Schiff, Rückkehr, Handel an beiden Orten), Tests der Server-Logik.

## Risiken

- Betrifft Handel, Docking und Besatzung in der laufenden Wirtschaft: Datenbank-Migration auf dem Produktivsystem, daher erst nach Freigabe und mit Rücknahmetests.
- Acht bestehende Spieler werden nachgezogen; ihr Ort ändert sich dabei nicht (er wird nur sauber gesetzt).
