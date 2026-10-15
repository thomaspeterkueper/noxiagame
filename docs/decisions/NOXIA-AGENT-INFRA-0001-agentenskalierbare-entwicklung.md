# NOXIA-AGENT-INFRA-0001 – Agentenskalierbare Entwicklungsinfrastruktur

Status: proposed – Entscheidungsvorlage, keine Laufzeitänderung
Datum: 2026-10-15
Geltungsbereich: `noxiagame`, mit späterem Cross-Repository-Abgleich im KUEPER-Ökosystem
Auslöser: Erkenntnisse aus Anthropics Scion-Architektur für agentische Entwicklungs-Workflows

## Ziel

Die Entwicklungsarbeit für noχ¹ᐃ soll mit mehreren spezialisierten KI-Agenten sicher und kosteneffizient skalieren, ohne die bestehende GitHub-, Vercel-, Supabase- oder `coordination/`-Struktur zu ersetzen. Vorrang haben **Integrity of Observation**, **Timescale Engineering**, Fehlerrobustheit, Nachvollziehbarkeit, geringe Betriebskosten und klare menschliche Freigabegrenzen.

Scion ist ein Architekturvorbild, **keine Installations- oder Migrationsentscheidung**. Kein Ersatz von Git, keine neue verpflichtende Infrastruktur.

## Invarianten

1. GitHub bleibt Versions- und Review-Source-of-Truth. Aufgaben zwischen Arbeitsbereichen werden weiterhin als Markdown in `coordination/` versioniert. Keine parallele Task-Datenbank.
2. Die persistierte Simulation bleibt die einzige Source of Truth für Spielzustand; Agenten erzeugen keinen davon getrennten Weltzustand.
3. Jeder Schreibauftrag erhält einen abgegrenzten Scope (Dateien/Module/DB-Objekte), erwartetes Ergebnis und prüfbare Akzeptanzkriterien.
4. Standardmäßig: eigene Branches und PRs statt direkter Änderungen an `main`; kein eigenmächtiger Merge oder Produktions-Deployment.
5. DB-Migrationen sind getrennte, überprüfte Artefakte; vorher Schema-/Datenfolgen analysieren, rückwärtskompatibel und möglichst reversibel entwickeln. Migrationen niemals unbesehen in Produktion anwenden.
6. Keine Geheimnisse in Agentenprompts, PRs, Logs oder Dokumenten. Least-Privilege-Zugriffe und getrennte Entwicklungs-/Produktionsrechte.
7. Telemetrie und Agentenaussagen sind evidenzgebunden: Quellen, Messzeitraum, Messmethode, Unsicherheiten und ausgeführte Aktionen nachvollziehbar dokumentieren.
8. Kosten- und Effizienzgewinn erst nach Messung behaupten. Keine fiktiven Prozentzahlen.

## Arbeitsmodell

**Core/Orchestrator** zerlegt priorisierte Anforderungen in kleine, möglichst unabhängige Aufgaben. Er dokumentiert Abhängigkeiten, bestimmt betroffene Domänen und benennt für jede Aufgabe genau einen Verantwortlichen.

**Spezialisten (logische Rollen, nicht zwingend dauerhaft laufende Prozesse):**
- Implementierungsagent: eng begrenzte Codeänderungen und Tests
- Datenbankagent: Schema, Abfragen, RLS, Migration und Query-Pläne
- QA-/Sicherheitsagent: unabhängige Regression-, Sicherheits- und Integritätsprüfung
- Observability-/Kostenagent: periodische, datenbasierte Auswertung nach Freigabe von read-only-Zugängen

### Aufgabenvertrag (Minimum)

- ID, Zweck und Besitzer/Arbeitsbereich
- Betroffene Dateien, Komponenten, APIs und Datenbankobjekte
- Abhängigkeiten und ausdrücklich ausgeschlossene Bereiche
- Eingangsreferenzen (Git-Commit, Schema-/Snapshot-Version)
- Abnahmekriterien und Tests
- Risikoklasse (Doku / Code / Schema / Daten / Produktion)
- Erwartete Kosten-/Ressourcenwirkung und Messplan
- PR-/Migrations-/Entscheidungslinks, Ergebnis und offene Punkte

## Effizienzregeln

1. Gezielt lesen: zuerst Repository-Suche/Dateimetadaten, dann nur betroffene Dateien oder Zeilen; kein vollständiger Codeabruf als Default.
2. Analyseartefakte und Diagnosen mit Commit- und Zeitbezug wiederverwenden; bei Änderung oder Ablauf invalidieren.
3. Unabhängige Aufträge parallelisieren, Konfliktfälle serialisieren. Bei überlappenden Dateipfaden oder Datenbankobjekten vorab sperren bzw. neu planen.
4. Asynchrone Agenten nicht als gegeben voraussetzen: zunächst existierende Connector-Fähigkeiten und tatsächliche Ausführungsumgebung prüfen.
5. Kleine PRs, idempotente Checks und möglichst inkrementelle Tests vor größeren E2E-Läufen.
6. Telemetrie in festen Intervallen auswerten; kein Polling bei jedem UI-Aufruf und keine unnötigen LLM-Abfragen.

## Umsetzungsphasen

### Phase 0 – Bestandsaufnahme (keine Produktionsänderungen)

- Vorhandene GitHub Workflows, Branch-Policies, `coordination/`-Aufträge und Deploy-/Migrationswege erfassen.
- Aktuelle Supabase-/Vercel-Verbrauchswerte **nur bei tatsächlicher Berechtigung** lesen, Baseline dokumentieren (Requests, DB-Verbrauch, CI-Minuten, Builddauer, Fehlerquoten, LLM-/Agentenaufrufe sofern verfügbar).
- Bestehende Zugriffsbefugnisse und notwendige menschliche Freigaben festhalten.
- Drei wiederkehrende Problemfälle als Pilotaufgaben definieren, z. B. kleinere UI-/Gebäudefunktion, Query-Optimierung und Schemaänderung.

**Exit:** signierter Ist-Bericht mit belastbaren Messwerten und Risikoübersicht.

### Phase 1 – Prozesspilot im vorhandenen GitHub

- Aufgabenvertrag als `coordination/`-Vorlage ergänzen.
- Rollen-/Ownership-Matrix und Konfliktregeln dokumentieren.
- Einen ungefährlichen Code- oder Dokumentationsauftrag über Branch → Tests → PR → menschliche Freigabe führen.
- Keine zusätzliche Server- oder Queue-Infrastruktur.

**Exit:** reproduzierbare, reviewbare Pilotausführung ohne direkte Main-/Produktionsänderung.

### Phase 2 – Technische Automatisierung nach Pilot

- Nur bei nachgewiesenem Bedarf: CI-Prüfungen, PR-Templates, Scope-/Konfliktcheck, Migrations-Preflight.
- Read-only-Kostenmonitoring und Schwellwerte ergänzen, soweit bestehende APIs das erlauben.
- Nutzen gegen Baseline bewerten: Zeit pro abgeschlossenem Auftrag, Fehlerrate, Retries, CI-Ressourcen, DB-Last und Kosten.

**Exit:** messbare Verbesserung ohne erhöhte Fehler-/Sicherheitslast.

### Phase 3 – Optionaler eigener Worker

Ein späterer Hetzner-Worker kommt nur infrage, wenn sich ein konkreter Engpass nachweisen lässt, die Integrationen verlässlich steuerbar sind und Betrieb, Backup, Monitoring und Datenschutz geklärt sind. GitHub bleibt auch dann Source of Truth.

## Nicht-Ziele

- Kein Scion-Nachbau oder Git-Austausch.
- Keine unbeaufsichtigten Produktionsmigrationen.
- Kein automatisches Zusammenführen ungeprüfter Agentenänderungen.
- Kein eigenständiger dauerhafter Betrieb oder Hintergrundmonitoring ohne dafür eingerichtete Tasks/Infrastruktur.

## Erste Entscheidung

**Empfehlung:** Phase 0 und ein dokumentationsbasierter Phase-1-Pilot werden vorbereitet. Weitere Automatisierung folgt ausschließlich auf Basis der Baseline und eines erfolgreichen Reviews.

Referenz: Anthropic Engineering, Scion / redesigning source control (Oktober 2026): https://www.anthropic.com/engineering/redesigning-source-control
