---
requestId: ENG-NOX-REQ-20260904-001
sourceRepository: kueper-engineering
targetRepository: noxiagame
sourceEngineeringId: ENG-SCV-0001
sourceRequirement: SCV-ENV-001
status: done
created: 2026-09-04
completed: 2026-09-05
implementation:
  - ea3c298b4610652ca8d14126508ff7dafab080a7
  - 0d50039b7531bbbfd15b3b2bcf0e6a67201463e3
  - 55689264e981a8ddadc951aa6bb9504747546625
---

# Engineering response: physikalische Semantik der NOXIA-Logistikknoten

NOXIA hat die Semantik der fünf angefragten Logistikknoten als eigene Domänenentscheidung festgelegt. Die maschinenlesbare Source of Truth liegt in `lib/game/logisticsNodes.ts`; `lib/game/logisticsNodes.test.ts` fixiert die Grenze deterministisch.

## Entscheidung

| node | domain meaning | transfer endpoint | surface leg separate? |
|---|---|---|---|
| `earth` | aggregierter Logistikraum Erde: Oberfläche + orbitales Interface | orbitales Interface der Erde | yes |
| `moon` | Oberflächen-Domäne der Shackleton-Kolonie | lunares orbitales Interface | yes |
| `mars` | Oberflächen-Domäne Tharsis Hub | Mars-Orbit-Interface | yes |
| `phobos` | Phobos-Station / Freihafen | Station selbst | no |
| `prometheus` | Erde-assoziiertes L5-Habitat / Transferstation | Station selbst | no |

## Semantikgrenze

Ein NOXIA-Location-Slug ist nicht automatisch der exakte Endpunkt eines interplanetaren Burns. Für `earth`, `moon` und `mars` werden inter-node Transfer und planetare/lunare Oberflächenoperation fachlich getrennt. Damit muss ein interplanetarer Frachter nicht implizit start-, lande- oder atmosphäreneintrittsfähig sein.

`phobos` und `prometheus` sind dagegen selbst Transferendpunkte. Dort gibt es hinter dem Knoten keine zusätzliche planetare Oberflächenetappe.

## Kompatibilität mit dem aktuellen Spiel

Die bestehende Runtime darf die Ebenen vorerst weiterhin in einem Location-Slug zusammenfassen. Insbesondere können `ships.location`, bestehende Reisezeiten und die aktuelle Landing-Pad-Zuweisung unverändert bleiben. Diese Entscheidung ändert keine Reisezeit, kein Balancing und keine bestehende Save-/DB-Struktur; sie definiert die physikalische Bedeutung, auf die spätere Transfer-/Lander-Mechaniken aufbauen.

Der aktuelle Weltmodell-Stand unterstützt diese Grenze bereits teilweise: Mond und Mars sind als Oberflächenkolonien modelliert, Phobos und Prometheus als Stationen. Earth besitzt als Himmelskörper eine eigene Identität; für den Logistikknoten wird bewusst die aggregierte Semantik festgelegt, bis konkrete Earth-Surface-/Orbit-Locations separat modelliert werden.

## Engineering-Folge

Für `ENG-SCV-0001 — Frachter Mk.I` darf Engineering daher eine primäre Design Reference Mission als **orbitalen/inter-node Frachtertransfer** auslegen. Start/Landung auf Erde, Mond oder Mars ist eine separate Fähigkeits- bzw. Landerfrage und muss nicht in die Basisauslegung des Frachters hineingezwungen werden.

NOXIA bleibt Source of Truth für Location-/Gameplay-Semantik. Engineering bleibt Source of Truth für konkrete physikalische Missionen, Δv-Budgets, Antrieb, Masse, Struktur und Thermal Design innerhalb dieser Grenze.
