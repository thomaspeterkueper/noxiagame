# Orbit Cargo Handover — Shuttle, Depot, Frachter und Phobos Free Port

**Stand:** 2026-09-11  
**Status:** Canonical Orbit/Stations policy  
**Scope:** NOXIA Orbit/Stations; Input für NOXIA Core

## Ziel

Die NOXIA-Logistikkette soll Fracht ohne implizite Teleportation über mehrere physische Transportdomänen bewegen können:

```text
Surface origin
→ surface storage / shuttle port
→ transfer shuttle
→ orbital interface / depot
→ intersolar freighter
→ orbital destination
→ depot / market / onward transport
```

Dabei bleiben **Docking** und **Frachttransfer** zwei bewusst getrennte Vorgänge.

## 1. Grundinvariante: Docking ist nicht Cargo-Transfer

Ein Schiff oder Shuttle kann an einer Station bzw. einem Depot angedockt sein, ohne dass sich irgendein Inventar ändert.

Docking beantwortet ausschließlich:

- welches Fahrzeug mit welchem Dock/Port verbunden ist,
- ob eine physische Transferverbindung verfügbar ist,
- ob Crew-/Cargo-Operationen grundsätzlich möglich sind,
- ob ein Dock belegt oder frei ist.

Ein Cargo-Transfer ist danach eine eigene Aktion bzw. ein eigener Auftrag mit:

- `source_inventory`
- `target_inventory`
- Ware / Ressource
- Menge
- Autorisierung / Ownership
- Kapazitätsprüfung
- optional Transferdauer / Umschlagrate
- Status (`planned`, `active`, `complete`, `failed` o. ä.)

Folge: `docked = true` darf niemals automatisch `cargo moved` bedeuten.

## 2. Drei Inventarrollen im Orbit

Für den Orbit werden fachlich mindestens drei Rollen benötigt. Sie müssen nicht zwangsläufig drei neue Tabellen bedeuten; Core entscheidet über die technische Repräsentation.

### A. Vehicle inventory

Inventar eines Transfer-Shuttles oder intersolaren Frachters.

Beispiele:

- ASCE 0.3P kommt mit 18 t Metall aus Shackleton hoch.
- Frachter liegt am Orbitaldepot und hat 240 t freie Kapazität.

### B. Station/depot inventory

Persistentes Lager eines orbitalen Interfaces, einer Station oder eines Depots.

Das Depot ist **kein Fahrzeug**. Ware kann dort liegenbleiben, während Shuttle oder Frachter längst wieder abgeflogen sind.

Das entkoppelt Fahrpläne und ermöglicht echte Logistiknetze statt synchroner Fahrzeugketten.

### C. Market inventory / offered stock

Handelbarer Bestand eines Marktortes. Physischer Lagerbestand und Marktangebot sind fachlich getrennt:

- Ware kann im Depot liegen, ohne angeboten zu werden.
- Ein Marktauftrag reserviert oder referenziert Ware aus einem zugelassenen Lager.
- Verkauf verändert Eigentum und anschließend ggf. den physischen Zielbestand, aber nicht durch bloßes Docking.

## 3. Shuttle-Handover am orbitalen Interface

Referenzablauf Mond:

```text
Shackleton Mine
→ Surface Hauler
→ Shuttle-Port Storage
→ ASCE 0.3P laden
→ Shuttle startet
→ Lunar Orbital Interface
→ Shuttle dockt
→ Cargo-Transfer Shuttle → Depot
→ Shuttle kann wieder zur Oberfläche zurückkehren
```

Wichtig: Das Orbitalinterface ist ein eigener logistischer Knoten, auch wenn die heutige Runtime aus Kompatibilitätsgründen weiterhin einen aggregierten Location-Slug wie `moon` verwendet.

### Zulässige Aktionen nach Docking

- `Unload to depot`
- `Load from depot`
- `Transfer to docked vessel` nur, wenn ein direkter Fahrzeug-zu-Fahrzeug-Transfer technisch/operativ freigegeben ist
- `No cargo action / depart`

Default-UX soll **Depot als sicheren Zwischenpuffer** bevorzugen. Direkter Shuttle→Frachter-Transfer ist eine Optimierung, nicht die einzige Funktionsweise.

## 4. Orbitaldepot als echter Knoten

Ein Orbitaldepot braucht mindestens diese Eigenschaften:

- persistentes Inventar,
- Lagerkapazität,
- Umschlagfähigkeit / Transferzugänge,
- Docking-Ports als separate Ressource,
- Ownership bzw. Betreiber,
- Zugriffs-/Handelsregeln,
- optional Gebühren für Lagerung, Docking und Umschlag.

Ein Depot kann damit gleichzeitig:

1. Shuttle-Fracht puffern,
2. Frachter beladen,
3. eingehende intersolare Fracht aufnehmen,
4. Marktbestand hosten,
5. Fracht für spätere Legs reservieren.

## 5. Umladen Shuttle → Depot → Frachter

Der kanonische Standardweg ist zweistufig:

```text
Transfer 1: Shuttle inventory → Depot inventory
Transfer 2: Depot inventory → Freighter inventory
```

Vorteile:

- Shuttle und Frachter müssen nicht gleichzeitig vorhanden sein.
- Teilmengen sind möglich.
- mehrere Shuttle-Flüge können eine Frachterladung akkumulieren.
- ein Frachter kann Ladung aus mehreren Quellen konsolidieren.
- Ownership und Marktlogik bleiben nachvollziehbar.

### Direkter Cross-Dock-Transfer

Optional darf später gelten:

```text
Shuttle A docked
Freighter B docked
→ direct cargo transfer A → B
```

aber nur als expliziter Cargo-Transfer mit denselben Prüfungen. Auch hier gilt: zwei gedockte Fahrzeuge bedeuten nicht automatisch Umladen.

## 6. Phobos als Markt- und Free-Port-Knoten

`phobos` ist kein Mars-Surface-Port, sondern ein orbitaler Handels- und Transferknoten. Die bestehende `LOGISTICS_NODES`-Semantik `orbital-station / node-itself` bleibt richtig.

Phobos erhält fachlich vier Rollen:

### 6.1 Interplanetarer Umschlagpunkt

Frachter aus Erde/Mond-System, Mars-Orbit und später weiteren Zielen können Phobos direkt anlaufen. Kein impliziter Mars-Landevorgang folgt auf die Ankunft.

### 6.2 Depot

Fracht kann auf Phobos gelagert, konsolidiert, gesplittet und für weitere Routen reserviert werden.

### 6.3 Markt

Spieler können physisch vorhandene Ware am Phobos-Knoten anbieten und kaufen. Besonders sinnvoll:

- Metalle,
- Komponenten,
- Energie-/Treibstoffträger,
- Maschinen/Industriegüter,
- später spezialisierte Mars-/Asteroidenwaren.

Der Markt ist damit kein abstraktes globales Auktionshaus, sondern hat einen **Ort** und einen **physischen Warenfluss**.

### 6.4 Free Port

„Free Port“ bedeutet im NOXIA-Kontext zunächst spielmechanisch:

- offener Zugang für mehrere Betreiber,
- neutrale bzw. breit zugängliche Dock-/Depotdienste,
- Handel zwischen voneinander unabhängigen Spielern/Organisationen,
- keine automatische Bindung an eine Mars-Oberflächenkolonie,
- mögliche eigene Gebühren- und Governance-Regeln.

Es bedeutet ausdrücklich **nicht**, dass Eigentum, Gebühren, Recht oder Zugangskontrolle aufgehoben sind.

## 7. Phobos-Verkaufsablauf

Beispiel Metallexport vom Mond:

```text
1. Metall wird in Shackleton produziert.
2. Surface Hauler bringt es zum Shuttle-Port Storage.
3. Spieler lädt ein Transfer-Shuttle.
4. Shuttle fliegt zum Lunar Orbital Interface.
5. Shuttle dockt.
6. Spieler transferiert Metall ins Orbitaldepot.
7. Intersolarer Frachter dockt am Depot.
8. Spieler transferiert Metall Depot → Frachter.
9. Frachter fliegt nach Phobos.
10. Frachter dockt in Phobos.
11. Spieler transferiert Metall Frachter → Phobos Depot.
12. Spieler stellt Menge X aus dem Depot am Phobos Market ein.
13. Käufer erwirbt die Ware.
14. Eigentumswechsel wird verbucht; physischer Bestand liegt weiterhin in Phobos, bis Käufer ihn weitertransferiert.
```

Schritte 5/6, 7/8 und 10/11 sind jeweils bewusst getrennt.

## 8. UX-Modell

Station-/Depot-UI sollte die Zustände sichtbar trennen.

### Docking panel

Zeigt:

- freie/belegte Ports,
- angedockte Shuttle/Frachter,
- Dockingstatus,
- `Dock` / `Undock`.

Keine Cargo-Mengenänderung in diesem Panel.

### Cargo panel

Zeigt nebeneinander:

```text
[Vehicle]  ⇄  [Station / Depot]
```

mit:

- Ressource,
- verfügbare Menge,
- Zielkapazität,
- Mengenwahl,
- `Laden`, `Entladen`, `Transfer starten`.

Bei zwei kompatibel angedockten Fahrzeugen kann ein dritter Transferpfad angeboten werden.

### Market panel auf Phobos

Zeigt nur Bestände, die am Phobos-Knoten physisch verfügbar bzw. reservierbar sind.

Aktionen:

- `Im Depot lagern`
- `Zum Verkauf anbieten`
- `Angebot zurückziehen`
- `Kaufen`
- `In eigenes Schiff laden`
- `Für Weitertransport reservieren`

## 9. Mehrstufige Transportaufträge

Orbit liefert an Core folgende fachliche Anforderung:

Ein Transportauftrag muss zukünftig mehrere Legs und Handover-Schritte beschreiben können, ohne die vorhandene Transit-Zustandsmaschine zu duplizieren.

Beispiel:

```text
Leg 1  surface-haul      Mine → Shuttle-Port
Leg 2  shuttle-transit   Shuttle-Port → Lunar Orbital Interface
H/O    cargo-transfer    Shuttle → Depot
Leg 3  intersolar        Lunar Interface → Phobos
H/O    cargo-transfer    Freighter → Phobos Depot
Final  market/storage
```

Ein Leg bewegt ein Fahrzeug oder einen Surface-Transport. Ein Handover bewegt Fracht zwischen Inventaren. Diese beiden Begriffe dürfen im Datenmodell nicht vermischt werden.

## 10. Anforderungen an Core

Orbit benötigt vom gemeinsamen Core keine zweite Domain, sondern generische Fähigkeiten:

- adressierbare Inventarknoten,
- atomaren Cargo-Transfer zwischen zwei zugelassenen Inventaren,
- Kapazitäts- und Ownership-Prüfung,
- Reservierung für Markt/Transportauftrag,
- Transportjobs mit mehreren Legs + Handover-Schritten,
- persistente Verbindung von Auftrag, Ware und Eigentümer,
- idempotente Commands, damit Wiederholungen keinen doppelten Transfer erzeugen.

## 11. Nicht Teil dieser Policy

Nicht hier definieren:

- konkrete DB-Tabellen,
- API-Endpunkte,
- Frachter-/Shuttle-Leistungsdaten,
- konkrete Transfergeschwindigkeiten,
- Gebühren-Balancing,
- Surface-Routing.

Diese Policy definiert Semantik und UX-Grenzen, damit Core und Orbit dieselben Begriffe verwenden.

## 12. Akzeptanzprüfung

Die Policy erfüllt den Request, wenn:

- Oberfläche → Shuttle → Orbitaldepot → Frachter → Phobos ohne implizite Teleportation modellierbar ist,
- Docking keine Ware bewegt,
- Cargo-Transfer immer explizit ist,
- Depotbestände Fahrzeuge zeitlich entkoppeln können,
- Phobos Markt, Depot und neutraler Free-Port-Knoten sein kann,
- bestehende Transit- und Transportdomain-Semantik weiterverwendet wird.

## Bestehende Anker

- `lib/game/logisticsNodes.ts`
- `lib/game/transportDomains.ts`
- `lib/game/core/transit.ts`
- `lib/game/core/commands.ts`
- `external-tasks/open/EXT-NOXIA-ORBIT-20260911-cargo-handover.md`
