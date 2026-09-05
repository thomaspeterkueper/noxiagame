# ADR: Walkable Colony — Architektur-Invarianten

**Datum:** 20.07.2026  
**Aktualisiert:** 05.09.2026  
**Status:** Accepted  
**Referenz:** `docs/design/walkable-colony.md`, `docs/decisions/ADR-state-runtime-boundaries.md`

---

## Invariante 1: Projektion, kein zweiter Weltzustand

> Die Mikroebene erfindet keinen zweiten persistenten Weltzustand.
> Sie projiziert den bestehenden Weltzustand in menschlichen Maßstab.

**Konkret:**
- Ein Frachter erscheint an einem Pad nur, wenn der persistente Schiffs-/Dockingzustand dies hergibt.
- Ein Landing Pad existiert nur, wenn es als persistentes Entity beziehungsweise gültige Erweiterung vorhanden ist.
- Eine Raumhafenerweiterung erscheint erst nach erfolgreicher persistenter Build-/Entity-Erzeugung.
- Ein NPC darf sichtbar aus Resident-/Assignment-/Aktivitätsdaten und deterministischer Runtime-Ableitung projiziert werden.
- Niemals: Die Mikroebene erzeugt gameplayrelevante Gebäude, Personen, Ressourcen oder Fahrzeuge ohne nachvollziehbare Weltzustandsquelle.

**Verletzung dieser Invariante** = zweite Simulation.

---

## Invariante 2: Persistente Topologie ≠ lokale Darstellungsgeometrie

Die strategische Weltstruktur beschreibt, welche Objekte existieren und wie sie spielmechanisch zusammengehören. Die Walkable-Colony-Szene darf daraus eine eigene lokale Geometrie ableiten:

```text
Persistenter Weltzustand
  ↓ referenziert / projiziert
Walkable-Colony-Szene
  ├─ Wege und begehbare Verbindungen
  ├─ Türen / Übergangspunkte
  ├─ Personen
  ├─ Gebäude und Objekte
  └─ Interaktionspunkte
```

Das bestehende 32×24-Layout bleibt derzeit eine gültige persistente Referenz für die aktuelle Spielwelt. Es ist **nicht** als endgültiges physikalisches Meter-Koordinatensystem festgeschrieben.

Eine spätere metrische Weltgeometrie ist zulässig, wird aber nur über eine kontrollierte Migration gemäß `ADR-state-runtime-boundaries.md` eingeführt. Ein pauschaler Tile→Meter-Faktor ist kein physikalischer Kanon.

---

## Invariante 3: Eine Simulation, mehrere Projektionen

Die strategische Ansicht, Walkable Colony und Innenräume zeigen denselben persistenten Simulationszustand aus unterschiedlichen Perspektiven.

```text
Supabase / persistente Simulation Truth
        ↓
API / Server-Domain
        ↓
Client-Projektionen
  ├─ Planung
  ├─ Walkable Colony
  └─ Innenraum
```

Der Wechsel der Perspektive erzeugt keine neue Wirtschaft, keine neue Population und keine zweite Entity-Welt.

---

## Invariante 4: Ephemere Interaktion ist erlaubt

Die frühere Formulierung „Kein Mikro-State-Store“ war zu absolut. Zulässig und inzwischen umgesetzt sind ephemere Client-Zustände, zum Beispiel:

- Spielerposition in der aktuellen Walkable-Colony-Projektion;
- aktuelle Auswahl;
- nächstgelegene Interaktion;
- Kamera/Fokus;
- Präsentationsmodus `colony | planning | interior`.

Diese Zustände sind keine persistente Simulation Truth und dürfen beim Reload verloren gehen. Verboten bleibt ein konkurrierender persistenter Mikro-Weltzustand.

---

## Invariante 5: Abgeleitete NPC-Runtime

NPC-Tagesabläufe und räumliche Positionen dürfen deterministisch aus persistenter Population, Assignments, Gebäuden, Wegen und Zeit abgeleitet werden.

Das ist keine zweite Simulation, solange:

1. keine konkurrierende persistente NPC-Welt entsteht;
2. gameplayrelevante Entscheidungen weiterhin auf persistenter Truth beruhen;
3. die Darstellung aus vorhandenen Daten nachvollziehbar bleibt.

Die ursprüngliche Phase-B-Beschränkung „keine NPC-Tagesabläufe“ ist damit historisch überholt; sie war eine Vertical-Slice-Begrenzung, keine dauerhafte Architekturregel.

---

## Vertical-Slice-Prinzip

Der erste Pfad bleibt als Qualitätsmaßstab sinnvoll:

```text
Habitat → Straße → Raumhafen-Gelände → Terminal → Landing Pad
```

Prüfpunkte:
1. Bewegung fühlt sich gut an.
2. Strategische Struktur bleibt wiedererkennbar.
3. Gebäude wirken im menschlichen Maßstab plausibel.
4. Außen/Innen-Übergänge funktionieren.
5. Sichtbare gameplayrelevante Dinge sind aus Weltzustand oder definierter Runtime ableitbar.

---

## Datenfluss heute

```text
Supabase
  locations / location_resources
  tile_entities / player_builds
  ships / ship_docking_assignments
  Population / Residents / Assignments
  simulation_events / entity_states
        ↓
API-Routen / Server-Domain
        ↓
colonyStateStore        = Snapshot-/Projection-Cache
colonyInteractionStore  = ephemere lokale Interaktion
gameModeStore           = Präsentationsmodus
        ↓
WalkableColony / Interior / Planning Renderer
```

Die drei Client-Stores besitzen unterschiedliche Verantwortlichkeiten und dürfen nicht zu einer zweiten persistenten Welt zusammenwachsen.

---

## Stilprinzip

Wenn ein gameplayrelevantes Objekt in der Mikro-Szene erscheint, muss der Entwickler erklären können:

- welche persistente Quelle es begründet oder
- welche definierte, reproduzierbare Runtime-Ableitung es erzeugt.

Reine Dekoration ist erlaubt, solange sie keine Spielregel, Ressource, Person, Infrastruktur oder Interaktionsmöglichkeit vortäuscht.
