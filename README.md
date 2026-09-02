# NOXIA

NOXIA ist eine Wissens-, Zivilisations- und Gesellschaftssimulation im realen Sonnensystem. Spieler versorgen Kolonien, bauen Infrastruktur, handeln, lernen und erleben dieselbe Simulation sowohl strategisch als auch aus persönlicher Perspektive.

## Architekturprinzipien

### Eine Simulation, mehrere Sichten

Strategische Karte, Gebäude-Overlays, Scanner, Walkable Colony und Innenräume dürfen keinen eigenen parallelen Weltzustand erzeugen. Die persönliche Ebene ist eine Projektion des bestehenden NOXIA-Zustands.

```text
persistierter NOXIA-Weltzustand
        ↓
Gameplay-/Domänenlogik
        ↓
strategische Sicht | Overlay | persönliche Sicht
```

Der Scanner ist der erste abgeschlossene Referenz-Vertical-Slice für dieses Prinzip.

### Erweiterbare Gebäude

Gebäude sind langfristig keine starren Einzelobjekte mit bloßen Level-Zahlen. Kapazität und Funktion können durch reale, persistierte Erweiterungen wachsen. Eine Erweiterung muss auf Makro- und Mikroebene dieselbe Infrastruktur darstellen.

Beispiel: Ein Raumhafen kann aus Landing Pad 1, einem später gebauten zweiten Pad, Frachtlager und Terminal bestehen. Die persönliche Ansicht darf Pad 2 erst zeigen, wenn diese Erweiterung im Weltzustand tatsächlich existiert.

Verbindliche Entscheidung: `docs/decisions/NOXIA-BUILD-0001-expandable-buildings.md`.

### Source of Truth

- **NOXIA:** Gameplay, Balancing, Runtime-Simulation, Kosten, Bauzeiten, Produktionswerte und konkrete Spielinstanzen.
- **OTA/KG:** kanonische technische Objekte und systemübergreifende Beziehungen.
- **SSF:** wissenschaftliche/Lerninhalte.

Externe Evidenz oder Kanon-Mappings dürfen NOXIA-Balancing nicht automatisch verändern. NOXIA erfindet keine OTA-, KG- oder SSF-IDs.

## Wichtige Designdokumente

- `docs/gamedesign.md` — Game-Design-Grundlage und Kernloop
- `docs/Spec-gebaeude-katalog.md` — Gebäudekatalog und Baubarkeitsprinzip
- `docs/Spec:_InfrastrukturProgression.md` — Infrastruktur- und Prerequisite-Progression
- `docs/design/walkable-colony.md` — persönliche Ebene als Linse auf die Simulation
- `docs/decisions/ADR-walkable-colony-architektur.md` — Architektur-Invarianten der Walkable Colony
- `docs/decisions/NOXIA-BUILD-0001-expandable-buildings.md` — persistente, erweiterbare Gebäude

## Entwicklungsregel für Gebäude

Ein Gebäude oder eine Erweiterung wird erst baubar, wenn es eine echte Funktion besitzt. Darstellung folgt dem Weltzustand; sie erzeugt ihn nicht.

Bei jedem Gebäude werden zwei Fragen beantwortet:

1. **Makro:** Was produziert, konsumiert oder ermöglicht das Gebäude?
2. **Mikro:** Wie erlebt ein Mensch genau den Zustand dieses Gebäudes?

## Technischer Stack

- Next.js / React
- Supabase als bestehende Persistenzgrenze
- SVG/Canvas/React für strategische und persönliche 2D-Sichten
- Three.js nur dort, wo eine gezielte 3D-Präsentation sinnvoll ist; keine Simulation innerhalb der 3D-Szene

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Produktionsbuild:

```bash
npm run build
```

## Repository-übergreifende Änderungen

Jedes Repository bleibt Source of Truth nur für seinen Zuständigkeitsbereich. Änderungen, die ein anderes Repository betreffen, werden nicht hier stellvertretend umgesetzt, sondern als Markdown-Anforderung im Ziel-Repository unter `external-tasks/open/` angelegt.
