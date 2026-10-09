# Wirtschaft – Ausgangsmessung vor Wirkung der Lagergrenzen

Stand: 09.10.2026, Tick 2135 (letzter Tick vor dem ersten Lauf mit Lagergrenzen, Commit `fbfc58b`).
Zweck: Vergleichsbasis für die Beobachtung über mehrere Wirtschaftszyklen. Es wird nichts erzwungen –
gemessen wird, was sich aus den Regeln ergibt.

Eingeführt am selben Tag:

- Preis aus Lagerreichweite (`lib/game/priceModel.ts`), aktiv seit Tick 2135
- Lagergrenzen aus Lagergebäuden (`lib/game/storageCapacity.ts`), aktiv ab Tick 2136
- Direkthandel zum Marktpreis, Händlerweg, Erstkauf, Pilotenregel (Honorar ab Tick 2183)

## Bestände, Produktion, Verbrauch, Preis

Produktion und Verbrauch je Tick, Preis = Kaufpreis für Spieler in Cr/t. Kapazität nach dem neuen Modell
(Grundlager 300 t plus aktive Lagergebäude).

| Ort | Gut | Bestand (t) | Kapazität (t) | Produktion | Verbrauch | Preis |
|---|---|---:|---:|---:|---:|---:|
| Mars | Energie | 48.619 | 300 | 108 | 3 | 13 |
| Mars | Metall | 6.051 | 1.800 | 5 | 1 | 11 |
| Mars | Wasser | 577 | 1.300 | 7 | 5 | 19 |
| Mond | Energie | 4.876 | 1.800 | 10 | 2 | 13 |
| Mond | Metall | 23.813 | 1.800 | 17 | 1 | 11 |
| Mond | Wasser | 241 | 1.300 | 5 | 4 | 74 |
| Phobos | Energie | 4.127 | 1.800 | 7 | 1 | 13 |
| Phobos | Metall | 1.955 | 3.300 | 2 | 1 | 11 |
| Phobos | Wasser | 200 | 2.300 | 1 | 1 | 108 |

Sechs der neun Lager liegen über der Kapazität. Dort ruht die Produktion ab Tick 2136, bis der Verbrauch
den Bestand unter die Grenze gebracht hat. Beim heutigen Verbrauch dauert das beim Mars-Energielager
rund 16.000 Ticks – ein Zeichen, dass realer Verbrauch und Handel fehlen, nicht dass die Grenze falsch ist.

## Unternehmen

Vermögen = Summe aller Buchungen in `npc_ledger`. Produktionserlös = Gutschriften der Art `produce`
in den letzten 24 Ticks.

| Unternehmen | Vermögen (Cr) | Produktionserlös, 24 Ticks (Cr) |
|---|---:|---:|
| HeliosCorp | 49.910 | – |
| McKnight – Unternehmen | 8.120 | – |
| Boann | 6.842 | 42 |
| Goibniu | 6.735 | 35 |
| Goibniu Co. | 6.500 | – |
| Belenus AG | 6.072 | 672 |
| Belenus | 5.536 | 336 |

## Offene Beobachtungen

- **Produktionserlös ohne Käufer:** Firmen erhalten beim Produzieren sofort den Marktpreis gutgeschrieben
  (`runNpcTick`, Art `produce`), ohne dass jemand zahlt. Das widerspricht dem Grundsatz „Produktion erzeugt
  Güter, keine Credits". Mit den Lagergrenzen entfällt dieser Erlös bei vollem Lager; die Ursache bleibt.
- **Belenus (Mars, Energie)** lebt bisher fast nur von diesem Erlös und verliert ihn ab Tick 2136.
- **Nicht begrenzt:** Einlieferungen durch Spielerhandel und die adressierbaren Facility-Inventare.

## Nächste Messung

Dieselben drei Tabellen nach 24 und nach 48 Ticks (Tick 2159 und 2183), dazu Warenströme
(`trade_transactions`, `npc_trades`) im jeweiligen Zeitraum.
