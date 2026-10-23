---
id: REQ-NOXIA-20261023-SUPABASE-MIGRATION-HISTORY-RECONCILIATION
title: Supabase Migration History – Hosted Rollouts und Repository-Versionen kanonisch versöhnen
status: open
source: NOXIA-Core
created: 2026-10-23
priority: high
affects: [Core, Supabase, CI, Preview, Migrations, Operations]
---

# Befund

Beim Preview von PR #513 wurde ein vollständiger Fresh-Replay der aktuellen Repository-Migrationen gegen Supabase Git Branching verfolgt.

Es gibt zwei Driftklassen:

- Schema-History-Drift: historische Hosted-Objekte fehlen im aktiven Repository-Baseline-Pfad.
- Versions-History-Drift: Production kennt Hosted/Manual-Rollout-Versionen, deren exakte Versionsnummer nicht als lokale Migrationsdatei vorhanden ist.

Automatischer Vergleich am 2026-10-23:

    Production migration history: 246 Versionen
    aktive lokale Migrationsdateien: 315
    Production-Versionen ohne exakte lokale Versionsdatei: 125

Supabase Git Branching bricht deshalb mit „Remote migration versions not found in local migrations directory.“ ab.

# Kein Blind-Fix

Nicht einfach 125 No-op-Bridges erzeugen. Viele Hosted-Versionen repräsentieren echte Schemaänderungen, deren Repository-Quelle unter einem anderen Zeitstempel liegt. Eine zusätzliche Bridge plus weiterhin aktive Originalmigration kann denselben DDL-Effekt doppelt ausführen, Production vermeintlich neue Alt-Migrationen anbieten oder nicht-idempotente Datenmigrationen wiederholen.

# Ziel

Für jede abweichende Version wird eine explizite Zuordnung aufgebaut:

    hosted_version
    hosted_name
    repository_effect_file
    repository_version
    effect_equivalence
    production_has_effect
    fresh_replay_requires_effect
    resolution

Erlaubte Resolution-Klassen:

- rename-to-hosted-version
- hosted-version-bridge + retire-local-duplicate
- canonical-reconciliation-migration
- true-noop-history-bridge
- manual-investigation-required

# Bereits bestätigtes Beispiel

Hosted: 20260915152225 harden_learning_and_knowledge_rls
Repo:   20260915153000_harden_learning_and_knowledge_rls.sql

Zusätzlich fehlten im Fresh-Replay profiles.knowledge_points, award_knowledge(...) und get_knowledge_level(...), obwohl sie in Production kanonisch existieren.

PR #513 enthält dafür bereits einen Fresh-Replay-sicheren Guard im historischen Hardening und 20261023130500_knowledge_rpc_fresh_replay_reconciliation.sql als aktuelle kanonische Reconciliation.

# Arbeitsplan

1. Production schema_migrations gegen aktive Repo-Dateien vollständig diffen.
2. Für jede der 125 fehlenden Versionen den tatsächlichen Effekt-Partner bestimmen.
3. Keine Datei nur anhand ähnlicher Namen automatisch paaren; SQL-Effekt vergleichen.
4. Zuerst Core-/Security-/World-Foundation-Migrationen versöhnen.
5. Danach Geology/People/Social/World-Seeds in Blöcken.
6. Nach jedem Block einen leeren Supabase-Git-Branch vollständig neu aufbauen.
7. Danach einen CI-History-Parity-Check ergänzen.

# Acceptance Criteria

1. Neue Preview-Branches melden nicht mehr „Remote migration versions not found in local migrations directory“.
2. Ein komplett leerer Preview-Branch erreicht alle aktuellen Migrationen.
3. Keine historische effektive Migration wird doppelt ausgeführt.
4. Echte No-op-Bridges verweisen auf ihre zugehörige Effektmigration.
5. Security-Definer-RPCs enden nach Fresh-Replay mit denselben Rechten/Search-Paths wie Production.
6. Production- und Fresh-Replay-Schema sind strukturell diffbar; verbleibende Unterschiede sind dokumentiert.
7. CI erkennt neue Hosted/Repo-Drift künftig früh.

# Bezug zu PR #513

Der verbleibende Supabase-Preview-Fehler ist kein Fehler der LCR-6-/Moon-Engineering-Migration. Die neue Starter-Migration wurde zusätzlich direkt gegen das aktuelle Production-Schema in einer explizit zurückgerollten Transaktion erfolgreich validiert.
