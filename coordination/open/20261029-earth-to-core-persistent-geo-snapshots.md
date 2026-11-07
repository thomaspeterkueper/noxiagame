---
title: "Earth: einmaliger persistenter Kartenimport und danach autonome Ortsentwicklung"
source_area: earth
target_area: core
status: open
priority: high
created: 2026-10-29
claimed_by: null
depends_on: []
touches:
  - docs/decisions/NOXIA-EARTH-0003-persistente-geografie-und-ortsfortschreibung.md
input_sha: null
write_scope:
  - app/api/earth/
  - lib/world/spatial/
  - supabase/migrations/
  - docs/decisions/
  - tests/
read_scope:
  - app/
  - lib/
  - supabase/
  - docs/
risk_class: code
max_commits: 15
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Schreibzugriff auf Produktion
  - Migration in Produktion anwenden
---

# Auftrag
Entwickle den bestehenden Earth-Import in einen einmaligen, asynchronen und nachweisbar persistierten Snapshot-Workflow weiter. Nach Publikation liest das Spiel lokale Daten und schreibt ab dann seine eigene Weltgeschichte fort.

## Vertrag
[Entscheidung NOXIA-EARTH-0003](../../docs/decisions/NOXIA-EARTH-0003-persistente-geografie-und-ortsfortschreibung.md)

## Akzeptanz
- [ ] Vorhandene `celestial_regions`/`region_features` und andere Datenpfade auf Wiederverwendung geprüft.
- [ ] Externe Geodaten sind bei wiederholten Kartenansichten nicht nötig.
- [ ] Importjobs sind wiederaufnehmbar, idempotent, kachelweise und nicht an HTTP-Gateway-Timeouts gekoppelt.
- [ ] Datenqualität, Quellen, Lizenzen, Status und Versionen sind nachvollziehbar.
- [ ] Simulationsevents bleiben nach Geodatenrefresh und Seitenreload erhalten.
- [ ] Vuiteboeuf/El Haouaria-Ortsidentität separat als Regression geprüft.
- [ ] Tests und sichere Migration samt Rückweg dokumentiert.

## Ergebnis / Nachweis
- PR:
- Tests:
- Migration:
- Deployment:
