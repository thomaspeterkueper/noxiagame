# NOXIA-AGENT-INFRA-0001 – Abschluss Phase 0

Datum: 2026-10-17
Status: **Phase 0 abgeschlossen** – Phase 1 startet als Pilot (siehe unten)
Bezug: `docs/decisions/NOXIA-AGENT-INFRA-0001-agentenskalierbare-entwicklung.md`, `docs/research/NOXIA-AGENT-INFRA-0001-phase0-audit-2026-10-15.md`
Methode: read-only über GitHub REST API (Workflow-Runs, PRs, Branch-Regeln), Vercel-API (Deployments) und den Workflow-Dateien auf `main` (Stand `25a11573`). Keine Änderung an Runtime, Datenbank, CI oder Vercel-Konfiguration.

## 1. Offene Punkte der Phase-0-Checkliste

| Punkt | Ergebnis |
|---|---|
| CI-/Branch-Policy vollständig erfasst | erledigt – Abschnitt 2 |
| Zeitnormierte Kosten-/Latenzbaseline | erledigt, soweit mit vorhandenem Zugriff messbar – Abschnitt 3; nicht messbare Größen ausdrücklich benannt |
| Pilot-Abnahmekriterien mit konkreten Tests | erledigt – Abschnitt 5 und erster Phase-1-Auftrag |
| Abschlussreview vor Phase 1 | erledigt – Abschnitt 6 |

## 2. CI- und Branch-Policy (Ist-Zustand)

### Branch-Schutz
- `main` ist **nicht geschützt** (`GET /branches/main/protection` → 404 „Branch not protected"), es gibt **keine Rulesets** (`/rulesets` und `/rules/branches/main` leer).
- Erlaubte Merge-Arten: Merge-Commit, Squash und Rebase; Auto-Merge aus; Branches werden nach dem Merge nicht automatisch gelöscht.
- Folge: Pflicht-Checks existieren nicht. Ob ein PR grün war, ist eine Frage der Disziplin, nicht der Technik.

### Workflow-Katalog
50 Workflow-Dateien in `.github/workflows/` auf `main`:

| Merkmal | Anzahl |
|---|---:|
| Trigger `pull_request` (alle pfadgefiltert) | 47 |
| Trigger `push` | 38 |
| `workflow_dispatch` | 4 |
| Node 22 / 24 / 20 | 48 / 1 / 1 |
| Installation per `npm install` | 43 |
| Installation per pnpm | 4 |
| explizite `permissions` | 4 |
| `timeout-minutes` gesetzt | 15 |
| nutzen Secrets | 3 |

Befunde:
1. **Paketmanager nicht reproduzierbar:** Das Repository hat nur `pnpm-lock.yaml`, kein `package-lock.json`. 43 Workflows installieren mit `npm install` und lösen die Abhängigkeiten damit bei jedem Lauf neu auf. Vercel und der neue Traum-Workflow nutzen pnpm.
2. **Node-Versionen uneinheitlich:** 48× Node 22, `noxia-core-causality.yml` Node 24, `shackleton-terrain-runtime.yml` Node 20; Vercel-Projekt Node 24.x.
3. **Automatische Produktionsschreibzugriffe:** `import-shackleton-terrain.yml`, `sync-active-moon-terrain.yml` und `validate-active-moon-terrain.yml` laufen bei `push` auf `main` (pfadgefiltert auf ihr Skript) mit `SUPABASE_SERVICE_ROLE_KEY`. Ein Merge, der eines dieser Skripte berührt, schreibt damit ohne weitere Freigabe in die Produktionsdatenbank. Das widerspricht Invariante 5 („Migrationen niemals unbesehen in Produktion") sinngemäß auch für Datenimporte.
4. Alle PR-Checks sind pfadgefiltert. Ein universeller Pflicht-Check ist deshalb nur über einen immer laufenden Sammel-Job möglich (bereits im CI-Trigger-Audit festgestellt).

## 3. Baseline

### GitHub Actions
Zeitraum: alle Runs mit Erstellung ab 2026-10-10 bis 2026-10-17 ca. 04:30 (MESZ); Quelle `GET /actions/runs`, vollständig paginiert.

| Kennzahl | Wert |
|---|---:|
| Runs gesamt | 745 |
| davon erfolgreich / fehlgeschlagen / abgebrochen | 568 / 148 / 29 |
| Fehlerquote | 19,9 % |
| Auslöser `pull_request` / `push` | 515 / 230 |
| Runs je Tag (10.–17.10.) | 16 · 1 · 96 · 69 · 102 · 26 · **352** · 83 |
| Laufzeit je Run, Median / p90 / Max | 0,5 / 0,9 / 3,7 min |
| Summe Laufzeit | ca. 429 min |
| Workflows mit Runs im Zeitraum | 20 von 50 |

Laufzeit = `updated_at − run_started_at`, ohne Warteschlange. `noxiagame` ist öffentlich; Standard-Runner sind für öffentliche Repositories nach GitHubs Abrechnungsmodell kostenfrei. Actions verursachen hier also **Zeit und Rauschen, keine direkten Kosten**.

Meiste Fehlschläge: Population domain 38, NPC dream prototype checks 32, Interior domain 17, World Development Contract 15, Digital ensemble research checks 11.

Auf `main`: 67 Fehlschläge vom 10. bis 15.10., **0 Fehlschläge in 28 Runs seit dem 16.10.** (Beginn der geordneten Integration).

### Vercel
Zeitraum: 200 Deployments vom 2026-10-13 20:06 UTC bis 2026-10-17 02:19 UTC; Quelle Vercel-API `list_deployments`, Projekt `noxiagame`.

| Kennzahl | Wert |
|---|---:|
| Deployments | 200 |
| Preview / Production | 137 / 63 |
| READY / ERROR / CANCELED | 145 / 25 / 30 |
| je Tag (13.–17.10.) | 14 · 38 · 24 · **98** · 26 |
| nach Branch-Präfix | `feat/` 110 · `main` 63 · `docs/` 10 · `research/` 8 · sonstige 9 |
| letzte 100 Deployments | innerhalb von 17 Stunden, davon 82 aus `feat/`-Branches |

Laut `vercel.json` laufen zusätzlich fünf Cron-Endpunkte: `transits` jede Minute (1.440 Aufrufe pro Tag), `population`, `builds` und `world-places` stündlich, `retention` täglich. Das ist eine dauerhafte Grundlast unabhängig von der Entwicklungsarbeit; ihr Verbrauch ist nicht gemessen und ein Kandidat für die erste Kostenauswertung, sobald Zugriff besteht.

Builddauern liefert die Listenabfrage nicht; sie bleiben **nicht gemessen**. `CANCELED` umfasst u. a. vom Ignore-Skript übersprungene Builds (z. B. reine Doku-Commits auf `main`). `vercel.json` schließt nur `claude/*` von automatischen Deployments aus – Agenten-Branches mit anderem Präfix (`feat/`, `test/`, `research/`) bauen bei jedem Push.

### Nicht messbar mit aktuellem Zugriff
- Vercel-Abrechnung und Build-Minuten
- Token- und Agentenkosten je Auftrag
- Datenbank-Scanraten (Statistik-Abfrage wurde blockiert; Snapshot vom 15.10. bleibt Einzelwert)

Diese Größen werden nicht geschätzt. Sie werden nachgetragen, sobald ein lesender Zugriff besteht.

## 4. Rückwirkende Pilot-Auswertung: Integration vom 16.10.

Die Integration der kognitiven PRs lief faktisch bereits nach dem Phase-1-Modell (Branch → Tests → PR → menschlicher Merge, keine Produktionsänderung). Sie dient deshalb als Pilot.

| PR | Inhalt | Commits | Änderung | CI-Runs auf dem Branch | Dauer bis Merge |
|---|---|---:|---|---|---|
| #486 | Import-Fix Population | 2 | +11/−1 | 2 ✓ | ca. 22 h (wartete auf Review) |
| #483 | Sinnesschicht | 1 | +1281/−1 | – | gemergt 16.10. 11:30 |
| #494 | saubere Integration von #484 | 7 | +1207/−1 | 10 ✓ | ca. 5 h |
| #495 | saubere Integration von #485 | 13 | +1585/−1 | 10 ✓ | ca. 2 h |
| #496 | Traummodell-Konsolidierung (offen) | 51 | +875/−33 | 290 ✓ · 25 ✗ · 7 abgebrochen | offen |

Erkenntnisse:
1. **Die Reihenfolge funktioniert.** Erst der kleine Fix, dann gestapelte PRs nacheinander – `main` blieb seitdem grün.
2. **Kleine, abgegrenzte Aufträge sind effizient** (#494, #495: wenige Commits, alle Checks grün, Merge in Stunden).
3. **Offene Aufträge ohne festen Umfang laufen aus dem Ruder.** #496 erzeugte bis jetzt 51 Commits und 322 CI-Runs – mehr als 40 % aller Runs des Zeitraums – und dazu einen Großteil der `feat/`-Preview-Builds. Viele Commits sind Paare aus Fix und Test, mit denen sich der Agent per CI vorantastet, statt lokal zu prüfen.
4. **Nachweise wurden nicht mitgeschrieben.** Ausgangs-SHA, Schreibbereich, Risikoklasse und Run-IDs fehlen je Schritt; sie mussten hier nachträglich rekonstruiert werden.
5. **Überholte Arbeitsstände bleiben liegen:** #484 und #485 sind inhaltlich über #494/#495 gemergt, aber noch offen; #488, #490–#493 sind überholte Drafts.

## 5. Maßnahmen für Phase 1 (nach Wirkung geordnet)

Alle Punkte sind **Vorschläge**; Konfigurationsänderungen erfolgen jeweils in eigenen, kleinen PRs.

| # | Maßnahme | Begründung | Risiko |
|---|---|---|---|
| M1 | Aufgabenvertrag verpflichtend (erweitertes `coordination/TASK-TEMPLATE.md`), inkl. Umfangsgrenze und „lokal testen vor Push" | Befunde 4.3, 4.4 | Doku |
| M2 | Squash-Merge als Standard für Agenten-PRs | Historie lesbar trotz Fix-/Test-Paaren | keins |
| M3 | Produktions-Workflows (Abschnitt 2, Befund 3) auf `workflow_dispatch` umstellen oder hinter eine GitHub-Environment mit Freigabe legen | verhindert ungeprüfte Produktionsschreibzugriffe beim Merge | gering, CI |
| M4 | Automatische Vercel-Deployments auch für `feat/`, `test/`, `research/` abschalten oder Previews nur auf Abruf | 110 von 200 Deployments aus Agenten-Branches | gering, Konfiguration |
| M5 | Minimaler Schutz für `main`: Force-Push und Löschen verbieten | kostet nichts, schützt vor dem schlimmsten Fall | keins |
| M6 | CI vereinheitlichen: `pnpm install --frozen-lockfile`, eine Node-Version (24, wie Vercel) | reproduzierbare Läufe | mittel – schrittweise, je Workflow-Gruppe |
| M7 | Überholte PRs schließen (#484, #485, #488, #490–#493) | Übersicht | keins |

Hinweis zu M5: Eine Pflicht für PRs oder Pflicht-Checks auf `main` würde den bisherigen Arbeitsweg (eigener Branch, dann Fast-Forward-Push auf `main`) blockieren. Das ist eine Entscheidung des Repository-Inhabers und wird hier nicht vorweggenommen.

### Pilot-Abnahmekriterien Phase 1
Ein Phase-1-Auftrag gilt als bestanden, wenn:
1. der Aufgabenvertrag vor Arbeitsbeginn vollständig ausgefüllt ist (Ausgangs-SHA, Schreib- und Lesebereich, Risikoklasse, Ausschlüsse, Umfangsgrenze);
2. höchstens 15 Commits und keine Paare aus Fix und Test entstehen, die nur auf CI-Rückmeldungen reagieren;
3. alle betroffenen Workflows grün sind, mit Run-IDs und SHA im Vertrag eingetragen;
4. keine Schreibzugriffe auf Produktion erfolgen, ohne dass sie ausdrücklich freigegeben sind;
5. der PR per Squash gemergt und der Vertrag nach `coordination/done/` verschoben wird;
6. CI-Runs und Preview-Deployments des Auftrags gezählt und mit #496 verglichen werden.

## 6. Abschlussreview

- **Invarianten eingehalten:** GitHub blieb Source of Truth, keine parallele Aufgabendatenbank, keine Produktionsänderung durch die Phase-0-Arbeit.
- **Belastbare Baseline vorhanden** für CI (vollständig) und Deployments (Anzahl, Status, Branch); Kosten bleiben ausdrücklich offen.
- **Wichtigster Befund:** Nicht fehlende Werkzeuge bremsen, sondern fehlende Umfangsgrenzen pro Auftrag und fehlende Schutzmechanismen. Ein eigener Worker (Phase 3) ist nicht begründet.
- **Entscheidung:** Phase 0 ist abgeschlossen. Phase 1 startet mit genau einem Pilotauftrag nach neuem Vertrag: `coordination/open/20261017-0500-core-to-core-dream-persistence-pilot.md`. Er beginnt erst nach dem Merge von #496.

## Korrektur früherer Aussagen

In zwei Requests vom 16./17.10. stand, `docs/agent-infra-0001` habe keine gemeinsame Basis mit `main` und #490 würde über 4.000 Zeilen löschen. Beides beruhte auf Vergleichen in einer flachen Kopie ohne Merge-Base. Richtig ist: Die Merge-Base ist `583f76f2`; #487 fügt nur Dateien hinzu (+413/−0), #490 ändert 2 Dateien (+10/−22). Die Requests wurden entsprechend korrigiert. #490 ist trotzdem überholt, weil sein Inhalt (Node 24, `test:dreams`) in #496 aufgegangen ist.

## Umsetzungsstand der Maßnahmen (2026-10-17, 07:45 MESZ)

| # | Stand | Nachweis |
|---|---|---|
| M1 | umgesetzt | `coordination/TASK-TEMPLATE.md` erweitert, erster Vertrag `coordination/open/20261017-0500-core-to-core-dream-persistence-pilot.md` (`b805f7e2`) |
| M2 | als Regel im Aufgabenvertrag | Repository-Einstellung unverändert (alle Merge-Arten erlaubt) |
| M3 | umgesetzt | `import-shackleton-terrain`, `sync-active-moon-terrain`, `validate-active-moon-terrain` nur noch `workflow_dispatch` (`6905fc25`); der Merge-Commit hat 0 Workflow-Runs ausgelöst |
| M4 | umgesetzt | `vercel.json`: `feat/*`, `test/*`, `research/*` ohne automatische Deployments (`6905fc25`); Produktions-Deployment `dpl_2UJqBvrwauQ7PdaMbjBM2URUgaYh` mit der neuen Konfiguration `READY` |
| M5 | **offen – manuell** | Anlegen eines Rulesets per API ist aus der Agenten-Session nicht erlaubt (HTTP 403). Schritte siehe unten. |
| M6 | umgesetzt | PR #499, Squash `46b339ab`: 46 Workflows auf Node 24, davon alle mit Abhängigkeiten auf `pnpm install --frozen-lockfile`; 50 von 54 Checks grün, die 3 Fehlschläge bestanden schon vorher auf `main` (Auftrag `coordination/open/20261017-0830-qa-to-core-preexisting-test-failures.md`). Unverändert: die drei manuellen Gelände-Workflows |
| M7 | umgesetzt | #484, #485, #487, #488, #490, #491, #492, #493, später #460 und #333 mit Begründung geschlossen; Branches erhalten. Sichtung aller übrigen PRs: `NOXIA-AGENT-INFRA-0001-pr-sichtung-2026-10-17.md` |

Previews für Agenten-Branches lassen sich bei Bedarf weiterhin manuell im Vercel-Dashboard oder per `vercel deploy` erzeugen.

### M5 manuell einrichten
GitHub → Repository `noxiagame` → Settings → Rules → Rulesets → New branch ruleset:
- Name: „main – kein Force-Push, kein Löschen", Enforcement: Active
- Target branches: Include default branch
- Rules: nur „Restrict deletions" und „Block force pushes" aktivieren
- Keine Pflicht für Pull Requests oder Status-Checks – der bisherige Weg (eigener Branch, dann Fast-Forward auf `main`) bleibt möglich.

### Weiterer Rückstand
Erledigt durch die Sichtung vom 2026-10-17 (`NOXIA-AGENT-INFRA-0001-pr-sichtung-2026-10-17.md`): 1 PR mergebereit, 5 zum Rebase, 11 veraltete mit Entscheidungsbedarf.
