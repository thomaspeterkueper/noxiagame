# Geodynamo-Experiment – Forschungsmodus v0.1

**Status:** isolierter Pilot; keine Integration in Tick-Engine, DB, Wetter, Gesundheit, Artensterben, Wirtschaft, Küstenlinien oder NOXIA-SSF-Freischaltungen.

**Code:** `lib/game/science/geodynamoPilot.ts`; **Test:** `lib/game/science/geodynamoPilot.test.ts`.

## Vertrag

- Reine deterministische Funktion, Eingaben explizit, Ausgabe ohne Seiteneffekte.
- Zeitkoordinate in Millionen Jahren, Feldmoment und Wärmefluss mit Einheiten.
- Die Liste der Umkehrzeitpunkte wird extern bereitgestellt; die Funktion simuliert **nicht** selbst die magnetohydrodynamische Kernströmung.
- Feldpolarität (Vorzeichen) ist von Dipolmomentstärke (Betrag) getrennt.
- Kern-Mantel-Wärmefluss verändert das illustrativ berechnete Dipolmoment gemäß einem offen ausgewiesenen **unkalibrierten** Sensitivitätsparameter. Das ist kein physikalisch validiertes Skalengesetz.
- `extinctionPrediction: null` ist absichtlich fest: Auch häufige Polwechsel erzwingen weder Magnetosphärenkollaps noch Artensterben.
- Ungültige Zeitpunkte, doppelte Umkehrereignisse und physikalisch unsinnige Eingangswerte werden zurückgewiesen.

## Forschungsfortsetzung

1. Planetenspezifische Geodynamo-Parameter und Einheiten aus validierten Datenquellen, Unsicherheiten und Zeitskalen erfassen.
2. Kern-/Mantelentwicklung und Mantelwasserhaushalt zunächst als separate, bilanztreue Forschungsmodelle führen. Kopplung nur über explizite, validierte Schnittstellen.
3. Für Magnetosphäre → Atmosphärenchemie → Biosphäre separate Evidenzkette und Szenariogrenzen definieren.
4. Erst nach Modellvergleich, deterministischen Tests, wissenschaftlicher Kuratierung und Engine-Grenzprüfung darf über Gameplaywirkung entschieden werden.

**Primäranker:** `DOC:KUE:KUE-SCI-0200-2026-DE` und `ONT:KG:PERMIAN-GEOMAGNETIC-0.1`. Die end-Guadalupium-Krise (~261 Ma) wird nicht mit der end-Perm-Krise (~252 Ma) verwechselt.
