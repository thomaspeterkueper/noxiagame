# NOX-LIVING-20260831 — Tharsis Hub Personenpopulation aus dem kanonischen Start-Seed ableiten

Status: open
Owner: NOXIA
Priorität: high

## Kontext

Der kanonische Tharsis-Hub-Start-Seed mit 497 Bewohnern und stabilen physischen Seed-Objekten ist inzwischen auf `main` integriert. NOXIA besitzt ein persistentes Living-Population-Modell, benannte Rollen/Personen und einen deterministischen Entscheidungs-Kern.

## Anforderung

Die Personenebene soll jetzt konsistent an den integrierten Tharsis-Seed gekoppelt werden:

1. `locations.population = 497` bleibt aggregierte demografische Zahl.
2. Benannte kanonische Personen bleiben individuelle `people`-Datensätze und werden nicht dupliziert.
3. Zusätzlich wird zunächst eine kontrollierte aktive Testkohorte von 20–50 unbenannten Personen erzeugt; der Rest bleibt aggregiert.
4. Jede aktive Person erhält mindestens Bedürfnisse sowie eine gültige Wohnzuweisung; arbeitende Personen erhalten eine Arbeitszuweisung zu tatsächlich existierenden Seed-Objekten.
5. Rollen-/Skill-Verteilung muss zu Medical Core, ECLSS/Wasser, Energie, Logistik, Werkstätten, Geologie, Roverbetrieb und Administration passen.
6. Keine Person darf einem Gebäude oder Standort zugewiesen werden, der im finalen Tharsis-Seed nicht existiert.
7. Seed muss idempotent sein und Tests für Gesamtbevölkerung, individuelle Kohortengröße, gültige Assignments und keine doppelten `person_key` enthalten.

## Abhängigkeit

Die frühere Blockade `OTA-NOX-REQ-20260830-THARSIS-HUB-START-SEED` ist durch den Merge von PR #42 aufgelöst. Umsetzung kann beginnen.
