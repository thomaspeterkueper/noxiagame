---
id: EXT-NOXIA-CORE-20260911-ARRIVAL-CONTROL-HOLDING
title: Core – Arrival Control, Holding Queue und Transit→Docking-Zwischenzustand
status: done
source: NOXIA-ORBIT
target: NOXIA-CORE
created: 2026-09-11
completed: 2026-09-15
priority: high
affects: [NOXIA, Core, Orbit, Stations, Transit, Docking, Phobos]
---

## Ergebnis

Der Transit-/Docking-Core unterscheidet Stationsankunft jetzt dauerhaft von physischem Docking.

Kanonische Kette:

```text
intersolar-transit
→ arrival-rendezvous / holding
→ approach
→ docked
→ departing
```

`ships.status` bleibt aus Kompatibilitätsgründen der ältere Movement-State `docked | transit`. Der physische Stationszustand wird serverautoritativ über `ship_arrival_states`, `docking_reservations` und `docking_connections` bestimmt. Docking bewegt weiterhin keine Fracht.

## Implementiert

- `docking_ports`, `docking_reservations`, `docking_connections`, `docking_commands`
- persistente Multi-Leg-Logistik und explizite Handovers
- `ship_arrival_states`
- stabile Holding-Reihenfolge über `queue_entered_at + ship_id`
- Phobos-Zonen `phobos-h-light`, `phobos-h-standard`, `phobos-h-heavy`
- Kepler/Prometheus-Zonen entsprechend nach Vessel-Class
- `noxia_get_ship_arrival_state(ship_id)`
- Transitabschluss an Stationsknoten → persistentes Holding
- aktive Portreservierung → `approach`
- aktive Docking-Connection → `docked`
- Undock → `departing`
- neuer Transit entfernt Arrival-State
- Guard: Portreservierung nur aus gültigem Arrival-Zustand
- Connected Cargo bleibt ohne aktive Docking-Connection gesperrt
- Application-Projektion und Arrival-/Docking-UI nutzen den Core-Zustand

## Gefundener und behobener Rollout-Fehler

Die Arrival-Migration rief `noxia_ship_docking_class(ship_type_id text)` auf, während der Docking-Core ursprünglich nur `noxia_ship_docking_class(ship_id uuid)` bereitstellte. Vor dem Hosted-Rollout wurde deshalb der kanonische Text-Overload ergänzt:

- `20260915101000_ship_docking_class_overload.sql`

Die Helper `noxia_canonical_station_slug(text)` und `noxia_docking_compatible(text,text)` wurden anschließend zusätzlich mit festem `search_path = public` gehärtet:

- `20260915124000_docking_helper_search_path_hardening.sql`

## Hosted Production – validiert 2026-09-15

Kontrolliert ausgerollt wurden:

1. Docking + Multi-Leg Logistics Core
2. Atomic Transport Itinerary
3. Docking/Itinerary Security Hardening
4. Ship-Type Docking-Class Overload
5. Arrival Control / Holding Core
6. Arrival Docking Phase Guard
7. Docking Helper Search-Path Hardening

Die jeweiligen Hosted-Migrations-IDs sind durch `*_remote_history_bridge.sql` auf `main` gespiegelt.

### Validierung

Erfolgreich serverseitig geprüft:

- neun kanonische Ports: sechs Phobos, drei Kepler
- Docking-/Itinerary-RPCs laufen als `SECURITY INVOKER`
- Arrival-/Guard-Trigger sind aktiv
- Standard-Frachter erhält `phobos-h-standard`
- persistente Queue: zwei Schiffe ergeben stabil Position 1 / 2; erneuter Read verändert die Reihenfolge nicht
- Heavy-Frachter findet an Kepler erwartungsgemäß keinen kompatiblen Port
- Connected Cargo wird vor physischem Docking blockiert
- Phobos-Test: Holding → B1-Reservierung → `approach` → Dock → `docked` → Undock → `departing` lief vollständig in einer Rollback-Testtransaktion durch
- derselbe Live-Frachter wurde anschließend real aus Queue-Position 1 über B1 freigegeben und physisch angedockt

Aktueller bestätigter Live-Zustand nach Abschluss:

```text
freighter_mk1
location = phobos
arrival.phase = docked
target_port = phobos-b1
active docking connection = phobos-b1
queue_position = null
```

Keine Cargo-Mutation wurde beim realen Docking ausgeführt.

## Security

Die neuen Core-Tabellen sind RLS-geschützt und für `anon` / `authenticated` direkt gesperrt; Zugriff erfolgt serverseitig über `service_role`. Der Supabase Security Advisor zeigt für diese Tabellen deshalb erwartungsgemäß den INFO-Hinweis `RLS enabled, no policy`. Die mutierenden neuen Docking-/Itinerary-RPCs sind nicht `SECURITY DEFINER`.

## Referenzen

- `supabase/migrations/20260911070500_docking_and_multileg_logistics_core.sql`
- `supabase/migrations/20260911071200_atomic_transport_itinerary_definition.sql`
- `supabase/migrations/20260911113700_docking_itinerary_security_hardening.sql`
- `supabase/migrations/20260915101000_ship_docking_class_overload.sql`
- `supabase/migrations/20260915101500_arrival_control_holding_core.sql`
- `supabase/migrations/20260915102000_arrival_docking_phase_guard.sql`
- `supabase/migrations/20260915124000_docking_helper_search_path_hardening.sql`
- `lib/game/core/transit.ts`
- `lib/game/core/dockingPersistence.ts`
- `app/dashboard/ArrivalControlPanel.tsx`
- `app/dashboard/DockingApproachPlanner.tsx`

Die vollständige ursprüngliche Anforderung und Zwischenstände bleiben in der Git-Historie des zuvor offenen Requests erhalten.
