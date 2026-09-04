---
requestId: ENG-NOX-REQ-20260904-001
sourceRepository: kueper-engineering
targetRepository: noxiagame
sourceEngineeringId: ENG-SCV-0001
sourceRequirement: SCV-ENV-001
status: open
created: 2026-09-04
---

# Engineering request: physikalische Semantik der NOXIA-Logistikknoten

## Anlass

KUEPER Engineering entwickelt mit `ENG-SCV-0001 — Frachter Mk.I` den ersten vollständigen technischen Referenzfall ausgehend von der NOXIA-Rolle `mk1`.

Die Engineering-Auslegung soll ausdrücklich **nicht** bestehende Gameplaywerte nachträglich physikalisch rechtfertigen. Für belastbare Design Reference Missions, Δv-Budgets, Antriebswahl, Massenmodell und die Frage nach Start-/Landefähigkeit muss jedoch bekannt sein, welche technische Bedeutung die NOXIA-Orts-IDs besitzen sollen.

## Betroffene NOXIA-Orte

- `earth`
- `moon`
- `mars`
- `phobos`
- `prometheus`

## Zu klärende Semantik

Bitte für jeden relevanten Logistikknoten festlegen, ob er im NOXIA-Domänenmodell primär repräsentiert:

1. eine planetare bzw. lunare **Oberfläche**;
2. einen definierten **Orbit**;
3. eine **Station / ein Depot / einen orbitalen Umschlagpunkt**;
4. einen bewusst **aggregierten Logistikknoten**, der mehrere physikalische Ebenen abstrahiert;
5. oder einen anderen technisch relevanten Zieltyp.

Falls ein Ort absichtlich aggregiert bleibt, bitte zusätzlich festlegen, ob NOXIA künftig Transfer und planetare Start-/Landeoperationen als getrennte Mechaniken behandeln soll. Im aktuellen Code deutet der Kommentar zur späteren Lander-Mechanik bereits auf eine solche Trennung hin, Engineering übernimmt diese Interpretation aber nicht ohne Entscheidung des NOXIA-Repositories.

## Benötigte Antwort für Engineering

Für die Freigabe von `SCV-ENV-001` genügt eine kurze, explizite Entscheidung in NOXIA, z. B. in Form einer kleinen Tabelle:

| node | domain meaning | transfer endpoint | surface leg separate? |
|---|---|---|---|
| earth | ... | ... | yes/no |
| moon | ... | ... | yes/no |
| mars | ... | ... | yes/no |
| phobos | ... | ... | yes/no |
| prometheus | ... | ... | yes/no |

Wichtig ist nicht, dass NOXIA sofort reale Orbitparameter simuliert. Engineering benötigt nur eine stabile semantische Grenze, damit physikalische Missionen definiert werden können.

## Auswirkungen

Die Entscheidung blockiert derzeit in KUEPER Engineering:

- primäre Design Reference Mission;
- Δv-Budget;
- Hauptantriebs-Trade;
- Treibstoff- und Massenbudget;
- Struktur- und Lastfälle für Start/Landung;
- Thermal- und Operationsannahmen;
- Bewertung `orbital freighter` vs. `surface-capable freighter`.

## Nicht Bestandteil dieses Requests

Dieser Request fordert **keine** Änderung von Gameplaywerten, Reisezeiten, Energie-Balancing, Slotzahlen oder Frachtkapazitäten.

NOXIA bleibt Source of Truth für seine eigene Semantik und entscheidet selbst über Umsetzung und Darstellung. Nach Bearbeitung bitte gemäß Repository-Regel nach `external-tasks/done/` oder `external-tasks/rejected/` verschieben.
