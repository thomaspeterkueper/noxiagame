---
title: "Druckanzug-Figur und Kartenbilder für Mars-Gebäude"
source_area: bodies
target_area: graphics
status: open
priority: normal
created: 2026-11-06
claimed_by: null
depends_on: []
touches: [lib/figures/kiesel.ts, lib/game/buildings/visuals.ts]
input_sha: 2cbf7976abb876d1297e91c6270aa9e14d6f91a7
write_scope: [lib/figures/, lib/game/buildings/visuals.ts, public/]
read_scope: [docs/workstreams/world-map-bodies.md, docs/workstreams/world-map-zeichenvorlage.md]
risk_class: code
max_commits: 8
excluded_actions:
  - direkter Push auf main ohne Freigabe
---

# Auftrag

1. **Druckanzug** für die Kiesel-Figur (Spieler und Bewohner): eine Kleidungsvariante, die die Weltkarte draußen auf Körpern mit `suitOutside` (`lib/worldlab/bodies.ts`) zeigt. Helm mit Visier, Rückentornister; Farbe je Rolle wählbar.
2. **Kartenbilder Mars** in derselben 2:1-Ansicht wie die Erde (`world-map-zeichenvorlage.md`) für Gebäude, die auf dem Mars noch keins haben – zuerst `habitat`, `warehouse`, `reactor_module`, `black_start`, `admin`, `medical_core`, `water_recycler`, `landing_pad` (`getBuildingVisual(typeId, 'mars')`).

## Kontext

Thomas (Entscheidung zu anderen Himmelskörpern): draußen geht man nur im Anzug oder Fahrzeug. Die neue Marskarte zeigt bis dahin die normale Figur und für Gebäude ohne Bild einen einfarbigen Ersatzblock.

## Akzeptanzkriterien

- [ ] `kieselLookFor` kann einen Anzug liefern; die Karte schaltet ihn je Körper ein.
- [ ] Mindestens die acht genannten Mars-Gebäude haben ein Kartenbild.

## Ergebnis / Nachweis
