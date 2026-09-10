# ADR: Gemeinsamer atomarer NOXIA Game Core

**Datum:** 10.09.2026  
**Status:** Accepted — Umsetzung begonnen  
**Scope:** Erde, Mond, Orbit, Mars und alle späteren Weltkörper

---

## Kontext

NOXIA besitzt inzwischen mehrere tragfähige Core-Bausteine: `actors`, `celestial_bodies`, `locations`, `world_frames`, `simulation_events`, `entity_states` sowie das bestehende Tick-Claiming über `tick_log`/`claim_due_ticks()`. Gleichzeitig verändern mehrere API-Routen zusammengehörigen Spielzustand noch über mehrere unabhängige Supabase-Aufrufe.

Beispiele sind Bauabschluss, Auftragserfüllung, Bankbewegungen, Schiffskauf und die heutige sofortige Reise. Bei einem Fehler zwischen zwei Schreibvorgängen kann dadurch ein fachlich unmöglicher Zwischenzustand persistieren.

Zusätzlich wachsen Erde, Mond und Orbit gleichzeitig. Ein separates Backend je Weltkörper würde Build-, Ownership-, Economy- und Bewegungslogik vervielfachen.

---

## Entscheidung 1 — Ein Game Core, viele Weltkörper

Erde, Mond, Orbit, Mars und spätere Körper verwenden dieselben fachlichen Commands und Zustandsmodelle. Unterschiede werden über Daten und Strategien ausgedrückt: Referenzrahmen, Terrain, Umweltbedingungen, Transfermodell, verfügbare Infrastruktur und Regeln des Zielorts.

API-Routen sind Adapter für Authentifizierung, Eingabevalidierung und Response-DTOs. Mehrtabellen-Zustandsänderungen gehören in transaktionale PostgreSQL-Commands.

---

## Entscheidung 2 — Bestehende Runtime-Schichten bleiben kanonisch

Es werden **keine** parallelen Systeme eingeführt für:

- Event Store / Outbox neben `simulation_events` und `entity_states`
- Tick-Scheduler neben `tick_log` und `claim_due_ticks()`
- Actor-Hierarchie neben `actors`
- planetare lokale Koordinaten neben `world_frames`
- zweite Building-Hierarchie neben `tile_entities.parent_id + slot`

Neue Commands müssen vorhandene Trigger und Projektionen benutzen, nicht duplizieren.

---

## Entscheidung 3 — Transaktionale Commands sind die Mutationsgrenze

Ein Command umfasst alle synchron zusammengehörigen Änderungen. Beispiele:

- `noxia_start_build`: Credits + `player_builds` + vorhandener Materialkosten-Trigger
- `noxia_complete_build`: Build-Status + materialisiertes `tile_entities`-Weltobjekt
- `noxia_complete_sale`: Verkaufsstatus + Auszahlung
- `noxia_fulfill_trade_order`: Order + Cargo + Credits + Koloniebestand + Transaktionshistorie

Commands sperren konkurrierende Rows mit `FOR UPDATE`, prüfen den Zustand erneut innerhalb der Transaktion und sind, wo fachlich sinnvoll, idempotent.

`service_role` darf diese Commands ausführen. Browser-Clients schreiben keine privilegierten Core-Zustände direkt.

---

## Entscheidung 4 — Spatial Core

`world_frames` ist die gemeinsame räumliche Grundlage.

Für planetare Oberflächen gilt:

1. kanonische body-fixed Latitude/Longitude/Altitude
2. lokales metrisches `x_m/y_m/z_m` als abgeleitete Arbeits-/Rendering-Koordinate
3. Terrain-Provenienz und vertikales Datum bleiben explizit

Ein Mond- oder Mars-Backend erhält deshalb kein separates Koordinatensystem. Es verwendet denselben Spatial Core mit anderem Referenzrahmen und Terrain-Dataset.

Legacy `tile_row/tile_col` bleiben Kompatibilitäts-/Darstellungsdaten und sind nicht das globale Weltkoordinatensystem.

---

## Entscheidung 5 — Tick vs. fälliges Ereignis

NOXIA erhält keinen globalen Frame-Tick, der permanent das gesamte Sonnensystem neu schreibt.

Periodische Simulation verwendet weiterhin das bestehende Tick-Claiming. Kontinuierliche Systeme werden aus `last_simulated_at` und verstrichener Zeit fortgeschrieben.

Zeitlich bestimmte Vorgänge speichern ihren Zielzeitpunkt und werden bei Fälligkeit durch idempotente Commands abgeschlossen. Beispiele: Bau, Verkauf, Forschung, Transferankunft.

Der Cron/Worker entscheidet **wann** ein Command fällig ist. Die Domain-Transaktion entscheidet **was** dabei atomar geändert wird.

---

## Entscheidung 6 — Ownership, Control und Custody trennen

`actors` bleibt die fachliche Identitätsschicht. Langfristig können Spieler, NPCs, Unternehmen, Kolonien, staatliche Akteure oder andere Organisationen Eigentümer sein.

Folgende Beziehungen dürfen nicht als dasselbe Feld behandelt werden:

- Eigentümer eines Assets
- aktueller Betreiber/Controller
- Standort eines Assets
- Custody/Besitz transportierter Güter
- Zugriffs-/Nutzungsrecht

Bestehende Felder wie `profile_id`, `owner_class`, `owner_id`, `actor_id`, `occupant_id` bleiben kompatibel, werden aber nicht als neue universelle Eigentumsabstraktion vervielfacht. Vor einer neuen generischen Ownership-Tabelle erfolgt ein eigener Migrationspass über die vorhandenen Actor-/Lease-Strukturen.

---

## Entscheidung 7 — Physische Bewegung heißt Transit, nicht Journey

`player_journeys` bezeichnet den spielerischen Fortschritts-/Questpfad und bleibt dafür reserviert.

Physische Bewegung wird im Core als **Transit** modelliert. Ein Asset befindet sich fachlich entweder an einem Ort oder in einem Transit. Oberflächenfahrt, Shuttle-Transfer, Orbittransfer und intersolare Reise verwenden dieselbe Zustandsmaschine, aber unterschiedliche Transfermodelle.

Die vorhandene Trennung `surface-transfer-shuttle` vs. `intersolar` bleibt erhalten. Planetare Raumhäfen sind Shuttle-Schnittstellen und werden nicht implizit zu intersolaren Terminals.

Die heutige synchrone `trade?action=travel`-Logik ist Legacy und wird in einem separaten Transit-Pass migriert, weil Docking-Reservierung, Energie, Landegebühr, Flugzähler und Bewegungszustand gemeinsam konsistent werden müssen.

---

## Entscheidung 8 — Altes `orbit_radius_au`-Reisemodell nicht erweitern

`celestial_bodies.orbit_radius_au` enthält historisch unterschiedliche Bezugsräume: bei Planeten heliocentrische, bei Monden teilweise parent-relative Abstände. Eine einfache Differenz dieser Werte ist daher kein gültiges allgemeines Transfermodell.

`calc_travel_time_seconds()` darf für neue planetenübergreifende Logik nicht als physikalischer Kern weiterentwickelt werden. Der spätere Transit-Pass führt explizite Frame-/Parent-Bezüge und Transfermodelle ein. UI-Kartenpositionen und physikalische Bahnparameter bleiben getrennt.

---

## Rollout

### Phase A — Atomic Core Boundary

- Build-Start atomar
- Build-Abschluss atomar/idempotent
- verzögerter Verkaufsabschluss atomar/idempotent
- Trade-Order-Fulfillment atomar
- gemeinsamer serverseitiger Command-Adapter

### Phase B — Economy/Assets

- Bankbewegungen atomar
- Spot-Handel atomar
- Schiffskauf/-wechsel atomar
- verbleibende Build-Sale/Cancel/Station-Module atomar

### Phase C — Transit

- heutige Instant-Travel-Logik erfassen und migrieren
- Zustandsmaschine `AT_LOCATION -> IN_TRANSIT -> AT_LOCATION`
- Docking-Claim und Ankunft konsistent integrieren
- Surface/Shuttle/Orbit/Intersolar als Transferstrategien
- physikalische Bahnparameter von UI-Positionen trennen

### Phase D — Ownership Normalization

- vorhandene Actor-/Lease-/Owner-Felder inventarisieren
- kanonische Semantik festschreiben
- erst danach eventuell generische Asset-Ownership-Projektion ergänzen

---

## Konsequenz für parallele Entwicklung

Während Änderungen an einer Phase dieses ADR laufen, dürfen andere Arbeiten an UI, Karten, Terrain, Grafik und rein lesenden Projektionen weitergehen. Parallele Änderungen an denselben Core-Mutationen, Migrationen oder API-Schreibpfaden müssen dagegen koordiniert werden, damit keine zweite Zuständigkeit entsteht.
