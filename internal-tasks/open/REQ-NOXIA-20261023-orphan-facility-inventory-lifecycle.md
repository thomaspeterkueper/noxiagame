---
id: REQ-NOXIA-20261023-ORPHAN-FACILITY-INVENTORY-LIFECYCLE
title: Facility inventory lifecycle – Orphans verhindern und Legacy-Bestände quarantänisieren
status: open
source: NOXIA-Core
created: 2026-10-23
priority: high
affects: [Core, Logistics, Inventories, Facilities, Moon, Persistence]
---

# Befund

Bei der Vorbereitung des ersten realen Moon-Surface-Transports wurde Production gegen die physische Inventarbindung geprüft.

Stand 2026-10-23:

- 31 `logistics_inventories` mit `subject_type='tile_entity'`, deren `subject_id` kein existierendes `tile_entities.id` mehr referenziert.
- alle 31 Orphans liegen derzeit am Moon-Standort;
- 11 sind leer;
- 20 enthalten noch Bestand;
- die gefüllten Moon-Orphans enthalten zusammen 10.949 Legacy-Spielmengeneinheiten.

Darunter befinden sich alte Mine-/Minenpuffer-, Eisbohr-, Shuttle-Port- und Lagerknoten. Die Werte dürfen **nicht** automatisch aktuellen Weltobjekten zugerechnet werden.

# Ursache

`noxia_ensure_facility_inventory` erzeugt korrekt genau ein natives Inventar pro geeignetem `tile_entity`.

Die Bindung ist jedoch absichtlich polymorph:

```text
logistics_inventories.subject_type = 'tile_entity'
logistics_inventories.subject_id   = tile_entities.id
```

Dafür existiert kein relationaler FK auf `tile_entities`. Wird ein Weltobjekt außerhalb eines expliziten Facility-Lifecycle-Kommandos gelöscht/ersetzt, kann sein Inventar weiterbestehen.

# Sicherheitsprinzip

**Bestand folgt nie implizit einer semantisch ähnlichen neuen Facility.**

Insbesondere unzulässig:

- alte `Mine · Facility`-Bestände auf eine neue Mine verschieben, nur weil beide `entity_id='mine'` haben;
- einen alten Minenpuffer anhand von Spieler, Label oder Standort einem neuen Objekt zuordnen;
- fehlende räumliche Provenienz nachträglich erfinden;
- gefüllte Orphans still löschen.

# Zielzustand

## 1. Future lifecycle guard

Ein physisches `tile_entity` mit nativem Inventar darf nicht roh verschwinden.

Vor Delete/Replacement muss Core explizit entscheiden:

```text
empty inventory
  -> inventory sauber stilllegen/löschen
  -> world entity löschen

non-empty inventory / reservations / active jobs
  -> Delete fail-closed
  -> explizite Evakuierung/Transfer/Abbruchentscheidung erforderlich
```

Ein Trigger darf den Fehler sichtbar machen, soll aber keinen Bestand automatisch bewegen.

## 2. Legacy reconciliation

Bestehende Orphans werden klassifiziert:

```text
empty orphan
  -> safe cleanup candidate

stocked orphan
  -> quarantine / legacy-unresolved
  -> active=false
  -> unveränderte Bestandszeilen behalten
  -> metadata mit ursprünglicher subject_id + Reconciliation-Grund
  -> kein public deposit/withdraw
  -> kein Transport-Endpoint
```

Die Quarantäne ist **keine** Bestandsanerkennung als aktuelle Weltressource. Sie konserviert lediglich Audit-/Migrationsdaten bis eine explizite fachliche Entscheidung getroffen wird.

## 3. Transport readiness

`resolveLogisticsNodeEndpoint` und andere physische Transportpfade müssen orphaned `tile_entity`-Inventare weiterhin fail-closed behandeln. Ein Inventar ohne existierendes räumliches Subject ist kein physischer Start-/Zielknoten.

# Acceptance Criteria

1. Neue Orphans können durch normale Core-Facility-Lifecycle-Pfade nicht mehr entstehen.
2. Das Löschen einer Facility mit Bestand, Reservation oder aktivem Transport wird fail-closed abgelehnt.
3. Leere Legacy-Orphans können deterministisch bereinigt werden.
4. Gefüllte Legacy-Orphans werden ohne Mengenänderung und ohne Reparenting quarantänisiert.
5. Quarantänisierte Inventare sind nicht als aktive Transportknoten verwendbar.
6. Reconciliation ist idempotent und auditiert.
7. Kein bestehender Bestand wird aufgrund von Label, Buildable-ID, Spieler-ID oder Nähe einem neuen `tile_entity` zugeschrieben.
8. Tests decken leeres Inventar, gefülltes Inventar, Reservation, aktiven Job und Replay ab.

# Bezug zum Moon-Transport

Dieser Fix ist Voraussetzung dafür, alte Mine-/Minenpufferbestände nicht fälschlich für den ersten realen
`Mine → LCR-6 → Warenhaus`-Transport zu verwenden.

Der erste reale Transport soll ausschließlich einen **aktuell existierenden, räumlich kanonischen und physisch aufgelösten** Quellknoten verwenden.
