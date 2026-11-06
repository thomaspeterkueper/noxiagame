# NOXIA-WORLD-0005 – Fahrzeuge und Betriebe auf der Erde

Aktualisiert: 06.11.2026 · Version 1.3.0

## Entscheidung (Thomas, 26.10.2026 und 06.11.2026)

Reale Gewerbe-Gebäude der Weltkarte werden zu Betrieben im Spiel – aber nur,
wo tatsächlich ein Gebäude mit passender Funktion steht. Der reale Name bleibt
Kartenbeschriftung; im Spiel führt ein erfundener Nachfolgebetrieb des Jahres
2086 das Haus (Markenschutz). Praxen und Kanzleien mit Personennamen werden
nie zu Betrieben.

Erster Betriebszweig: das Auto.

- Autohaus (`shop=car`): Kauf – Kleinwagen 1 800, Kombi 3 200, Transporter 5 400 Cr. Höchstens ein aktives Fahrzeug je Profil.
- Werkstatt (`shop=car_repair`, `craft=car*`): Reparatur, 6 Cr je fehlendem Prozent Zustand.
- Ladestation (`amenity=fuel`, `car_wash`): Laden, 1 Cr je Prozent. Laden geht auch im Autohaus und in der Werkstatt.
- Fahrt: 1 % Akku je 10 km – eine Ladung reicht 1 000 km („1000 km sollten pro Akku schon mindestens drin sein“). Verschleiß 1 % je 100 km; unter 15 % Zustand fährt nichts mehr. Straßenweg = Luftlinie × 1,3.
- „Hinfahren“ erscheint an Gebäuden ab 400 m Entfernung und im Reisebüro je Ziel; die Figur springt nach gebuchter Fahrt ans Ziel.

Alle Buchungen sind versteuerte Überweisungen an den öffentlichen Akteur der
Erde (Muster `order_hospitality_item`), idempotent je `request_id`.

## Umsetzung

- Datenbank: `supabase/migrations/20261026220000_player_vehicles.sql` – `player_vehicles`, `player_vehicle_services`, RPCs `vehicle_model`, `vehicle_service`, `vehicle_drive`.
- API: `app/api/game/vehicle/route.ts` (GET Zustand; POST buy/repair/charge/drive).
- Zahlen für Client und Server: `lib/game/earthVehicles.ts`.
- Betriebe: `lib/game/business/establishments.ts` (`establishmentFor`, `establishmentFromUse`); Raumart in `lib/game/landmarks/interiors.ts` (`buildingRoomKind` → `shop` / `workshop`).
- Oberfläche: `app/components/VehicleDesk.tsx` (Tresen im Betrieb, „Hinfahren“, geteilter Fahrzeugzustand), eingebunden in `app/world-lab/WorldPanels.tsx` und `app/components/TravelAgency.tsx`.

## Verkehr ist echt, keine Kulisse (Thomas, 06.11.2026)

Auf der Karte fährt nur, wer wirklich jemand ist: kein zufällig erzeugter
Hintergrundverkehr.

- Personen der Simulation mit Auto fahren ihren Arbeitsweg sichtbar über die Straßen (Auto statt Figur, rechts der Straßenmitte). Wer ein Auto hat, ist je Person fest (Platzhalter: Arbeitsplatz und Kennung, bis die Personensimulation Fahrzeuge vergibt).
- Die eigene Fahrt ist bis 6 km eine sichtbare Fahrt über den Straßenweg (`engine.driveTo`); gebucht wird bei der Ankunft mit der gefahrenen Strecke. Weiter weg ist es eine Fernfahrt (Sprung), wie beim Reisebüro.
- Das eigene Auto steht sichtbar geparkt am Straßenrand, wo es zuletzt abgestellt wurde (Kauf: vor dem Autohaus).
- Busse fahren nach Fahrplan auf echten Buslinien aus OpenStreetMap (relation route=bus, mit Haltestellen): Aufenthalt an den Endhaltestellen (3 min), 15 s Halt je Haltestelle, rund 32 km/h, eigener Versatz je Linie. Linien werden je Gegend (0,1°-Raster) einmal geholt (`earth_bus_routes`, `earth_bus_cells`, Migration 20261106020000) und über `/api/world-lab/bus` geladen.

- Autos anderer Spieler kommen über die Kartenpräsenz (Realtime, nichts gespeichert): wer fährt, ist als Auto statt Figur zu sehen; ein geparktes Auto steht am Straßenrand, wo es sein Besitzer abgestellt hat.

## Offen

- Fahrzeuge der Personensimulation aus der Datenbank statt aus der Kennung (Platzhalter).

- Tiere (Tierbedarf, Tierarzt) als zweiter Betriebszweig.
- Fahrzeug auf der Karte zeichnen; Fahrt als Bewegung statt Sprung.
- Weitere Modelle aus einer Tabelle statt aus `vehicle_model`.
