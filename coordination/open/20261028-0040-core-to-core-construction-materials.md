---
title: "Bauen verbraucht Material: neue Güter, Stücklisten je Bautyp, Baustelle wartet auf Material"
source_area: core
target_area: core
status: open
priority: high
created: 2026-10-28
claimed_by: null
depends_on: [20261027-0930-core-to-core-production-input-gating]
touches: [building_definitions, resource_type, logistics_inventories, player_builds, app/api/game/build/spatial]
input_sha: 9ca6990a
write_scope:
  - supabase/migrations/ (neue Dateien)
  - lib/game/construction/ (neu)
  - app/api/game/build/
read_scope:
  - docs/decisions/NOXIA-MAT-0001-baustoffe-und-rohstoffgewinnung.md
  - docs/core/RESOURCE_INVENTORY_ECONOMY_MAP.md
  - docs/decisions/NOXIA-FOOD-0002-lebensmittelkette-fachmodell.md
risk_class: runtime-data
max_commits: 15
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Migration in Produktion anwenden
---

# Auftrag

Thomas, 28.10.2026: Bauen soll richtiges Material verbrauchen – auch für die Welt jenseits der Erde (NOXIA-MAT-0001).

1. Neue Güter mit Einheit: Rundholz, Schnittholz (m³), Bruchstein, Schotter, Sand, Zement, Beton, Stahl (t), Ziegel. Über die bestehende Inventarschicht (`logistics_inventories`), kein zweiter Bestand.
2. Stückliste je Bautyp (`building_definitions`: Material je Gebäude oder je m² Geschossfläche, Arbeit), Werte vorläufig aus NOXIA-MAT-0001.
3. Baustelle: Beim Start werden Materialien reserviert; aus dem eigenen Lager am Ort, sonst automatischer Zukauf zum Marktpreis bei einem NPC- bzw. staatlichen Lieferanten (ausgewiesen in der Abrechnung). Fehlt Material und ist Zukauf nicht möglich, wartet die Baustelle und meldet den Engpass.
4. Abriss gibt einen Teil als Recyclingmaterial zurück.

## Abgrenzung

Preise der Credits-Anteile nicht ändern, bis Marktpreise feststehen; der Zukauf ersetzt zunächst den heutigen Pauschalpreis (Summe bleibt in der Größenordnung). Gewinnung der Rohstoffe: eigener Request 0041.

## Akzeptanzkriterien

- [ ] Ein Bau ohne Material und ohne Zukaufmöglichkeit startet nicht oder wartet mit benanntem Engpass.
- [ ] Material wird genau einmal verbraucht (Reservierung → Verbrauch), Bestände nie negativ.
- [ ] Bestehende Baustellen laufen unverändert zu Ende.
- [ ] Abrechnung zeigt Material und Arbeit getrennt.
