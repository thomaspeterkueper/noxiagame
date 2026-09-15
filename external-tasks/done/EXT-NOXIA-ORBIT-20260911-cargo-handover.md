---
id: EXT-NOXIA-ORBIT-20260911-CARGO-HANDOVER
title: Orbit/Stations – Cargo-Handover, Phobos-Markt und Shuttle-Schnittstelle
status: done
source: NOXIA-CORE
target: NOXIA-ORBIT
created: 2026-09-11
closed: 2026-09-15
priority: high
affects: [NOXIA, Orbit, Stations, Phobos, Core, Logistics]
---

## Abschluss

Die Orbit-/Stations-Policy aus `docs/architecture/orbit-cargo-handover.md` ist jetzt nicht nur definiert, sondern auf Hosted Production umgesetzt und auf Phobos Ende-zu-Ende getestet.

### Kanonische Kette

```text
Surface / vorheriger Logistik-Leg
→ Schiffsinventar
→ physisches Docking am Stationsport
→ expliziter Connected Cargo Transfer
→ private Custody im Phobos-Depot
→ Market Reservation / Offer
→ Sale
→ Buyer Custody am selben Depot
```

Docking, Besitz und Frachttransfer bleiben getrennte Zustände. Ein Docking-Vorgang bewegt keinerlei Ware.

### Phobos Cargo Terminal

Neu in der Stationsoberfläche:

- `app/dashboard/StationCargoTerminal.tsx`
- Integration in `app/dashboard/StationOverlay.tsx` v1.0.0

Das Terminal liest live:

- das aktuelle `ship_cargo`-Inventar,
- die aktive Docking-Connection,
- den öffentlichen Phobos-Depot-Host,
- das private Spieler-Custody-Inventar,
- offene physische Marktangebote am selben Host.

Verfügbare Vorgänge:

```text
Schiff → Depot
Depot → Schiff
Custody → Marktangebot
Marktangebot → Käufer-Custody
```

Schiff↔Depot verwendet ausschließlich `transfer-connected`; ohne aktive physische Docking-Connection bleibt der Transfer gesperrt.

### Marketplace / Custody

Hosted Production enthält jetzt:

- private `storage_accounts` unter einem echten Depot-Host,
- `market_offers`, die Ware über `logistics_reservations` binden,
- `market_settlements` für atomaren Credits-/Custody-Wechsel,
- idempotente und gegen konkurrierende Retries serialisierte Commands.

Ein Marktangebot ist kein zweiter Bestand. Die Ware bleibt physisch im Phobos-Depot und nur ihre private Custody wird beim Verkauf übertragen.

### Live-Abnahme Phobos

Der reale aktive `freighter_mk1` ist weiterhin an `phobos-b1` physisch angedockt. Für den Spieler existiert jetzt ein privates Custody-Inventar unter `Warenhaus · Depot`.

Der komplette Ablauf wurde in einer Rollback-Transaktion mit echter B1-Connection getestet:

```text
Freighter
→ Phobos Custody
→ Offer + Reservation
→ Partial Fill
→ idempotenter Buy-Retry
→ Full Fill
→ Buyer Custody
```

Alle Assertions bestanden. Die Testfracht, Testangebote, Settlements und Credit-Bewegungen wurden vollständig zurückgerollt.

Der reale Zustand nach dem Test bleibt daher sauber:

- Schiff: `phobos-b1`, physisch `docked`,
- Schiffscargo Metall: `0 t`,
- Spieler-Custody Metall: `0 t`,
- offene Testangebote: `0`,
- Test-Settlements: `0`.

Es wurde bewusst keine reale Ware erfunden.

### Acceptance Criteria

1. Kein magischer Cargo-Teleport — **erfüllt und live getestet**.
2. Docking, Besitz und Cargo-Transfer getrennt — **erfüllt**.
3. Phobos funktioniert als echter Depot-/Markt-/Umschlagknoten — **erfüllt**.
4. Bestehender Transit-/Logistics-Core wird wiederverwendet — **erfüllt**.
5. Keine parallele Orbit-Backend-Domain — **erfüllt**.

## References

- `docs/architecture/orbit-cargo-handover.md`
- `app/dashboard/StationCargoTerminal.tsx`
- `app/dashboard/StationOverlay.tsx`
- `lib/game/core/logistics.ts`
- `lib/game/core/logisticsHandover.ts`
- `lib/game/core/marketplace.ts`
- `app/api/game/logistics/handover/route.ts`
- `app/api/game/market/route.ts`
- `external-tasks/done/EXT-NOXIA-CORE-20260911-orbit-cargo-transfer-core.md`
