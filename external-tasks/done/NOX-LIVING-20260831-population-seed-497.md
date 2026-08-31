# NOX-LIVING-20260831 — Tharsis Hub Personenpopulation aus dem kanonischen Start-Seed ableiten

Status: done
Owner: NOXIA
Priorität: high
Completed: 2026-08-31

## Ergebnis

Der kanonische Tharsis-Hub-Start-Seed bleibt bei `locations.population = 497`. Zusätzlich sind 36 deterministische unbenannte aktive Personen als kontrollierte Testkohorte integriert.

- sechs reale Habitatcluster werden als Wohnobjekte verwendet;
- Arbeitszuweisungen referenzieren ausschließlich reale Tharsis-Seedobjekte;
- Rollen decken Medical, ECLSS, Wasser, Energie, Logistik, Werkstatt, Geologie/Material, Roverbetrieb und Administration ab;
- jede aktive Person besitzt fünf initiale Bedürfnisse und mindestens einen rollenbezogenen Skill;
- benannte kanonische Personen werden nicht dupliziert;
- Seed-IDs und Upserts machen die Migration idempotent;
- SQL-Akzeptanzprüfungen sichern Kohortengröße, Gesamtbevölkerung, Needs und gültige Assignments;
- zusätzlicher TypeScript-Regressionstest gleicht Zielobjekte gegen den kanonischen `THARSIS_HUB_BUILDINGS`-Seed ab.

## Integration

Umgesetzt und regulär gemergt über PR #48. Die frühere Blockade durch den physischen Tharsis-Seed ist aufgelöst.