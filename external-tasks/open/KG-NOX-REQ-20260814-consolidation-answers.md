---
id: KG-NOX-REQ-20260814-consolidation-answers
title: Antworten auf drei Rückfragen zu KG-0017 (colony_ledger, STATE, world_events/historical_milestones)
status: open
source: KG
target: NOXIA
created: 2026-08-14
requested_by: T.P.K.
priority: medium
affects: [KG, NOXIA]
supersedes: []
---

# KG-NOX-REQ-20260814-consolidation-answers

## Anlass

NOXIA hat drei konkrete Rückfragen zu `docs/KG-0017-NOXIA-SIMULATION-PILOT.md` (Object-Relation-Event-Modell, angewendet auf NOXIAs Supabase-Schema) gestellt. Diese Antworten sind nach Prüfung des tatsächlichen NOXIA-Codes entstanden (`lib/knowledge/unlocks.ts`, `supabase/migrations/`), nicht aus der Dokumentation abgeleitet. Vollständig auch nachzulesen im Nachtrag zu `KG-0017` (kueper-knowledge-graph, Commit `28a5068`).

## 1. Ist `colony_ledger` bereits die richtige Zielstruktur für eine Konsolidierung?

Als Vorbild ja (typisierte Spalten statt Roh-`jsonb`, tick-gebunden), als Zieltabelle selbst nicht direkt: eine Zeile bildet genau einen Effekt ab, kann also kein Mehrfach-Effekt-Ereignis (z. B. „Schiff ändert Status **und** Standort in einem Vorgang") tragen.

**Empfehlung:** eine neue, geteilte `events`-Tabelle im Stil von `colony_ledger`, ergänzt um `subject_type`/`subject_id`, `effect_group_id` und optionales `effects`-Array. `colony_ledger` kann darauf als Spezialisierung für Ressourcenbuchungen aufsetzen oder unverändert weiterlaufen.

## 2. Wie sähe STATE für NOXIA aus, gegeben nur `tile_entities` + Ledger heute?

`tile_entities` (`built_at`, kein `valid_to`) ist ein Teil-Zustand, kein echtes STATE-Konzept - „aktuell vorhanden" muss aus dem Fehlen eines späteren Abriss-Ledger-Eintrags abgeleitet werden.

**Minimaler Vorschlag:**

```sql
CREATE TABLE entity_states (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL,
  subject_id   uuid NOT NULL,
  valid_from   timestamptz NOT NULL,
  valid_to     timestamptz,     -- NULL = aktuell gültig
  properties   jsonb NOT NULL,
  source_event uuid REFERENCES events(id)
);
```

Aktueller Zustand = `WHERE subject_id = X AND valid_to IS NULL`; historischer Zustand = Bereichsabfrage auf `valid_from`/`valid_to`. Wird aus demselben Event-Strom geschrieben, der ohnehin Effekte erzeugt - keine parallele Datenpflege nötig.

## 3. Dürfen `world_events`/`historical_milestones` schon jetzt gedroppt werden, unabhängig vom Ausgang?

**Geprüft, nicht vermutet:** Beide Tabellen kommen im gesamten TypeScript-Code nirgends in einem `INSERT`/`SELECT` vor - nur in Migration/RLS/Grants. `colony_ledger` dagegen ist aktiv in drei Dateien verdrahtet (`app/api/game/admin/route.ts`, `app/api/game/trade/route.ts`, `lib/game/tick.ts`).

**Technisch:** ja, gefahrlos droppbar, ohne live etwas zu brechen.

**Aber:** das ist nicht die Entscheidung des KG - die RLS-Policies wirken absichtlich für geplante, noch nicht verdrahtete Features vorbereitet (World-Events-System, Achievement-System). Ob das aufgegebene oder nur noch nicht gebaute Features sind, ist NOXIAs Roadmap-Entscheidung, keine technische Notwendigkeit der Konsolidierung. Das neue Event-Schema kann parallel eingeführt werden, unabhängig vom Schicksal dieser beiden ungenutzten Tabellen.

## Betroffene Repositories

- `noxiagame` (mögliche zukünftige Schema-Migration, NOXIAs eigene Entscheidung/Umsetzung)
- `kueper-knowledge-graph` (Referenzdokument `KG-0017`, bereits aktualisiert)

## Status

Beratend. Der KG legt hiermit die Zielarchitektur-Vorschläge vor; Umsetzung, Timing und die Drop-Entscheidung für `world_events`/`historical_milestones` bleiben bei NOXIA.
