# NOXIA-AGENT-INFRA-0001 – Phase-0-Bestandsaufnahme

Stand: 2026-10-15, initiale read-only Prüfung; Status: **teilweise erhoben / Baseline unvollständig**
Quelle: GitHub-, Supabase- und Vercel-Connector; keine Produktionsänderung

## Verifizierte technische Grundlagen

- GitHub: `thomaspeterkueper/noxiagame`, Standardbranch `main`. Cross-Workstream-Aufgaben und Zuständigkeiten sind in `coordination/README.md`, `coordination/TASK-TEMPLATE.md` und `docs/project-workstreams.md` bereits festgelegt.
- Architekturentwurf liegt in Draft-PR #487. Die Freigabe des Nutzers vom 15.10.2026 betrifft Phase 0, **nicht automatisch Merge oder Phase 1**.
- Parallele Entwicklung: PRs #483–#486 zur NPC-Kognition/Population zeigen reale Integrationsabhängigkeiten; #486 beschreibt einen TypeScript-Import-Fehler beim Testlauf als konkreten Pilotkandidaten. Die einzelnen CI-Ergebnisse sind noch nicht vollständig geprüft.
- Supabase-Projekt `noxiagame` meldet `ACTIVE_HEALTHY`; Region `eu-west-1`; PostgreSQL 17.
- Datenbank-Snapshot (15.10.2026 ca. 20:23 UTC): Größe **110 MB**, **191** Benutzertabellen, kumulative `seq_scan` **9.332.505**, kumulative `idx_scan` **5.845.941**. Diese Zähler sind **keine** täglichen Raten; Reset-Zeitpunkt noch offen.
- Supabase Performance Advisor meldete **89 unindizierte Foreign Keys** (Informationshinweise, nicht automatisch 89 realisierte Performanceprobleme). Vor Indexbau Abfragehäufigkeit, Tabellenvolumen und Querypläne analysieren. Hinweise: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
- Vercel-Projekt `noxiagame` vorhanden; Preview-Deployment des Dokumentationsbranchs `docs/agent-infra-0001` war `READY`. Dies belegt einen Build/Deployment-Anstoß auch für reine Dokumentation, aber noch keine abgerechneten Kosten. In der aktuellen 12er-Stichprobe finden sich auch `CANCELED`- und `READY`-Produktionsdeployments; Ursachen ohne Logs nicht festgestellt.

## Vorläufige Befunde / Maßnahmen nach Priorität

1. **P1: Build- und Testeffizienz** – prüfen, wie Docs-only-Änderungen von unnötigen Vercel-Builds ausgenommen werden können (ohne unabsichtlich nötige Checks zu überspringen).
2. **P1: PR-Abhängigkeiten** – zunächst die tatsächlichen CI-Checks, Basis-Branches und Merge-Konflikte von #483–#486 dokumentieren, ehe Änderungen angestoßen werden.
3. **P2: Datenbank** – kumulative Scans nach Tabellen aufschlüsseln, Statistiken-Reset erfassen, echte Query-Latenzen und Größen erfassen. 89 FK-Hinweise nicht pauschal mit Indexanlage beantworten.
4. **P2: Governance** – `coordination/TASK-TEMPLATE.md` auf Commit-Stand, Risiko, erlaubte Schreibbereiche, Datenbankobjekte, Testnachweise und Ausschlüsse ausrichten; erst nach Phase-0-Auswertung als separaten PR vorschlagen.
5. **P3: Agenten-Worker** – ohne belastbare Engpassdaten nicht anschaffen.

## Offene Messpunkte / Grenzen

- Kein API-gestützter Vercel-Abrechnungswert, keine CI-Minuten-Gesamtsumme, keine Token- oder Agentenkosten erfasst.
- Aktuelle Laufzeitkosten, Builddauer, Fehlerrate und relevante DB-Query-Perzentile fehlen.
- Der GitHub-Workflow-Bestand und Branch-Protection wurden nicht vollständig inventarisiert.
- `pg_stat_user_tables`-Scan-Zähler benötigen Reset-Zeitstempel und Zeitraum, bevor Trends oder Änderungen bewertet werden.
- Die Werte beschreiben einen einzelnen Snapshot, **keinen** Vorher-Nachher-Effekt des neuen Agentenansatzes.

## Definition of Done für Phase 0

- [x] GitHub-/Supabase-/Vercel-Projektidentität verifiziert
- [x] Bestehendes `coordination/`-Aufgabenmodell gelesen
- [x] Erste Supabase- und Deployment-Snapshots eingeholt
- [x] Konkrete Pilotkandidaten identifiziert
- [ ] CI-/Branch-Policy vollständig erfasst
- [ ] Zeitnormierte Kosten-/Latenzbaseline erfasst
- [ ] Pilot-Abnahmekriterien mit konkreten Tests finalisiert
- [ ] Abschlussreview vor Phase 1

Keine Änderungen an Runtime, Datenbankschema oder Deploy-Konfiguration im Rahmen dieses Berichts.
