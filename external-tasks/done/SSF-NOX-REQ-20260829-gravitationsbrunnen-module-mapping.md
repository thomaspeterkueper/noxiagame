---
id: SSF-NOX-REQ-20260829-GRAVITATIONSBRUNNEN-MAPPING
requester: SYS:KUEPER:ssf
target: SYS:KUEPER:noxia
priority: high
type: integration-mapping
created: 2026-08-29
completed: 2026-08-31
status: done
affects: [NOXIA, SSF]
---

# Kanonische SSF-Modul-/Pfadzuordnung für `gravitationsbrunnen`

Die zuvor fehlende KG-Rückgabe liegt vor und ist umgesetzt.

## Kanonische Identitäten

- Modul: `PHY-L2-000005`
- Consumer-/Legacy-ID: `LRN:SSF:PHY-ENERGIE-ARBEIT-0001`
- Pfad: `PATH:SSF:PHY-ENERGIE-ARBEIT-0001`
- Interactive-ID: `gravitationsbrunnen`

KG-Rückgabe: `kueper-knowledge-graph/external-tasks/done/EXT-NOX-KG-20260829-energy-work-gravitational-well-module.md`.

## NOXIA-Umsetzung

1. Migration `supabase/migrations/20260831_bind_energy_work_ssf_path.sql` bindet den vorhandenen lokalen Kurs `Energie & Arbeit` über `kg_path_id`, ohne eine lokale `kurs_id` zu erfinden.
2. `lib/ssfKnowledge.ts` versteht den strukturierten SSF-Abschnitt `type: interactive`.
3. `app/academy/learn/GravityWellInteractive.tsx` rendert `gravitationsbrunnen` direkt in NOXIA.
4. `SsfModuleRenderer.tsx` zeigt bekannte Interactives als echte Interaktion und unbekannte Interactives mit dem von SSF gelieferten Text-Fallback.

Relevante Commits: `d2e7bca`, `adb85f9`, `4599dfc`, `536404e`.

SSF hat seinen Contentvertrag bereits in PR #40 abgeschlossen. Damit ist die Integration repository-seitig vollständig; die Supabase-Migration muss noch in der produktiven Datenbank ausgeführt werden.
