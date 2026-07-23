# NOXIA — Walkable Colony: Designdokument

**Datum:** 20.07.2026
**Status:** Konzept — verbindlich für alle weiteren Implementierungen
**Referenz:** ADR-sundog-prinzip.md

---

## Das Kernprinzip

> Die persönliche Ebene darf nicht zu einem zweites Spiel werden.
> Sie sollte die vorhandene Simulation sichtbar machen.

NOXIA bleibt eine Wirtschaftssimulation. Die Walkable Colony ist
keine RPG-Ebene — sie ist eine **Linse** durch die der Spieler
dieselbe Simulation aus menschlicher Perspektive betrachten kann.

Der Wechsel ist:

```
„Ich verwalte diese Kolonie."
        ↕  (jederzeit, ohne Unterbrechung)
„Ich bin in dieser Kolonie."
```

Die strategische Simulation läuft darunter **unverändert weiter**.

---

## Was die persönliche Ebene zeigt — nicht hinzufügt

### Chemielabor (Beispiel)
```
Makroebene:  Produktions-/Forschungsknoten
             +5 Forschungspunkte/Tick
             Verbraucht: 2t Wasser, 1t Metall

Mikroebene:  Einige der beschäftigten Personen sichtbar
             Behälter mit den Materialien die das Labor verarbeitet
             Engpass sichtbar wenn eine Lieferung fehlt
             → Keine Minispiele
```

### Raumhafen (Beispiel)
```
Makroebene:  Landing Pad × 2, Frachtlager, Terminal

Mikroebene:  Pad 1 (das erste) und Pad 2 (die Erweiterung) stehen dort
             Ein Frachter steht auf Pad 2 weil gerade eine Lieferung angekommen ist
             Menschen gehen zum Terminal
             Das Frachtlager das du daneben gesetzt hast steht tatsächlich dort
             → Keine zusätzliche Logik — alles ist Projektion des Weltzustands
```

### Erster Moment auf einem neuen Himmelskörper
```
Nach Stunden Makrospiel landet der Spieler erstmals auf Europa.
Er steigt selbst aus.
Keine Belohnungsbox. Kein Kampf. Kein Tutorial-Text.
Einfach: Ich bin jetzt hier.
```

---

## Was der Spieler in der persönlichen Ebene tut

Keine Kämpfe. Stattdessen:

- jemanden besuchen und mit ihm sprechen
- ein eigenes Gebäude von innen ansehen
- mit einem Rover fahren
- einen neuen Außenposten erstmals betreten
- eine Mine besichtigen
- einen Frachter übernehmen
- durch eine gewachsene Stadt laufen
- einen Forschungsfund persönlich ansehen
- auf einem neuen Himmelskörper erstmals aussteigen

**Kampf ist nur eine Antwort auf „Was tue ich als Person?"**
NOXIA gibt andere Antworten. Presence statt Action.

---

## Technische Umsetzung

### Was es ist
- Top-Down, 2D, kachel-basiert (wie SunDog Atari ST)
- Figur als kleines Sprite, ~16×16px
- Türen = Übergänge zwischen Bereichen
- Wenige NPCs (deterministische Routinen aus Weltzustand)
- Canvas oder SVG — kein WebGL, kein 3D

### Was es nicht ist
- Kein eigenes Level-System
- Keine Echtzeit-Physik
- Keine Inventar-Verwaltung auf Mikroebene
- Kein zweites Wirtschaftssystem

### NPCs
```
Nur sichtbare NPCs werden konkret dargestellt.
Außerhalb der Sichtweite: Weltzustand (Bevölkerungszahl, Schichtplan).

Ingenieurin in der Werft:
  → Sichtbar weil Werft ausgelastet (Schicht-Auslastung > 80%)
  → Nicht sichtbar wenn Werft leer (Nachtschicht, kein Schiff)

Frachter auf Pad 2:
  → Sichtbar weil gerade eine Lieferung in der DB eingetragen ist
  → Verschwindet wenn Lieferung abgeschlossen
```

**Alles ist Projektion des Weltzustands. Nie eigenständige Logik.**

---

## Betretbare Orte (erste Version)

Priorität 1 — diese vier reichen um zu testen ob das Gefühl entsteht:

| Ort | Warum | Was man sieht |
|-----|-------|---------------|
| **Raumhafen** | Jeder Spieler hat einen | Pads, Frachter (live), Frachtlager, Terminal, NPCs |
| **Akademie/SSF** | Lernmechanik, wichtig | Hörsaal, Lernende, Forschungsbereich |
| **Markt** | Wirtschaftskern | Händler, Lagerbestände (live), Preistafeln |
| **Eigenes Habitat** | Emotionale Verbindung | Wohnbereiche, Bewohner, Gemeinschaftsraum |

Priorität 2 — wenn Priorität 1 das Gefühl erzeugt:
Mine, Fabrik, Chemielabor, Werft, Bank, Kontrollzentrum

---

## Gebäude-Styleguide: Neue Designfrage

Ab sofort bei jedem neuen Gebäude zwei Fragen:

**1. Makro-Frage (bisher):**
Was produziert/konsumiert/ermöglicht dieses Gebäude?

**2. Mikro-Frage (neu):**
Wie erlebt ein Mensch dieses Gebäude?

Beispiel Mine:
```
Makro: +5 Metall/Tick, 2 Arbeitsplätze, 1500 Cr Baukosten
Mikro: Stollen-Eingang (Tür), Lift nach unten, Abbauhalle,
       Förderband zum Lagerraum, 1-2 Bergleute sichtbar
       wenn Schicht aktiv. Geruch von Öl und Stein (Beschreibungstext).
```

Nicht jedes Gebäude braucht sofort einen vollständigen Innenraum.
Aber die Mikro-Frage soll bei jeder Gebäude-Konzeption gestellt werden.

---

## Implementierungsplan

**Phase A — Schiff (✅ erledigt):**
ShipInteriorOverlay — Top-Down-Grundtriss, Figur, Module anklickbar

**Phase B — Kolonie-Ebene:**
Spieler betritt Kolonie. Straßen aus Weltzustand, Gebäude klickbar.
Deterministische NPCs projiziert aus Bevölkerung + Schichtplan.

**Phase C — Erste Innenräume:**
Raumhafen, Akademie, Markt — je ~3 Räume, Türen/Übergänge.
NPCs mit Namen (aus `actors`-ähnlicher Tabelle), einfacher Dialog.

**Phase D — Neuer Himmelskörper:**
Aussteige-Sequenz beim ersten Besuch. Kein Gameplay. Nur Presence.
„Ich bin jetzt hier."

---

## Der entscheidende Test

Wenn Phase B fertig ist, gibt es einen einfachen Test:

> Baut der Spieler anders, weil er weiß dass er es später betreten kann?

Wenn ja: Das Prinzip funktioniert.
Die Simulation und die persönliche Ebene sind dann nicht mehr getrennt.
