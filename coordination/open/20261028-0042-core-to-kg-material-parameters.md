---
title: "Externe Anfrage an Knowledge Graph: kanonische Parameter für Baustoffe und Rohstoffgewinnung"
source_area: core
target_area: external:kueper-knowledge-graph
status: open
priority: normal
created: 2026-10-28
claimed_by: null
depends_on: []
touches: []
input_sha: 9ca6990a
write_scope: []
read_scope:
  - docs/decisions/NOXIA-MAT-0001-baustoffe-und-rohstoffgewinnung.md
risk_class: doc
max_commits: 1
excluded_actions:
  - Parameter in noxiagame als kanonisch ausgeben, bevor der KG sie bestätigt
---

# Auftrag

Im Knowledge Graph als `entity_request` einreichen, mit Quelle je Wert: Holzzuwachs und Vorrat je ha (Fichte, Buche, Mischwald, Deutschland), Schnittholzausbeute, Energie je m³ Schnittholz; Materialbedarf je m² Geschossfläche (Massivhaus, Holzhaus, Stahlhalle: Beton, Ziegel, Holz, Stahl); Energie je t Zement, Beton, Ziegel, Stahl; Fördermenge typischer Steinbrüche; Besatzdichte Weide (Großvieheinheiten je ha), Futter- und Wasserbedarf je Tier; Regolith als Baustoff (Sintern, Energie je t). Die Zahlen in NOXIA-MAT-0001 sind vorläufige Größenordnungen.
