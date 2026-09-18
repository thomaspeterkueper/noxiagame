---
id: EXT-NOXIA-ENG-20260918-LUNAR-SURFACE-TO-ORBIT-ASCENT
title: Engineering – Authoritatives Profil für Mondoberfläche → Mondorbit
status: open
source: NOXIA-MOON
 target: KUEPER-ENGINEERING
created: 2026-09-18
priority: high
affects: [NOXIA, Moon, Orbit, Spacecraft, Ascent, Engineering]
---

## Ziel

NOXIA benötigt einen physikalisch belastbaren, explizit referenzierbaren Engineering-Vertrag für den Start eines konkreten Raumfahrzeugs von der Mondoberfläche in einen definierten Mondorbit.

Der Vorgang wird im Spiel als generische Surface-to-Orbit-Ascent-Mission modelliert. Er darf weder als Teleport noch als speziell verdrahteter „zurück zur Erde“-Befehl umgesetzt werden.

## Abgrenzung zu ASCE

`spacecraft/asce` ist derzeit auf Earth -> 400 km LEO -> Earth ausgelegt und bezeichnet Moon/Deep Space ausdrücklich als Nicht-Anforderung. Die dortigen aktuellen P85/SABRE-Werte sind zudem Engineering-Screen-Werte und nicht kanonisch. Sie werden deshalb **nicht** auf den Mond übertragen.

## Benötigte Engineering-Antwort

Für jeden in NOXIA zulässigen lunar surface-to-orbit Fahrzeugrahmen bitte eine eindeutige, versionierte Referenz liefern mit mindestens:

1. exakter `vehicleFrameId` / Engineering-ID;
2. zulässige Startmasse bzw. Massengrenzen und deren Definition;
3. Dry-/wet-mass-Bezug und welche Fracht-/Crew-Massen einzurechnen sind;
4. Antriebssystem und verwendbarer Propellant-/Energiespeicher;
5. für die Missionsbewertung erforderliche Leistungs-/Verbrauchsparameter;
6. verfügbare bzw. zulässige Delta-v-/Reserve-Logik oder ein anderes autoritatives Feasibility-Modell;
7. zulässige Moon departure conditions / Betriebsgrenzen;
8. Zielorbit-Klassen bzw. zulässige lunar-orbit insertion envelopes;
9. Reserve-/Abort-Anforderungen;
10. Quellenstatus pro Wert (`canonical`, `engineering-approved`, `screening`, `unknown`) und konkrete Repository-/Dokumentreferenz.

Falls die Feasibility nicht sinnvoll über einfache Delta-v-Budgets beschrieben werden soll, bitte stattdessen die kanonische Berechnungs-/Resolver-Schnittstelle spezifizieren. NOXIA soll keine vereinfachte Physik erzwingen.

## NOXIA-Core-Vertrag

NOXIA hat bewusst nur die zustandsbezogene Hülle definiert:

```text
surface
  -> ascent-authorized
  -> ascending
  -> orbital-insertion
  -> orbital-arrival
  -> existing arrival-control: arrival-rendezvous
```

Vor `ascent-authorized` müssen mindestens folgende Gates erfüllt sein:

- spacecraft resolved;
- actor authorized;
- spacecraft physically on requested departure surface;
- destination lunar-orbit node resolved;
- no active docking connection;
- no conflicting mission;
- crew ready;
- cargo ready;
- exact Engineering ascent authority available.

Die Engineering-Antwort soll keine neue NOXIA-Zustandsmaschine definieren, sondern die physikalische Freigabe dieses Übergangs liefern.

## Acceptance Criteria

1. Keine ASCE-/Earth-Werte werden implizit auf den Mond übertragen.
2. Ein exakter Fahrzeugrahmen kann deterministisch als lunar-ascent-capable oder nicht freigegeben aufgelöst werden.
3. Gesamtmasse/Fracht/Crew werden physikalisch korrekt berücksichtigt.
4. Propellant/Energie und Reserve sind explizit statt als versteckter Gameplay-Wert definiert.
5. Zielorbit bzw. Orbitklasse ist Teil der Feasibility-Bewertung.
6. Alle verwendeten Werte haben nachvollziehbare Engineering-Quellen/Status.
7. Fehlende Daten führen zu `unavailable`, nicht zu erfundenen Defaultwerten.

## NOXIA-Referenzen

- `lib/game/ascentControl.ts`
- `lib/game/arrivalControl.ts`
- `lib/game/core/dockingPersistence.ts`
- `app/api/game/docking/route.ts`
