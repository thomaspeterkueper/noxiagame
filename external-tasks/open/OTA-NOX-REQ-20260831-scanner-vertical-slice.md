# OTA → NOXIA Request — Scanner Vertical Slice

**ID:** OTA-NOX-REQ-20260831-scanner-vertical-slice  
**Datum:** 2026-08-31  
**Status:** open  
**Priorität:** high  
**Quelle:** Overtime Archive / KUEPER-Ökosystem  
**Ziel:** noxiagame

## Ziel

Den Scanner als ersten vollständigen, spielbaren First-Person-Vertical-Slice auf dem aktuellen `main` fertigstellen. Der Scanner darf keine zweite Simulation und keinen parallelen Discovery-Stack erzeugen. Er ist eine persönliche Sicht auf denselben kanonischen NOXIA-Zustand.

## Architektur-Invariante

```text
Ground Truth → Measurement → Interpretation → Discovery
```

Diese Kette ist die einzige fachliche Scanner-Pipeline. Rendering, First-Person-Raum und UI konsumieren sie, definieren aber keine eigene Wahrheit.

## Arbeitspaket 1 — Domänenkern

1. Scanner-Domänenkern sauber auf aktuellem `main` implementieren bzw. aus brauchbaren Teilen der verworfenen Scanner-PRs neu portieren.
2. Keine harte Kopplung an eine bestimmte Kartengröße; die aktuelle kanonische Grid-/World-Konfiguration verwenden.
3. `Ground Truth` kommt aus dem bestehenden Simulations-/Weltzustand.
4. `Measurement` modelliert, was der Scanner tatsächlich messen kann.
5. `Interpretation` darf Unsicherheit, Schwellen und Fehlinterpretation abbilden, ohne Ground Truth zu verändern.
6. `Discovery` ist persistierbarer Spielzustand und keine reine UI-Markierung.
7. Domänenlogik darf nicht direkt LocalStorage, Three.js oder React-/UI-Zustand lesen.
8. Deterministische Tests für Pipeline und Persistenzgrenzen ergänzen.

## Arbeitspaket 2 — Persistenz und Initialisierung

1. Bereits persistierte Discoveries beim ersten Render/Start des Scanner-Views laden.
2. Keine Race Condition, bei der ein leerer Initial-State persistierte Discoveries überschreibt.
3. Discovery-State über die bestehende NOXIA-Persistenzgrenze führen; keinen zweiten Speichermechanismus nur für den Scanner etablieren.
4. Wiederholtes Scannen derselben bekannten Struktur muss idempotent sein.

## Arbeitspaket 3 — Scanner-UI

Die Oberfläche soll drei verständliche Ebenen zeigen:

- **Was wurde gemessen?**
- **Was bedeutet die Messung?**
- **Was wurde dadurch entdeckt?**

Zusätzlich:

- Unsicherheit bzw. noch nicht ausreichende Evidenz sichtbar machen.
- Bereits bekannte Discoveries eindeutig von neuen Resultaten unterscheiden.
- `Ergebnis auf Karte anzeigen` mit dem kanonischen Discovery-/World-State verbinden, nicht mit einem separaten UI-Marker.

## Arbeitspaket 4 — First-Person-Scannerraum

1. Scannerraum als persönlicher Zugang zur bestehenden Simulation behandeln.
2. Three.js ausschließlich für Darstellung/Interaktion verwenden.
3. Szene, Renderer, Geometrien und Controls nicht bei jedem Population-Poll oder gewöhnlichen State-Update neu erzeugen.
4. Lifecycle sauber trennen: Scene Setup einmal, fachliche State-Updates inkrementell.
5. Keine Simulation von Ressourcen, Population, Zeit oder Discoveries innerhalb der Three.js-Szene.

## Arbeitspaket 5 — Integration

Der fertige Ablauf soll mindestens sein:

```text
Spieler betritt Scannerraum
→ wählt/aktiviert Scan
→ bestehender World-State liefert Ground Truth
→ Scanner erzeugt Measurement
→ System interpretiert Measurement
→ ggf. neue Discovery entsteht
→ Discovery wird kanonisch persistiert
→ UI erklärt Ergebnis
→ Spieler kann Ergebnis auf der Karte lokalisieren
→ Rückkehr zur normalen Simulation ohne Zustandsverlust
```

## Nicht Teil dieses Requests

- kein zweites Kartensystem
- keine neue Population Engine
- kein neues Ressourcenmodell
- kein neues Balancing
- keine synthetische „eine Anomalie pro Location“-Produktionslogik
- keine hartcodierte 32×24-Annahme
- kein paralleler Scanner-/Discovery-Stack
- keine vollständige Ausgestaltung weiterer First-Person-Gebäude

## Abnahmekriterien

- [ ] `Ground Truth → Measurement → Interpretation → Discovery` ist im Code nachvollziehbar getrennt.
- [ ] Domänenkern ist unabhängig von Three.js und Browser-Persistenz.
- [ ] Persistierte Discoveries sind nach Reload sofort vorhanden.
- [ ] Wiederholtes Scannen erzeugt keine Duplikate.
- [ ] Scannerraum zeigt denselben Simulationszustand wie die normale NOXIA-Oberfläche.
- [ ] `Ergebnis auf Karte anzeigen` referenziert kanonischen World-/Discovery-State.
- [ ] Three.js wird nicht bei normalen Poll-/State-Updates komplett neu initialisiert.
- [ ] Tests decken Pipeline, Idempotenz und Persistenzinitialisierung ab.
- [ ] Build/CI ist grün.
- [ ] Keine Regression im bestehenden Tharsis-Hub-/Population-State.

## Umsetzungshinweis

Die geschlossenen Scanner-PRs können als technische Fundgrube dienen, sind aber **nicht** als Architekturvorgabe zu übernehmen. Gegen den aktuellen `main` neu bewerten und nur passende Teile portieren.

## Folge

Nach erfolgreicher Abnahme dieses Requests dient der Scanner als Referenzmuster für weitere persönliche First-Person-Ansichten (Fahrzeug, Habitat, Forschungseinrichtung), jeweils unter derselben Regel: **eine Simulation, mehrere Sichten.**
