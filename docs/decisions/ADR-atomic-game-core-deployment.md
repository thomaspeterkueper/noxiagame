# Deployment Note — Atomic Game Core

**Datum:** 10.09.2026  
**Bezug:** ADR `ADR-atomic-game-core.md`, PR #101

PR #101 führte den gemeinsamen atomaren Game Core und den server-autoritiven Transit ein. Der erste Supabase-Produktionslauf wurde nicht durch eine Core-Migration, sondern durch bereits vorhandenen Drift zwischen produktiver Migrationshistorie und den kanonischen Repository-Zeitstempeln blockiert.

PR #102 ergänzte dafür ausschließlich kommentarbasierte `remote_history_bridge`-Migrationen für die sechs bereits produktiv registrierten Versionen `20260907124206`, `20260909165655`, `20260909170253`, `20260909174834`, `20260909214031` und `20260909214323`. Diese Bridges verändern weder Schema noch Daten; sie stellen ausschließlich die lokale/remote History-Parität wieder her.

Diese Datei dokumentiert den anschließenden erneuten Default-Branch-Deployment-Trigger. Sie enthält bewusst keine zusätzliche Migration und keine Änderung an der Game-Core-Semantik.
