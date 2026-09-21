# Earth Surface Logistics → NOXIA-CORE: fehlende Verträge/APIs

Source workstream: Earth Surface Logistics (`EXT-NOXIA-EARTH-20260911-SURFACE-LOGISTICS`)
Target: NOXIA-CORE
Date: 2026-09-21
Status: offen (Handoff, keine Ersatzimplementierung)

Earth konsumiert ausschließlich vorhandene Core-Verträge und baut keine zweite
Logistik-, Regel- oder Persistenzschicht. Die folgenden Punkte fehlen Core-seitig
und werden deshalb **nicht** in Earth implementiert.

## 1. `core-transport-rule-v1` — automatische Transportregeln

Was Earth heute liefert (bewusst ohne Persistenz):

- `lib/game/earthTransportRulePreview.ts`
  - `EarthTransportRuleIntent`: `kind` (`surplus-transfer` | `minimum-stock`), Quelle, Ziel, Gut, `thresholdAmount`, `maxAmount`,
  - `evaluateEarthTransportRuleIntent(...)`: greift die Regel auf dem **beobachteten** Core-Bestand, wie viel würde bewegt, ist die planetare Route freigegeben, welche Blocker bestehen,
  - `EARTH_TRANSPORT_RULE_CORE_CONTRACT = 'core-transport-rule-v1'` als Name des fehlenden Vertrags.
- `app/earth/EarthSurfaceHandoverPanel.tsx` nutzt das nur als Vorschau („nicht persistiert“).

Was Core liefern muss, damit Regeln wirksam werden:

1. **Regelmodell**: Kind, Quell-/Zielinventar, Gut, Schwellwert, optionales Maximum, Aktiv-Status, Owner/Profil, Priorität.
2. **Persistenz** inkl. Versionierung und nachvollziehbarer Historie (Anlegen, Ändern, Deaktivieren, letzte Ausführungen).
3. **Reservierung** der bewegten Menge über die bestehende Inventar-/Reservierungslogik — keine zweite Buchung.
4. **Ausführung** ausschließlich über die vorhandene TransportJob-State-Machine (`reserved → loading → in_transit → arrived → unloading → completed`) mit demselben `routeSnapshot`-Vertrag inklusive `passable` und `etaSeconds`.
5. **Idempotenz/Command-Envelope**, damit ein Tick eine Regel nicht doppelt auslöst.
6. **Read-API** für die Earth-UX: aktive Regeln je Location plus letzte Ausführung/Blocker.
7. **Scheduler-/Tick-Verantwortung** liegt bei Core. Earth besitzt weder Timer noch Zustandsautomaten für Regeln.

Bis dahin bleibt die Earth-UX bei einer reinen Vorschau und nennt den fehlenden
Contract sichtbar (`core-transport-rule-v1`).

## 2. Autoritative Frachtmasse je Commodity — offener NOXIA-Schritt

- `lib/game/core/logisticsCargoMassAuthority.ts` enthält eine **leere** Autoritätsliste (`LOGISTICS_CARGO_MASS_AUTHORITIES`).
- Folge: `POST /api/game/surface-transport/cargo-readiness` liefert für jede reale Fracht `CARGO_MASS_UNRESOLVED`; der manuelle Earth-Transport ist dadurch fachlich blockiert (nicht technisch).
- Der Vertrag selbst (`resolveLogisticsCargoMass`) existiert und ist fail-closed.
- Die Engineering-Basis ist **geliefert**: `EXT-NOXIA-ENG-20260913-CARGO-MASS-BASIS` (`engineering-commodities-r1.json`). Sie bildet Engineering-Commodities bewusst nicht auf NOXIA-Gameplay-IDs und nicht auf die historische Einheit `t` ab.

Hier ist **kein** neuer Core-Vertrag nötig, sondern ein NOXIA/Core-seitiger
Datenentscheid: eine explizite, belastbare Zuordnung Gameplay-ID/Transportform →
Massenbasis. Erfundene Dichten, Verpackungsmassen oder kg-pro-`game-unit` bleiben
ausgeschlossen.

## 3. Kanonische Earth-Fahrzeugdaten (offene Engineering-Abhängigkeit)

- `resolveSurfaceVehicleProfile` löst einen persistierten `frameId` nur auf exakten `VehicleFrame` + `SurfaceOperationProfile` auf und ist ohne diese Daten `unresolved`.
- Ohne diese Werte fehlen ETA, Energiebudget und Wear-Settlement, also der gemeinsame `surface-vehicle-route-v1`-Snapshot.
- Benötigt werden die produktiven Earth-Werte für `VehicleFrame` und `SurfaceOperationProfile` für mindestens `cargo-rover` und `heavy-hauler`.
- Diese Daten gehören KUEPER Engineering. Das Mond-Gegenstück ist im Code sichtbar (`EXT-NOXIA-ENG-20260911-LUNAR-SURFACE-LOGISTICS`, `app/api/game/moon/surface-transport/readiness/route.ts`); für Earth liegt in `external-tasks/open/` dieses Repositories derzeit **keine** Handoff-Datei (Stand 2026-09-21). Der Handoff ist damit nicht belegbar und vor einer erneuten Zusage neu anzulegen.

## 4. Was Earth ausdrücklich **nicht** braucht

- keine Earth-eigenen Supabase-Tabellen,
- keinen Earth-Scheduler/Tick,
- keine Earth-Mutations-API für Transporte oder Regeln,
- keinen zweiten Fortschritts-/Positionsmechanismus (Fahrzeugfortschritt kommt aus der persistierten Fahrt, siehe `deriveSurfaceMissionProgress`).

## 5. Stabile Schnittstellen, die Earth heute liest

| Schnittstelle | Zweck in Earth | Erwartung |
| --- | --- | --- |
| `GET /api/game/build/spatial?location=earth` | Location, Region-Origin, `tile_entity`-Weltobjekte | Shape bleibt stabil |
| `GET /api/game/logistics?locationId=` | Inventare inkl. `inventory_kind`, `storage_kind`, `subject_*`, `metadata`, plus Jobs | `metadata.role` (`spaceport_storage`, `shuttle_port`) bleibt erhalten |
| `GET /api/game/logistics?inventoryId=` | Bestandssnapshot für Regeln/Quelle (`items[].amount/available`) | `available` bleibt die reservierungsbereinigte Menge |
| `GET /api/game/vehicles?locationId=` | Fahrzeuginstanzen inkl. `currentNodeInventoryId`, Status | bleibt stabil |
| `POST /api/game/surface-transport/cargo-readiness` | Frachtmassen-Freigabe (fail-closed) | unverändert |
| `POST /api/game/earth/surface-transport/readiness` | Engineering-Freigabe des Frames | unverändert |
| `GET /api/earth/region` | OSM-Lesedaten für das Routing (Earth-eigen, read-only) | unverändert |

## References

- `docs/design/earth-surface-logistics.md`
- `external-tasks/open/EXT-NOXIA-EARTH-20260911-surface-logistics.md`
- `lib/game/earthTransportRulePreview.ts`
- `lib/game/earthSurfaceHandover.ts`
- `lib/game/earthTransportOverlay.ts`
- `lib/game/core/logisticsCargoMassAuthority.ts`
- `lib/game/vehicles/surfaceProfileResolution.ts`
- `app/api/game/surface-transport/cargo-readiness/route.ts`
- `app/api/game/moon/surface-transport/readiness/route.ts`
