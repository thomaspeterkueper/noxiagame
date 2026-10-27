---
title: "Externe Anfrage an Knowledge Graph: kanonische Parameter der Lebensmittelkette"
source_area: core
target_area: external:kueper-knowledge-graph
status: open
priority: normal
created: 2026-10-27
claimed_by: null
depends_on: []
touches: []
input_sha: 9ca6990a
write_scope: []
read_scope:
  - docs/decisions/NOXIA-FOOD-0002-lebensmittelkette-fachmodell.md
risk_class: doc
max_commits: 1
excluded_actions:
  - Parameter in noxiagame als kanonisch ausgeben, bevor der KG sie bestätigt
---

# Auftrag

Im Knowledge Graph als `entity_request` einreichen: Für jedes Gut und Verfahren in NOXIA-FOOD-0002 kanonische Werte mit Quelle – Erträge je Hektar (Weizen, Kartoffeln) für gemäßigtes Klima, Ausmahlgrad, Energie je Tonne Mahlgut, Teigausbeute und Backverlust, Energie je kg Brot, Haltbarkeit bei typischer Lagerung, Nährwerte, Strom- und Wasserbedarf von Hydroponik je kg Blattgemüse. Die heutigen Zahlen sind vorläufige Größenordnungen.
