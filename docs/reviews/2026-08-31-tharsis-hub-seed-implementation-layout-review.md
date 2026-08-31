# Tharsis Hub — Implementierungs-/Layout-Review des Start-Seeds

**Datum:** 2026-08-31  
**Scope:** `lib/game/seeds/tharsisHubSeed.ts`, `tharsisHubValidation.ts`, `generateGrid.ts`, Migration `20260830190000_tharsis_hub_start_seed.sql`, OTA-Handoff `OTA-NOX-REQ-20260830-THARSIS-HUB-START-SEED`  
**Status:** Review abgeschlossen — Korrekturen vor weiterer Layout-Verfeinerung empfohlen

## Kurzurteil

Der neue Seed ist architektonisch deutlich besser als das alte Mars-Layout: das prozedurale Mars-Straßennetz ist für `mars` deaktiviert, Startbestand ist staatlich, das alte Layout wird ersetzt, Fahrwege und Mediennetze sind getrennte Datenmodelle und die OTA-Objektklassen sind vollständig abgebildet.

Für einen belastbaren kanonischen Startzustand bestehen jedoch zwei Blocker und mehrere wichtige Modellierungsfragen. Insbesondere sind die als `Utility Ring A/B` bezeichneten Netze in der aktuellen Koordinatenrepräsentation keine zusammenhängenden Ringe, und die Redundanzprüfung ist nicht medienspezifisch.

## Bestanden

1. **Altes prozedurales Mars-Straßennetz ersetzt.** `generateGrid()` ruft für `mars` ausschließlich `addSeedRoadNetwork()` auf; `addRoadNetwork()` bleibt nur für andere Orte aktiv.
2. **Staatliches Eigentum sauber umgesetzt.** Bestehendes Modell `owner_class='STATE'`, `is_state_owned=true`, `owner_id=NULL`; keine neue Owner-Identität.
3. **Kanonischer Seed statt parallelem Altbestand.** Die Migration entfernt alten STATE/NPC/CORPORATION-Seedbestand auf Mars, schützt PLAYER-Bestand und definierte laufende Staatsservices.
4. **Fahrwege und Utilities getrennt.** Straßen sind persistente `tile_entities`; Utilities liegen separat in `location_utilities`.
5. **Objektzahlen entsprechen dem OTA-Handoff.** 6 Habitatcluster, 3 ECLSS-Hubs, 6 Reaktormodule, 3 Black-Start-Knoten, 3 Wasserstränge, 5 Radiatorfelder etc.
6. **Explizite Tests vorhanden.** Counts, Ownership, Straßengraph, Utility-Links und Zonen werden deterministisch geprüft.

## BLOCKER 1 — Utility A/B sind topologisch nicht zusammenhängend

Die Arrays `THARSIS_HUB_UTILITY_RINGS[].nodes` werden als physisch getrennte Netze/Ringe beschrieben, enthalten aber zahlreiche nicht 4-verbundene Sprünge bzw. Lücken.

Beispiele Ring A:
- `(12,19) -> (13,20)` ist diagonal.
- `(16,20) -> (18,20)` überspringt `(17,20)`.
- `(14,26) -> (12,26)` überspringt `(13,26)`.
- `(20,8) -> (20,5)` überspringt zwei Zellen.
- `(8,26) -> (5,25)` ist kein zusammenhängender Pfad.

Beispiele Ring B:
- `(10,6) -> (9,7)` diagonal.
- `(9,7) -> (8,6)` diagonal.
- `(5,3) -> (4,1)` überspringt eine Spalte.
- `(8,27) -> (6,28)` überspringt eine Zeile.
- `(19,22) -> (21,23)` ist weder orthogonal noch benachbart.

`validateUtilityNetworks()` prüft aktuell nur, ob Link-Knoten in der jeweiligen Knotenmenge existieren. Es prüft **nicht**, ob Ring A oder B als Graph zusammenhängend ist.

### NOXIA-Korrektur

- Utility-Netze als echten Graphen modellieren: orthogonale Kanten oder explizite Edge-Liste.
- Für A und B jeweils Connectivity-Test ergänzen.
- Für echte Ring-/N-1-Resilienz zusätzlich prüfen, ob der Backbone nach Ausfall eines einzelnen Knotens/Segments weiterhin die geforderten kritischen Bereiche versorgen kann.
- Wenn die Koordinaten nur abstrakte Marker sein sollen, darf das Objekt nicht `Ring`/physischer Pfad heißen; dann fehlt weiterhin die tatsächliche physische Trasse.

## BLOCKER 2 — Redundanz wird pro Ring, nicht pro Medium geprüft

Aktuell trägt Ring A:

`power, data, water, o2, gas`

Ring B trägt:

`power, data, water, o2, wastewater, thermal`

Damit existieren:
- `gas` nur auf A,
- `wastewater` nur auf B,
- `thermal` nur auf B.

Trotzdem gilt ein Objekt in `validateUtilityNetworks()` bereits als doppelt versorgt, sobald es einen Link zu A und einen Link zu B besitzt. Der Test prüft nicht, ob das **benötigte Medium** tatsächlich redundant ankommt.

### NOXIA-Korrektur

- Mediumspezifische Anforderungen je Objektklasse definieren.
- Für jedes kritische Medium prüfen: zwei unabhängige Pfade oder explizit begründete Nicht-Redundanz.
- `UtilityLink` sollte nicht automatisch alle Medien des Rings erben, wenn das physisch nicht stimmt.

### OTA-Klärung erforderlich

OTA soll festlegen, welche Medien für Habitat/ECLSS/Medizin/Energie zwingend N-1 redundant sein müssen und welche bewusst nur einfach geführt werden dürfen.

## HIGH — Objekt-zu-Ring-Verbindungen sind nur logische Verweise

`THARSIS_HUB_UTILITY_LINKS` verbindet Objekte mit teilweise deutlich entfernten Ringknoten, modelliert aber keinen physischen Feeder zwischen Objekt und Backbone.

Beispiele:
- `habitat_cluster_1` liegt bei `(14,13)`, A-Link ist `(11,13)`, B-Link `(13,8)`.
- `medical_core` liegt bei `(14,16)`, B-Link ist `(14,8)`.

Damit beweist der Link derzeit nur eine deklarierte Beziehung, nicht eine physisch zusammenhängende Trasse.

### NOXIA-Korrektur

Feeder-Leitungen als Kanten/Pfade modellieren oder Anschlussknoten an/nahe dem Objekt setzen und bis zum Backbone vollständig führen.

## HIGH — Fahrwegenetz ist wahrscheinlich stärker ausgebaut als die Leitregel verlangt

Der aktuelle Startzustand besitzt **111 Fahrweg-Tiles** auf einem 32×24-Grid. Die Ursache ist nicht nur der innere Service-Ring, sondern die Umsetzung der N-1-Prüfung: Nach Ausfall eines beliebigen Straßentiles muss jeder Habitatcluster weiterhin über den Straßengraphen ein Energie- und Wasserobjekt erreichen.

Das vermischt zwei unterschiedliche Resilienzebenen:

- **Versorgungskontinuität** gehört primär in Strom-/Wasser-/Daten-/ECLSS-Netze.
- **Fahrwege** werden für Rettung, Wartung, Fracht und Zugang benötigt.

Wenn jeder Energie-/Wasserpfad zugleich straßenseitig N-1 ausgelegt wird, entsteht zwangsläufig ein für eine minimale Basiskolonie sehr dominantes Straßennetz.

### OTA-Klärung erforderlich

Den Satz „Sperrung eines einzelnen Ring-/Korridorsegments darf nicht gleichzeitig sämtliche Wege zu Energie und Wasser abschneiden“ präzisieren: Ist damit wirklich Fahrzeugzugang zu Anlagen gemeint oder technische Versorgung über Utility-Netze? Für NOXIA sollte Rettungs-/Wartungserreichbarkeit getrennt von Medien-N-1 getestet werden.

## HIGH — ECLSS-Failover wird nicht nachgewiesen

OTA fordert: zwei von drei ECLSS-Hubs müssen im degradierten Betrieb den kolonieweiten Mindest-O2-/CO2-Bedarf tragen können.

NOXIA modelliert dagegen lediglich `servesClusters` mit exakt zwei Clustern pro Hub. Die Tests prüfen nur diese 2er-Zuordnung. Eine Cross-Feed-/Failover-Struktur zu den übrigen Clustern und eine Mindestkapazität bei Ausfall eines Hubs werden nicht geprüft.

### NOXIA-Korrektur

- nominale Zuordnung von Failover-Erreichbarkeit trennen;
- ECLSS-Hubs mit Kapazitäts-/Failover-Metadaten versehen;
- Test: beliebiger einzelner Hub fällt aus, verbleibende zwei erreichen alle sechs Cluster und erfüllen den definierten degradierten Mindestbetrieb.

## MEDIUM — 504 Plätze sind keine nachgewiesene Evakuierungsreserve

6 × 84 = 504 bei 497 Bewohnern bedeutet nur sieben freie nominale Plätze. Wird ein kompletter 84er-Cluster unbewohnbar, reichen die fünf übrigen Cluster nominal nicht für 497 Personen.

Das kann trotzdem technisch plausibel sein, **wenn** Safe-Haven-Flächen temporäre Überbelegung erlauben. Diese Fähigkeit ist im Seed derzeit jedoch nicht quantifiziert oder getestet.

### OTA/SSF-Klärung

- unterscheiden zwischen nominalen Wohnplätzen und temporärer Safe-Haven-/Evakuierungskapazität;
- keine zusätzliche Wohnsiedlung voraussetzen, aber temporäre Notbelegung als eigene technische Eigenschaft modellieren, falls vom Kanon gewollt.

## MEDIUM — Pflanzenmodul widerspricht der Minimalitätsfrage zumindest semantisch

Der Seed enthält ein `plant_module`, dessen eigene Beschreibung ausdrücklich sagt: „nicht überlebenskritisch“. Gleichzeitig gilt für die staatliche Startkolonie die Leitregel, nur technisch/sicherheitsbedingt notwendige Infrastruktur zu bauen.

Der OTA-Handoff verlangt dieses Modul ausdrücklich; daher ist dies **kein reiner NOXIA-Fehler**, sondern eine Architekturentscheidung, die OTA bestätigen oder korrigieren muss.

Empfehlung: Wenn Frischproduktion für Gesundheit, Kreislaufführung oder Missionsbetrieb als notwendig gilt, Begründung im OTA-Dossier explizit machen. Andernfalls in die erste Ausbauphase verschieben.

## MEDIUM — Energieannahme muss als Annahme sichtbar bleiben

Der Seed setzt sechs Reaktormodule mit `nominalPowerMw: 1.25` und validiert 7–8 MW Gesamtnennleistung. Der OTA-Handoff erlaubt ca. 7–8 MW Architektur, während SSF die Lastbänder weiterhin als Architekturannahme führt.

Empfehlung: `nominalPowerMw` nicht als realwissenschaftlich gesicherten Wert behandeln. In UI/Knowledge-Projektion Herkunft und epistemischen Status erhalten; Game-Balance (`energy: 8`) davon strikt trennen.

## MEDIUM — doppelte Quelle TS + SQL braucht stärkeren Drift-Schutz

`tharsisHubSeed.ts` ist als kanonische Quelle bezeichnet, die SQL-Migration wurde daraus generiert. Die aktuellen Tests prüfen unter anderem Stückzahlen und Ownership, aber die technische Projektion sollte zusätzlich sicherstellen, dass Koordinaten/Objekt-IDs/Utility-Knoten exakt aus derselben Quelle stammen.

Empfehlung:
- SQL aus TS automatisiert erzeugen oder
- Snapshot-/Hash-/exakter Datenvergleich in Tests.

## Review-Priorität

### P0 vor weiterem visuellen Layout-Tuning
1. Utility A/B tatsächlich zusammenhängend machen.
2. Mediumspezifische Redundanz modellieren und testen.
3. Physische Feeder vom Objekt zum Backbone abbilden.

### P1 danach
4. ECLSS-N-1-Failover testbar machen.
5. Fahrwegenetz nach OTA-Klärung auf wirklich notwendige Rettungs-/Wartungs-/Frachtwege reduzieren.
6. Safe-Haven-Kapazität und Pflanzenmodul klären.

### P2
7. Energie-Epistemik und TS→SQL-Drift-Schutz verbessern.
8. Erst danach visuelles Feintuning der Straßen und Gebäudepositionen.

## Verteilung

Aus diesem Review entstehen getrennte Folgeaufträge:

- **NOXIA:** Graph-/Validierungs-/Layoutkorrekturen.
- **OTA:** Kanonische Klärung von Fahrweg-N-1, Utility-Redundanz, Pflanzenmodul, Safe-Haven und ECLSS-Failover.
- **SSF:** nur die realwissenschaftlichen Teilfragen Safe-Haven/temporäre Überbelegung und technische Redundanzprinzipien; keine Spielwerte.
- **KG:** derzeit kein Änderungsbedarf; es entstehen noch keine neuen stabilen Identitäten.