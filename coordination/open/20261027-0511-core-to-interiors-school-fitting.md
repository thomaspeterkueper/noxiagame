---
title: "Grundschule als fünfte Einrichtung auf WalkableInterior"
source_area: core
target_area: interiors
status: open
priority: normal
created: 2026-10-27
claimed_by: null
depends_on:
  - 20261027-0510-core-to-earth-real-schools-as-public-buildings
  - 20261027-0512-core-to-core-skills-practice-certificates
touches: [InteriorFitting, VenueLayout, INTERIOR_CAPABILITY_REGISTRY]
input_sha: 840755e
write_scope:
  - app/earth/SchoolWalkableInterior.tsx (neu)
  - lib/game/school/ (neu)
  - lib/game/buildings/index.ts
  - lib/game/buildings/entry.ts
  - lib/game/buildings/interiors/registry.ts
  - lib/game/buildings/interiors/templates/ (neue Datei)
  - lib/game/buildings/interiors/functions/registry.ts
read_scope:
  - docs/decisions/NOXIA-SCHOOL-0001-grundschule-als-lernort.md
  - docs/decisions/NOXIA-INTERIOR-0001-ein-bedienmodell-fuer-alle-gebaeude.md
  - app/earth/AcademyWalkableInterior.tsx
  - lib/game/academy/academyInterior.ts
risk_class: code
max_commits: 10
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Schreibzugriff auf Produktion
  - Änderungen am Motor WalkableInterior außer kleinen, rückwärtskompatiblen Erweiterungen
---

# Auftrag

Schul-Einrichtung nach dem Muster der Akademie: Grundriss `basic_school` (Sekretariat, Klassenzimmer, Werkraum, Schulküche, Schulgarten, Pausenhof), Wissen der Lehrkräfte (Stundenplan, eigene Fächer, welche Übungen der Vorrat gerade erlaubt), Angebot als Kacheln in drei Gruppen: Grundlagen (öffnet `SchoolOverlay` mit SSF-Modulen), Handwerk, Alltag (starten Übungen über die Core-Schnittstelle). Capabilities `learn`, `teach`, `research`, `practice` in `INTERIOR_CAPABILITY_REGISTRY` ergänzen (seit NOXIA-INTERIOR-0001 offen).

## Abgrenzung

Keine eigene Lern- oder Kompetenzlogik – nur Anzeige und Aufruf der Core-Schnittstelle. Keine Inhalte erfinden.

## Akzeptanzkriterien

- [ ] Gleiche Bedienung wie Lokal/Akademie; etwa 150 Zeilen Einrichtung, kein Motor-Code.
- [ ] Ohne Lehrkraft: Klassenzimmer Selbstlernbetrieb, Werkraum und Küche zeigen die geschlossen-Tafel mit Grund.
- [ ] Laufende Übung zeigt Dinge als Icons im Raum, Ergebnis landet beim Spieler.
- [ ] Im Browser geprüft.
