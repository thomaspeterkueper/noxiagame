# noχ¹ᐃ

## Schreibweise und technische Bezeichner

Die **kanonische und sichtbare Schreibweise** des Projekts lautet **`noχ¹ᐃ`**.

`noxia` und `nox1a` sind ausschließlich praktische Tastatur-Kurzformen. Sie dürfen in interner Kommunikation oder dort verwendet werden, wo Sonderzeichen technisch ungeeignet sind. In allen sichtbaren Spieltexten, Cockpit-Beschriftungen, Überschriften, Karten, Dokumentationen mit Außenwirkung und Grafiken ist dagegen **`noχ¹ᐃ`** zu verwenden.

Technische Bezeichner bleiben davon getrennt und müssen nicht rückwirkend umbenannt werden, zum Beispiel:

- Repository: `noxiagame`
- interne IDs, Slugs, Routen oder Variablennamen: bei Bedarf `noxia`
- Tastatur-Kurzformen des Autors: `noxia` oder `nox1a`
- Brand-/Displayname: **`noχ¹ᐃ`**

Die Kurzformen sind daher niemals als alternative offizielle Schreibweisen zu verstehen.

## Cross-Repository-Hinweis

Vor der Vergabe einer neuen `OTA-*`- oder `ENG-*`-Signatur (z. B. in `external-tasks/`-Requests an OTA/Engineering) bitte **[`ota-signature-index.json` im `kueper-ecosystem`-Repository](https://github.com/thomaspeterkueper/kueper-ecosystem/blob/main/registry/ota-signature-index.json)** konsultieren ([`ECO-ARC-0032`](https://github.com/thomaspeterkueper/kueper-ecosystem/blob/main/decisions/ECO-ARC-0032-2026-DE.md)). Wiederholte unabhängige Kollisionen bei OTA-TEC-Signaturen (u. a. `0035`–`0037`, `0088`–`0097`) haben gezeigt, dass Stichproben-Suche allein nicht ausreicht. Der Google-Drive-Anteil des `overtime-archive`-Bestands ist dort noch nicht automatisiert erfasst — bei Zweifel zusätzlich den Drive-Ordner direkt prüfen.

noχ¹ᐃ ist eine Wissens-, Zivilisations- und Gesellschaftssimulation im realen Sonnensystem. Spieler versorgen Kolonien, bauen Infrastruktur, handeln, lernen und erleben dieselbe Simulation sowohl strategisch als auch aus persönlicher Perspektive.

## Architekturprinzipien

### Eine Simulation, mehrere Sichten

Strategische Karte, Gebäude-Overlays, Scanner, Walkable Colony und Innenräume dürfen keinen eigenen parallelen Weltzustand erzeugen. Die persönliche Ebene ist eine Projektion des bestehenden noχ¹ᐃ-Zustands.

```text
persistierter noχ¹ᐃ-Weltzustand
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

- **noχ¹ᐃ:** Gameplay, Balancing, Runtime-Simulation, Kosten, Bauzeiten, Produktionswerte und konkrete Spielinstanzen.
- **OTA/KG:** kanonische technische Objekte und systemübergreifende Beziehungen.
- **SSF:** wissenschaftliche/Lerninhalte.

Externe Evidenz oder Kanon-Mappings dürfen noχ¹ᐃ-Balancing nicht automatisch verändern. noχ¹ᐃ erfindet keine OTA-, KG- oder SSF-IDs.

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
