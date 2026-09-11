---
id: EXT-NOXIA-ORBIT-20260911-CARGO-HANDOVER
title: Orbit/Stations – Cargo-Handover, Phobos-Markt und Shuttle-Schnittstelle
status: open
source: NOXIA-CORE
target: NOXIA-ORBIT
created: 2026-09-11
priority: high
affects: [NOXIA, Orbit, Stations, Phobos, Core, Logistics]
---

## Ausgangspunkt

Surface Logistics endet nicht am Raumhafen. NOXIA trennt bereits `surface-transfer-shuttle` von `intersolar`, und `phobos` ist als orbitaler Logistikknoten modelliert. Für eine echte Exportkette muss nun die Übergabe von Oberflächenfracht an Orbit/Stationen fachlich definiert werden.

Der Core besitzt Transit, Ownership und künftig die gemeinsamen Inventar-/Transportjob-Commands. Dieser Request betrifft die **Orbit-/Stations-Policy und UX**, nicht ein zweites Backend.

## Auftrag

Bitte ausarbeiten:

1. Oberflächenlager/Raumhafen -> Transfer-Shuttle -> Orbitalinterface als klaren Cargo-Handover,
2. Inventarknoten für Orbitalinterface, Station/Depot und angedocktes Schiff,
3. Umladen zwischen Shuttle, Depot und intersolarem Frachter,
4. Phobos als Markt-/Depot-/Free-Port-Endpunkt für Metall und andere Waren,
5. Docking und Cargo-Handover getrennt halten: ein Schiff kann angedockt sein, ohne dass Fracht automatisch übertragen wird,
6. UX für Laden/Entladen/Weiterleiten und automatische Transportketten,
7. Anforderungen an Transit-Route/Legs für spätere mehrstufige Transportaufträge.

## Referenzkette

```text
Moon Mine
 -> Surface Hauler
 -> Shackleton Shuttle-Port Storage
 -> Transfer Shuttle
 -> Lunar Orbital Interface / Depot
 -> Intersolar Freighter
 -> Phobos
 -> Phobos Depot / Market
```

## Abgrenzung

Nicht implementieren:

- neue globale Inventar-/Transportjob-Schemata,
- eigene Transit-Zustandsmaschine,
- neue Schiffsklassen oder Engineering-IDs ohne zuständige Engineering-Closure,
- Oberflächenrouting für Earth/Moon/Mars.

## Erwartetes Ergebnis

- fachliche Cargo-Handover-Regeln für Orbit/Stations,
- benötigte Inventory-/Transfer-Rollen als Input für Core,
- Phobos-Verkaufs-/Depotablauf,
- klare Grenze Shuttle vs. intersolares Schiff,
- UX-Vorschlag für Cargo-Transfer und mehrstufige Exportaufträge,
- Response an `NOXIA-CORE`.

## Acceptance Criteria

1. Fracht kann ohne magische Teleportation Oberfläche -> Orbit -> Frachter -> Phobos gelangen,
2. Docking, Besitz und Frachttransfer bleiben getrennte Zustände,
3. Phobos kann als realer Handels-/Umschlagknoten funktionieren,
4. bestehende `Transit`-Architektur wird wiederverwendet,
5. keine parallele Backend-Domain entsteht.

## Orbit/Stations Response — 2026-09-11

Die fachliche Policy ist ausgearbeitet und kanonisch dokumentiert:

- `docs/architecture/orbit-cargo-handover.md`

### Festgelegte Invarianten

- **Docking ist niemals Cargo-Transfer.** Docking stellt nur die physische Verbindung und Portbelegung her.
- Frachtbewegung erfolgt ausschließlich über einen expliziten Cargo-Transfer zwischen zwei adressierbaren Inventaren.
- Orbitaldepots besitzen persistentes Inventar und entkoppeln Shuttle- und Frachterfahrpläne.
- Standard-Handover ist zweistufig: `Shuttle -> Depot -> Frachter`.
- Direkter Cross-Dock-Transfer `Shuttle -> Frachter` ist später möglich, bleibt aber ebenfalls ein expliziter Transferauftrag.
- Planetare Surface-Ports bleiben Shuttle-Ports; intersolare Schiffe landen dort nicht.
- `phobos` bleibt `orbital-station / node-itself` und wird als echter Depot-, Markt- und Free-Port-Knoten behandelt.
- Marktangebot ist fachlich nicht identisch mit Lagerbestand: Ware kann am Knoten liegen, ohne angeboten zu sein.
- Ein mehrstufiger Transportauftrag besteht aus **Legs**, die Fahrzeuge bewegen, und **Handovers**, die Fracht zwischen Inventaren bewegen. Diese Begriffe dürfen im Core nicht zusammenfallen.

### Phobos-Zielbild

Phobos übernimmt vier Rollen:

1. interplanetarer Umschlagpunkt,
2. persistentes Depot,
3. lokaler physischer Markt,
4. breit zugänglicher Free Port mit eigener Governance-/Gebührenlogik.

Ein exemplarischer Metallexport läuft damit physisch nachvollziehbar:

```text
Shackleton Mine
→ Surface Hauler
→ Shuttle-Port Storage
→ Transfer Shuttle
→ Lunar Orbital Interface
→ Cargo Transfer Shuttle -> Depot
→ Cargo Transfer Depot -> Freighter
→ Intersolar Transit -> Phobos
→ Cargo Transfer Freighter -> Phobos Depot
→ Market Offer
→ Ownership Transfer on Sale
```

### Input für NOXIA-CORE

Core soll dafür generisch bereitstellen:

- adressierbare Inventarknoten,
- atomaren/idempotenten Cargo-Transfer,
- Ownership- und Kapazitätsprüfung,
- Reservierungen für Markt und Transportjobs,
- mehrstufige Jobs aus Legs + Handover-Schritten,
- persistente Zuordnung von Ware, Auftrag und Eigentümer.

Orbit baut dafür **keine zweite Transit- oder Inventar-Domain**.

Der Request bleibt `open`, bis die Core-Schnittstelle und die darauf aufbauende Stations-/Phobos-UX implementiert und gemeinsam getestet sind.

## References

- `docs/architecture/orbit-cargo-handover.md`
- `lib/game/logisticsNodes.ts`
- `lib/game/transportDomains.ts`
- `lib/game/core/`
- `external-tasks/open/EXT-OTA-NOXIA-20260906-transfer-logistics-network.md`
