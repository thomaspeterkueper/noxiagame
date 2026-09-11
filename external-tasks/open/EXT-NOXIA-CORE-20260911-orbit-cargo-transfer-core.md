---
id: EXT-NOXIA-CORE-20260911-ORBIT-CARGO-TRANSFER
title: Core – adressierbare Inventare und atomare Cargo-Handovers für Orbit/Stationen
status: open
source: NOXIA-ORBIT
target: NOXIA-CORE
created: 2026-09-11
priority: high
affects: [NOXIA, Core, Orbit, Stations, Logistics, Phobos]
---

## Ausgangspunkt

Orbit/Stations hat die fachliche Cargo-Handover-Policy abgeschlossen und Phobos als `free-port` / persistentes Depot / lokalen Markt-Knoten klassifiziert.

Kanonische Invariante:

> Docking stellt nur eine physische Verbindung her. Fracht bewegt sich ausschließlich durch einen separaten, expliziten Cargo-Transfer.

Orbit darf dafür keine eigene Inventar- oder Transit-Zustandsmaschine aufbauen.

## Benötigte Core-Fähigkeiten

Bitte die gemeinsame Core-Schicht so erweitern, dass folgende Fähigkeiten generisch verfügbar werden:

1. adressierbare Inventare für
   - Fahrzeuge / Schiffe / Transfer-Shuttles,
   - Stations-/Depotlager,
   - Surface-Port-Lager,
2. atomarer Cargo-Transfer `source inventory -> target inventory`,
3. Validierung von
   - Ressource,
   - Menge,
   - Source-Bestand,
   - Zielkapazität,
   - Ownership / Autorisierung,
   - zulässiger physischer Verbindung,
4. idempotente Transfer-Commands, damit Wiederholung keinen doppelten Warenfluss erzeugt,
5. Reservierungen für
   - Marktangebote,
   - Transportaufträge,
   - Weitertransport,
6. Unterstützung mehrstufiger Transportjobs mit getrennten
   - `legs` = Fahrzeugbewegung,
   - `handovers` = Frachtbewegung zwischen Inventaren,
7. Docking-Zustand als Voraussetzung für bestimmte Transfers, aber niemals als Transfer selbst.

## Referenzablauf

```text
Shackleton Shuttle-Port Storage
 -> Transfer Shuttle
 -> Lunar Orbital Depot
 -> Intersolar Freighter
 -> Phobos Depot
 -> Phobos Market reservation / sale
```

Benötigte Handover-Schritte:

```text
surface-port inventory -> shuttle inventory
shuttle inventory -> orbital-depot inventory
orbital-depot inventory -> freighter inventory
freighter inventory -> phobos-depot inventory
phobos-depot inventory -> market reservation
```

Jeder Pfeil ist ein eigener autorisierter Vorgang.

## API-/Command-Semantik

Die konkrete technische Form bleibt Core-owned. Aus Orbit-Sicht muss aber mindestens eine Semantik in dieser Art möglich sein:

```text
transferCargo({
  commandId,
  sourceInventoryId,
  targetInventoryId,
  resource,
  amount,
  actorId
})
```

Der Command muss atomar und idempotent sein.

Ein Transportauftrag muss anschließend Sequenzen dieser Form referenzieren können:

```text
leg -> handover -> leg -> handover -> final storage/market
```

## Nicht in Core duplizieren

- keine Orbit-spezifische zweite Transit-State-Machine,
- keine Phobos-Sondertabellen für generische Inventarfunktionen,
- keine automatische Frachtbewegung durch `dock`, `arrive` oder `travel complete`,
- keine implizite Surface-Landung intersolarer Frachter.

## Acceptance Criteria

1. Docking und Cargo-Transfer sind technisch getrennte Commands/Zustände.
2. Fracht kann zwischen zwei autorisierten Inventarknoten atomar bewegt werden.
3. Source-Bestand und Zielkapazität können nicht negativ/überlaufen.
4. Wiederholung desselben Commands erzeugt keinen Doppeltransfer.
5. Marktware auf Phobos kann aus physischem Depotbestand reserviert werden, ohne das Depotmodell zu umgehen.
6. Mehrstufige Routen können Legs und Handovers separat referenzieren.
7. Bestehende Transit-Architektur wird erweitert statt ersetzt.

## Core-Implementierungsstand — 2026-09-11

Die generische Core-Schicht ist im Repository implementiert. Der Request bleibt dennoch `open`, bis die neuen DB-Migrationen auf einem disponiblen Preview validiert und anschließend kontrolliert auf Hosted Production ausgerollt wurden.

### Bereits vorhanden

- `supabase/migrations/20260911060537_logistics_core_inventories_and_transport_jobs.sql`
  - adressierbare Inventare,
  - atomare/idempotente Cargo-Transfers,
  - Outbound-/Inbound-Reservierungen,
  - Transportjobs,
  - Source-/Kapazitätsprüfung.
- `supabase/migrations/20260911070500_docking_and_multileg_logistics_core.sql`
  - getrennte Docking-Persistenz,
  - Cargo-Handover bleibt eigener Vorgang,
  - Multileg-/Handover-Grundlage.
- `supabase/migrations/20260911071200_atomic_transport_itinerary_definition.sql`
  - atomare Definition von Itineraries aus Legs und Handovers.
- `lib/game/core/logistics.ts`
- `app/api/game/logistics/route.ts`
- `app/api/game/logistics/handover/`

### Neu: physische Depot-Custody und Marktangebote

Migration:

- `supabase/migrations/20260911111420_custody_marketplace_core.sql`
- Hardening: `supabase/migrations/20260911112830_market_command_idempotency_hardening.sql`

Core-Fassade/API:

- `lib/game/core/marketplace.ts`
- `app/api/game/market/route.ts`

Implementierte Semantik:

```text
Physischer Depot-Host
  -> privates Storage Account / Custody Inventory pro Eigentümer
  -> Market Offer referenziert genau dieses Inventar
  -> logistics_reservations blockiert die angebotene Menge
  -> Kauf überträgt Credits + Custody atomar
  -> Ware bleibt physisch am selben Depot-Host
```

Damit ist ein Marktangebot **kein zweiter Warenbestand**. Die angebotene Menge bleibt im Verkäufer-Custody-Inventar und wird dort durch eine Outbound-Reservation mit `purpose_type = market_offer` gebunden.

Beim Settlement wird die Ware im selben physischen Depot vom privaten Verkäufer-Custody-Inventar in das private Käufer-Custody-Inventar übertragen. Es findet kein impliziter Transport und keine Teleportation zwischen Knoten statt.

Verfügbare Core-Aktionen:

```text
ensureStorageAccount(hostInventoryId)
createMarketOffer(commandId, sellerInventoryId, resource, amount, unitPrice)
cancelMarketOffer(offerId)
buyMarketOffer(commandId, offerId, amount)
```

Die Kauf- und Angebotscommands sind idempotent; das Hardening serialisiert auch konkurrierende Wiederholungen derselben Command-ID innerhalb der PostgreSQL-Transaktion.

### Phobos Live-Ausgangslage verifiziert

Hosted Production besitzt bereits einen echten nativen Phobos-Depotknoten (`Warenhaus · Depot`) mit `public_deposit = true`. Dieser Knoten kann als physischer Host der privaten Custody-Inventare dienen. Es wird keine Phobos-Sonderinventartabelle eingeführt.

### Rolloutstatus

**Repository/Vercel:**

- Marketplace-Migration: Commit `883ac732dca9e3b1e60e490caeed36f4d276d9a1`
- Core-Fassade: Commit `bbc7e6f7fb962de373ff85993cfb56d847592abc`
- API: Commit `4b8517356bd70e8e51d1d3e115f0f713fe4f5d1a`
- Idempotency-Hardening: Commit `d71f9a3487449122ed3b43325377c5d6f80baf54`
- Vercel-Build für die API-Fassung ist `READY`; der Hardening-Commit wird separat durch den normalen Deployment-Pfad geprüft.

**Hosted Supabase Production:**

Production ist bewusst noch **nicht** verändert worden. Beim letzten Check endet die Hosted-Migrationshistorie bei `20260911101048`. Insbesondere die Repo-Migrationen `20260911070500` / `20260911071200` sowie die neue Custody-/Marketplace-Migration sind dort noch nicht ausgerollt.

Es existiert aktuell kein disponibler Supabase-Preview-Branch. Daher kein Direkt-Rollout auf Production als Ersatz für die Preview-Validierung.

### Acceptance-Status

1. **erfüllt im Repo** — Docking und Cargo-Transfer sind getrennt.
2. **erfüllt und Hosted vorhanden** — atomarer Inventory-to-Inventory Cargo-Transfer.
3. **erfüllt und Hosted vorhanden** — Source-Bestand/Zielkapazität werden geschützt.
4. **erfüllt im Repo** — Transfer und neue Marktcommands sind idempotent; Marktcommands zusätzlich gegen konkurrierende Retries gehärtet.
5. **erfüllt im Repo** — Phobos-Marktware wird aus privater Custody unter einem realen physischen Depot reserviert; kein Parallelbestand.
6. **erfüllt im Repo** — Legs und Handovers sind getrennt modellierbar.
7. **erfüllt im Repo** — bestehende Logistics-/Transit-Architektur wird erweitert, nicht ersetzt.

### Noch offen bis `done`

1. Custody-/Marketplace-Migration auf disposable Preview ausführen.
2. SQL-/Security-/Idempotency-Tests gegen Preview durchführen, inklusive Partial Fill und paralleler Retry-Semantik.
3. Fehlende Docking-/Itinerary-Migrationen im selben kontrollierten Hosted-Rollout berücksichtigen bzw. deren bereits vorgesehene Rollout-Reihenfolge verifizieren.
4. Danach Production-Migration anwenden und Live-Phobos-End-to-End testen:

```text
Freighter -> Phobos Depot/Custody -> Market Offer -> Reservation -> Sale -> Buyer Custody
```

5. Erst danach diesen Core-Request nach `external-tasks/done/` verschieben.

## Orbit-Referenzen

- `docs/architecture/orbit-cargo-handover.md`
- `lib/game/logisticsNodes.ts`
- `lib/game/transportDomains.ts`
- `lib/game/stationProfiles.ts`
- `external-tasks/open/EXT-NOXIA-ORBIT-20260911-cargo-handover.md`
