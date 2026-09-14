# ADR: World Development / Makrosysteme

**Datum:** 14.09.2026  
**Status:** Accepted  
**Gilt für:** NOXIA 2045–2125, Erde, Mond, Mars, Orbit und spätere Himmelskörper

## Entscheidung

NOXIA modelliert Zukunftsentwicklung nicht als festgeschriebene Vorhersage und nicht als linearen Technologiebaum. Stattdessen erhält die Simulation eine gemeinsame **World-Development-Schicht** aus sechs Makrosystemen:

1. **Knowledge & Technology**
2. **Energy & Industry**
3. **Economy & Logistics**
4. **Population & Society**
5. **Climate & Biosphere**
6. **Governance & Institutions**

Die Schicht beschreibt Kapazitäten und Belastungen, die aus bereits autoritativen Spielzuständen, ausdrücklich gesetzten Szenarioannahmen und später wissenschaftlich begründeten Projektionen abgeleitet werden.

Sie ist **keine zweite Simulation Truth**. Persistente Ressourcen, Gebäude, Fahrzeuge, Einwohner, Markttransaktionen, Reisen, Forschung/Unlocks und Ticks bleiben in ihren bestehenden Core-/Domain-Systemen autoritativ.

## Leitprinzip

> NOXIA sagt nicht vorher, welche Zukunft eintritt. NOXIA bildet ab, welche Zukunft aus welchen materiellen, sozialen, ökologischen und institutionellen Bedingungen entstehen kann.

Damit wird Zukunft nicht durch Skript-Ereignisse erzeugt, sondern durch Kausalität.

## Warum diese Ebene nötig ist

Die bestehenden Systeme modellieren bereits reale Orte, Gebäude, Ressourcen, Inventare, Eigentum, Transport, Forschung, Population und Zeit. Zwischen diesen Einzelsystemen fehlt jedoch eine Ebene, die langfristige Entwicklungen wie Netzausbau, Automatisierung, Wasserstress, Demografie, Orbitalwirtschaft oder ISRU als gemeinsame Weltbedingungen ausdrücken kann.

Ohne eine solche Ebene entstehen zwei problematische Extreme:

- Zukunft bleibt bloße Lore ohne spielmechanische Wirkung;
- oder einzelne Features bekommen isolierte globale Boni, die keine physische Ursache haben.

Die World-Development-Schicht schließt genau diese Lücke.

## Keine pauschalen Zukunftsboni

Explizit verworfen werden Mechaniken wie:

- `KI Level 7 -> +15 % Produktion weltweit`
- `Quantencomputer -> klassische Computer obsolet`
- `Fusion freigeschaltet -> Energieknappheit beendet`
- `Marskolonie gegründet -> Weltraumwirtschaft wächst automatisch`

Stattdessen müssen Wirkungen über konkrete Engpässe laufen.

Beispiele:

- hohe Automation ohne ausreichende Energie-, Wartungs- oder Cyberkapazität erzeugt keinen beliebigen Produktivitätsbonus;
- Fusion benötigt eine reale Brennstoff-, Material-, Wartungs- und Netz-/Verteilkette;
- Orbitalindustrie benötigt Launch, Docking, Depots, Werften, Transportkapazität und reale Inventare;
- ISRU reduziert Erdabhängigkeit nur dort, wo tatsächlich gewonnen, verarbeitet, gelagert und transportiert wird;
- Klimastress wirkt über konkrete Standort-, Wasser-, Infrastruktur- und Populationssysteme.

## Sechs Makrosysteme

### 1. Knowledge & Technology

Enthält unter anderem:

- KI und Robotik;
- Compute-Infrastruktur;
- Forschungskapazität;
- Biotechnologie;
- später spezialisierte Quantentechnologien.

Quantencomputer werden als spezialisierte Rechenressource behandelt, nicht als vollständiger Ersatz klassischer Rechner.

### 2. Energy & Industry

Enthält unter anderem:

- Netzkapazität;
- Speicher und gesicherte Leistung;
- industrielle Fertigungstiefe;
- kritische Rohstoffe;
- Wartung und Ersatzteilfähigkeit;
- Kreislaufwirtschaft;
- spätere Fusionsreife.

Energieerzeugung und nutzbare Energie sind ausdrücklich nicht dasselbe. Netze, Speicher, Betriebsstabilität und lokale Versorgung bleiben Engpässe.

### 3. Economy & Logistics

Enthält unter anderem:

- Oberflächenlogistik;
- Depots und Warenströme;
- Launch- und Orbitaldurchsatz;
- Docking und Servicing;
- ISRU;
- geschlossene Lebenserhaltung;
- langfristig Lagrange-, Asteroiden- und interplanetare Logistikknoten.

Die Weltraumwirtschaft wächst nicht durch einen abstrakten Prozentwert, sondern durch Infrastruktur, Durchsatz und sinkende Abhängigkeit von Erdstarts.

### 4. Population & Society

Enthält unter anderem:

- Qualifikation und Redundanz von Fähigkeiten;
- Demografie und Migration;
- Haushalte, Crews und Gemeinschaften;
- soziale Kohäsion;
- Ernährungssicherheit;
- langfristige Siedlungsfähigkeit.

Menschen sind nicht nur `Workers`. Haushalte, Beziehungen, Verpflichtungen und Gemeinschaft werden später als eigene Populationsebene modelliert, ohne daraus einen Beziehungssimulator zu machen.

### 5. Climate & Biosphere

Enthält unter anderem:

- Klimastress;
- Wasserverfügbarkeit;
- Hitze, Dürre, Feuer und Überflutung;
- Boden-/Landproduktivität;
- langfristige Standortkosten und Landwert.

Es wird **kein fester Temperaturpfad** als kanonische Zukunft vorgeschrieben. Klimazustände sind Szenario-/Weltzustände und können je nach Entwicklung unterschiedlich verlaufen.

### 6. Governance & Institutions

Enthält unter anderem:

- institutionelle Leistungsfähigkeit;
- Cyberresilienz;
- Informationsvertrauen;
- Rechtsrahmen für Ressourcen, Besitz, Haftung und Infrastruktur außerhalb der Erde.

Diese Ebene ist notwendig, weil hochautomatisierte Infrastruktur nicht nur technisch, sondern auch institutionell betrieben werden muss.

## Baseline-Zeitphasen

Die Zeitphasen sind **Entwicklungsrahmen, keine garantierten Ereignisse**.

| Zeitraum | Baseline-Charakter |
| --- | --- |
| 2045–2059 | Elektrifizierung, Netzausbau, KI/Robotik, Klimaanpassung, kommerzielles Orbitwachstum |
| 2060–2079 | robotischer Off-world-Bootstrap, Mond-ISRU, Depots, Servicing, frühe größere Marsinfrastruktur |
| 2080–2099 | Earth–Moon-Industriesystem, Orbitalwerften, größere Siedlungen, geschlossene Stoffkreisläufe |
| 2100–2125 | Sonnensystem-Logistik, Lagrange-Knoten, Asteroidenressourcen, spezialisierte Off-world-Industrie |

Ein Spieler- oder NPC-System kann diesen Verlauf beschleunigen, abbremsen, regional verschieben oder teilweise scheitern lassen.

## Source-of-Truth-Regel

World Development darf autoritative Systeme nur **beobachten oder über deren offizielle Commands beeinflussen**.

Beispiele:

- Ressourcenzustand bleibt in Core-Inventaren;
- Marktpreise bleiben Marktresultate;
- Produktionsmengen bleiben Produktionsresultate;
- Reise- und Frachtzustand bleibt Transit-/Logistikzustand;
- Gebäude bleiben Build-State;
- Population bleibt Population-State;
- Wissen/Unlocks bleiben im Research-/Knowledge-System;
- Spielzeit und Replays bleiben im Core-Tick-/Event-System.

Die World-Development-Schicht darf daraus Signale ableiten, aber nicht dieselben Zustände separat persistieren.

## Signalmodell

Ein Makrosignal besitzt mindestens:

- einen eindeutigen Driver;
- eine Domäne;
- Polarität `capacity` oder `pressure`;
- einen normierten Wert 0..1;
- einen nachvollziehbaren `sourceRef`.

Ein Signal ohne Herkunft darf nicht still erfunden werden.

Beispiel:

```text
core:grid-snapshot
    -> grid_capacity = 0.42
    -> World Development: constrained
    -> UI/Planung erkennt Netz als Engpass
    -> tatsächlicher Netzausbau weiterhin über bestehende Build-/Resource-/Economy-Commands
```

## Gameplay-Wirkung

World Development darf künftig vier Arten von Wirkung erzeugen:

1. **Sichtbarkeit:** Engpässe, Risiken und Chancen werden erklärbar dargestellt.
2. **Planung:** NPCs und Spieler können aus denselben Weltbedingungen Entscheidungen ableiten.
3. **Voraussetzungen:** Ein Domain-System darf einen Makrozustand als zusätzliche reale Voraussetzung verwenden, wenn dafür ein konkreter Gameplay-Consumer existiert.
4. **Folgewirkungen:** Bestehende Systeme dürfen auf Makrosignale reagieren, aber nur über ihre eigenen autoritativen Mutationspfade.

Nicht zulässig ist ein globales, nicht rückverfolgbares `+X %` ohne konkrete Ursache.

## Erste Driver

Der erste Registry-Satz umfasst:

- AI/automation
- compute infrastructure
- research capability
- biotechnology
- grid capacity
- firm energy
- fusion maturity
- industrial depth
- maintenance capacity
- circularity
- critical material security
- surface logistics
- orbital logistics
- ISRU maturity
- closed-loop life support
- skills depth
- demographic pressure
- social cohesion
- food security
- water security
- climate stress
- institutional capacity
- cyber resilience
- information trust
- resource-law framework

Diese Registry ist bewusst breiter als ein Technologiebaum: Sie enthält physische, gesellschaftliche und institutionelle Bedingungen.

## Implementierungsregel

Neue Makro-Driver werden nur eingeführt, wenn mindestens ein konkreter Consumer benannt werden kann. Ein Driver darf nicht allein deshalb entstehen, weil er futuristisch interessant klingt.

Persistenz wird erst eingeführt, wenn ein produktiver Consumer einen Zustand benötigt, der nicht reproduzierbar aus bestehenden Quellen abgeleitet werden kann.

## Konsequenz für NOXIA

Die langfristige Progression lautet nicht mehr nur:

```text
Science -> Technology -> Buildings -> More Production
```

sondern:

```text
Knowledge/Technology
        +
Energy/Industry
        +
Economy/Logistics
        +
Population/Society
        +
Climate/Biosphere
        +
Governance/Institutions
        -> konkrete Weltbedingungen
        -> Entscheidungen
        -> Core-Aktionen
        -> neuer Weltzustand
```

Damit wird die Sonnensystemwirtschaft nicht zum dekorativen Endgame, sondern zur emergenten Folge einer langen materiellen Entwicklung.
