---
title: "Lebensmittelkette im Core: Güter, Einheit kg, Haltbarkeit, Nährwert, Verbrauch nach Kalorien"
source_area: core
target_area: core
status: open
priority: normal
created: 2026-10-27
claimed_by: null
depends_on:
  - 20261027-0930-core-to-core-production-input-gating
touches: [resource_type, resources, location_resources, building_definitions, person_needs]
input_sha: 9ca6990a
write_scope:
  - supabase/migrations/ (neue Dateien)
  - lib/game/resources.ts
  - lib/game/tick.ts
  - lib/game/storageCapacity.ts
  - lib/game/priceModel.ts
read_scope:
  - docs/decisions/NOXIA-FOOD-0001-lebensmittel-als-ware.md
  - docs/decisions/NOXIA-FOOD-0002-lebensmittelkette-fachmodell.md
  - lib/game/food/chain.ts
risk_class: migration
max_commits: 15
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Migration in Produktion anwenden ohne Freigabe Thomas
---

# Auftrag

1. Güter der Kette als `resource_type`: `grain`, `flour`, `bran`, `bread`, `potatoes`, `vegetables`, `salt`, `yeast`, `seed` (je eigene Enum-Migration wie bei `components`/`food`).
2. `resources` um `shelf_life_days`, `kcal_per_kg` und eine Buchungseinheit (`booking_unit`: `t` | `g` | `MWh`) erweitern. **Entschieden (Thomas, 27.10.2026):** Lebensmittel werden in ganzzahligen Gramm gebucht, in kg gerechnet und angezeigt (ab 1 t als t); Strom bleibt MWh, andere Güter bleiben unverändert. Bestand `food` (heute t) beim Umstellen × 1 000 000.
   **Voraussetzung:** `location_resources.stock/production/consumption`, `logistics_inventory_items.amount` und `ship_cargo.amount` sind `integer` – in Gramm reicht das nur bis rund 2 147 t (Erdbestand heute 100 000 t). Diese Spalten und die Mengenparameter von `noxia_adjust_inventory_amount`, `noxia_transfer_cargo`, `noxia_credit_facility_output` und Marktfunktionen auf `bigint` umstellen, bevor Gramm gebucht werden.
6. **Gastronomie aus demselben Bestand:** `run_npc_consumption` und `order_hospitality_item` ziehen je Portion die Zutaten aus `DISH_INGREDIENTS_G` (Gramm) vom Ortsbestand ab; fehlt eine Zutat, ist das Gericht nicht lieferbar. Bei Knappheit gilt `households_first` (entschieden 27.10.2026): Haushalte werden vor der Gastronomie bedient.
3. Verderb im Tick: je Ort und Gut verliert der Bestand täglich 1/Haltbarkeit (Regel wie `spoilDay`).
4. Gebäude der Kette in `building_definitions` aus den Verfahren des Fachmodells (Mühle, Bäckerei, Feld, Hydroponik-Anpassung).
5. Verbrauch der Haushalte nach Kalorien (2 200 kcal je Person und Tag) aus allen essbaren Gütern; Wirkung auf `person_needs` (`sustenance`) – das ist NOXIA-FOOD-0001 Stufe 3.

## Abgrenzung

Kein eigener Inventarzustand außerhalb von `location_resources` / `logistics_inventories`. Routing und Fahrzeuge bleiben beim Erdmodell bzw. Fahrzeugsystem.

## Akzeptanzkriterien

- [ ] Die drei Szenarien aus `lib/game/food/chain.test.ts` lassen sich mit Core-Daten in einem Forschungslauf nachstellen.
- [ ] Massenbilanz im Forschungslauf belegt.
