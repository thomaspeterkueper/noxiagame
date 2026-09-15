---
id: EXT-NOXIA-CORE-20260911-ORBIT-CARGO-TRANSFER
title: Core – adressierbare Inventare und atomare Cargo-Handovers für Orbit/Stationen
status: done
source: NOXIA-ORBIT
target: NOXIA-CORE
created: 2026-09-11
closed: 2026-09-15
priority: high
affects: [NOXIA, Core, Orbit, Stations, Logistics, Phobos]
---

## Abschluss

Die gemeinsame Core-Schicht für Orbit-/Stationsfracht ist implementiert, produktiv ausgerollt und auf Phobos Ende-zu-Ende getestet.

Kanonische Invariante bleibt:

> Docking stellt nur eine physische Verbindung her. Fracht bewegt sich ausschließlich durch einen separaten, expliziten Cargo-Transfer.

### Produktiv verfügbar

- adressierbare Logistics-Inventare und Reservierungen,
- atomarer/idempotenter Cargo-Transfer,
- persistente Transportjobs,
- getrennte `transport_job_legs` und `transport_job_handovers`,
- Docking-Ports, Reservations und Connections,
- `noxia_transfer_connected_cargo(...)` mit aktiver Docking-Connection als physischer Voraussetzung,
- private Custody-/Storage-Accounts unter einem realen Depot-Host,
- reservierungsgebundene Marktangebote,
- atomarer Kauf mit Credits- und Custody-Wechsel am selben physischen Knoten,
- Command-ID-Serialisierung für konkurrierende Retries.

### Hosted Rollout am 15.09.2026

Der zuvor fehlende Core wurde kontrolliert auf Hosted Production ausgerollt. Für den Cargo-/Marketplace-Abschluss relevant sind insbesondere:

- `20260915122935` — `docking_and_multileg_logistics_core_manual_rollout`
- `20260915123010` — `atomic_transport_itinerary_definition_manual_rollout`
- `20260915123032` — `docking_itinerary_security_hardening_manual_rollout`
- `20260915153107` — `custody_marketplace_core_manual_rollout`
- `20260915153132` — `market_command_idempotency_hardening_manual_rollout`
- `20260915153150` — `core_command_retry_serialization_manual_rollout`

Die abweichenden Hosted-Versionsnummern sind über `remote_history_bridge`-Migrationen im Repository dokumentiert.

### Phobos Live-Test

Der reale aktive `freighter_mk1` ist an `phobos-b1` physisch angedockt. Der Test nutzte genau diese reale Docking-Connection und den bestehenden öffentlichen Phobos-Host `Warenhaus · Depot`.

In einer vollständig zurückgerollten Testtransaktion wurde verifiziert:

```text
Docked Freighter
→ connected cargo transfer
→ Seller Custody @ Phobos Depot
→ Market Offer
→ outbound reservation
→ partial purchase
→ idempotent retry derselben Buy-Command-ID
→ final purchase
→ Buyer Custody @ demselben Phobos Depot
```

Assertions:

- Cargo-Transfer ist ohne aktive physische Docking-Verbindung nicht möglich.
- Schiffsinventar und Depot-Custody sind getrennte adressierbare Inventare.
- Marktangebot erzeugt keinen zweiten Bestand.
- Angebotsmenge wird durch `logistics_reservations` gebunden.
- Partial Fill reduziert Reservation und Restangebot korrekt.
- Retry derselben Command-ID erzeugt keinen zweiten Kauf.
- Full Fill setzt Angebot auf `filled` und Reservation auf verbraucht.
- Käufer- und Verkäuferware bleiben am selben physischen Depot-Host; nur Custody wechselt.
- Testdaten, Credits und Testfracht wurden durch `ROLLBACK` vollständig verworfen.

### Reale Spieler-Custody

Für den aktuell auf Phobos befindlichen Spieler ist ein echtes privates Storage Account unter dem öffentlichen Phobos-Depot angelegt. Der Bestand ist weiterhin 0 t; es wurde keine Testware erzeugt oder behalten.

### Security

Die neuen Marketplace-Tabellen haben RLS aktiviert. Direkter Zugriff für `public`, `anon` und `authenticated` ist entzogen; die Anwendung greift serverseitig über `service_role` zu. Die neuen Marketplace-RPCs sind `SECURITY INVOKER` und besitzen einen festen `search_path`.

### Acceptance Criteria

1. Docking und Cargo-Transfer technisch getrennt — **erfüllt**.
2. Atomarer Transfer zwischen autorisierten Inventaren — **erfüllt**.
3. Source-/Kapazitätsgrenzen geschützt — **erfüllt**.
4. Idempotente Commands / keine Doppeltransfers — **erfüllt und live getestet**.
5. Phobos-Markt reserviert physischen Custody-Bestand — **erfüllt und live getestet**.
6. Legs und Handovers getrennt modelliert — **erfüllt**.
7. Bestehende Transit-/Logistics-Architektur erweitert, keine Paralleldomain — **erfüllt**.

## Relevante Implementierung

- `lib/game/core/logistics.ts`
- `lib/game/core/logisticsHandover.ts`
- `lib/game/core/dockingPersistence.ts`
- `lib/game/core/marketplace.ts`
- `app/api/game/logistics/route.ts`
- `app/api/game/logistics/handover/route.ts`
- `app/api/game/docking/route.ts`
- `app/api/game/market/route.ts`
- `supabase/migrations/20260911070500_docking_and_multileg_logistics_core.sql`
- `supabase/migrations/20260911071200_atomic_transport_itinerary_definition.sql`
- `supabase/migrations/20260911111420_custody_marketplace_core.sql`
- `supabase/migrations/20260911112830_market_command_idempotency_hardening.sql`
- `supabase/migrations/20260911114600_core_command_retry_serialization.sql`
