# NOXIA-FOOD-0001 – Lebensmittel als Ware

Status: accepted (Thomas, 27.10.2026); Stufe 1 umgesetzt
Datum: 2026-10-27
Bezug: NOXIA-LIVING-0012 (Hunger und Durst), NOXIA-LIVING-0013 (Grundversorgung, „Lebensmittel sind heute keine Ware mit Bestand“), NOXIA-SCHOOL-0001 (Kochen und Gärtnern als Übungen), ADR-sundog-prinzip, `docs/core/RESOURCE_INVENTORY_ECONOMY_MAP.md`

## Entscheidung (Thomas, 27.10.2026)

Lebensmittel sind generell so wichtig wie Wasser und werden eine Ware – mit Bestand, Produktion, Handel und Verbrauch.

## Ausgangslage

- `food` stand im TypeScript-Typ `Resource`, aber nicht im Datenbank-Enum `resource_type`. Alle Lager, Märkte, Frachten und Produktionsbefehle hängen an diesem Enum.
- Lokale, Kantine und Notration erzeugen Sättigung aus dem Nichts (`run_npc_consumption`, `order_hospitality_item`).
- Kein Gebäude produziert Lebensmittel; `hydroponics` war nur ein Sprite.
- Wasser zeigt den Weg: Bestand je Ort (`location_resources`), Gebäudeproduktion im Tick, Verbrauch der Bewohner, Versorgung (`is_supplied`) bremst oder fördert das Wachstum.

## Stufen

Lebensmittel betreffen jede Kolonie live. Deshalb in drei Stufen, jede für sich spielbar:

| Stufe | Inhalt | Wirkung im Spiel |
|---|---|---|
| **1 – Ware existiert** | Enum `food`, Bestand je Ort, Marktpreise, Lager, Fracht, Hydroponik als erste Quelle, NPC-Händler handeln Lebensmittel | Lebensmittel sind sicht-, handel- und produzierbar. Niemand ist davon abhängig. |
| **2 – Lokale kochen aus dem Bestand** | Lokale, Kantine und Spielerbestellungen ziehen je Mahlzeit aus dem Ortsbestand; leeres Lager = nichts zu essen; Notration aus staatlicher Reserve als Fiskaltransfer (LIVING-0013) | Essen hat eine Herkunft. Ein Ort ohne Nachschub merkt es zuerst in den Lokalen. |
| **3 – Bewohner brauchen Lebensmittel** | `CONSUMPTION_PER_100.food`, Versorgung prüft Lebensmittel wie Wasser, Knappheitsdruck in `colonyPressure` | Hunger wird eine Kolonieeigenschaft. Ohne Nahrung schrumpft die Kolonie. |

## Stufe 1 (umgesetzt 27.10.2026)

- Migrationen `20261027070000_add_food_resource_type.sql` (Enum) und `20261027070500_food_ware_foundation.sql` (Daten).
- Einheit Tonnen, wie alle Güter (Lager, Fracht und Handelslose rechnen in Tonnen).
- Startbestand: Erde 100 000 t (Landwirtschaft), sonst rund 30 Spieltage künftigen Bedarfs bei vorläufig 0,5 t je 100 Bewohner und Tick, mindestens 200 t.
- Marktpreise je Tonne: Erde 40/30, sonst 80/60; Richtpreis 160 (`PRICE_BASE`). Solange niemand verbraucht, fallen die Preise Richtung Untergrenze – das ist ehrlich: Überfluss.
- Hydroponik (`hydroponics`): +2 t/Tick, braucht 1 t Wasser und 1 Energie/Tick, baubar auf Mond, Mars, Phobos, Deimos und Stationen; nicht auf der Erde.
- Lager: Lagerhaus 800 t, Lagerhalle 1 500 t, Raumhafenlager 500 t Lebensmittel je Ausbaustufe 1.
- TypeScript: `MARKET_RESOURCES`, `TICK_RESOURCES`, `LOGISTICS_RESOURCES`, `STORAGE_RESOURCES`, `PRICE_BASE`, `HANDEL_STANDARD.gueter`, Gebäudekatalog, Beschriftungen in Markt und Frachtterminal.
- Bewusst nicht: Verbrauch der Bewohner, `is_supplied`, Lokale und Kantine.

## Offen für Stufe 2/3 (Entscheidungen für Thomas)

1. **Mahlzeit und Tonne:** Lager rechnen in ganzen Tonnen, eine Mahlzeit ist etwa 0,5 kg. Vorschlag: Lokale führen einen Bruchzähler je Ort und buchen eine Tonne ab, sobald 2 000 Mahlzeiten ausgegeben sind; ist der Bestand 0, gibt es nichts mehr.
2. **Notration bei leerem Lager:** Vorschlag: aus einer staatlichen Reserve je Ort, bezahlt aus der Koloniekasse; ist auch die leer, gibt es keine Notration – dann hungert der Ort sichtbar.
3. **Verbrauchsrate der Bewohner:** Vorschlag 0,5 t je 100 Bewohner und Tick (halb so viel wie Wasser im Modell); vor dem Einschalten eine Messung im Forschungslauf.
4. **Erde:** Lebensmittel kommen dort aus der Landwirtschaft der realen Umgebung. Vorschlag: zuerst als Bestand der Erde, später als NPC-Höfe auf echten Agrarflächen (OSM `landuse=farmland`).
5. **Kette:** Wie Lebensmittel entstehen (Feld, Mühle, Bäckerei, Hydroponik), steht ortsunabhängig in NOXIA-FOOD-0002.
6. **Schule:** Sobald Stufe 2 läuft, verbraucht die Kochübung echte Lebensmittel aus dem Schulvorrat, und der Schulgarten erzeugt welche.
