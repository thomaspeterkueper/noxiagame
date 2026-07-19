---
id: NOX-SSF-0008-completion
title: SSF-0008 abgeschlossen — NOXIA uid-Completion-API bereit
status: open
source: SSF
target: NOXIA
created: 2026-07-19
priority: high
blocking: [NOXIA-BETA]
---

# NOX-SSF-0008 — SSF uid-Completion-API bereit

## Was SSF implementiert hat

SSF hat `/api/noxia/completion` implementiert:

**POST** `/api/noxia/completion`
```json
{ "uid": "<noxia-user-id>", "pathId": "PATH:SSF:ECO-KREDIT-NOXIA-0001" }
```
→ Speichert Abschluss in `ssf_completions` Tabelle (Supabase)

**GET** `/api/noxia/completion?uid=<noxia-user-id>`
```json
{ "uid": "...", "completions": [{ "path_id": "...", "completed_at": "..." }] }
```

## NOXIA-Aktion erforderlich

1. Supabase-Tabelle `ssf_completions` anlegen:
```sql
CREATE TABLE ssf_completions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  noxia_uid uuid NOT NULL REFERENCES auth.users(id),
  path_id text NOT NULL,
  completed_at timestamptz NOT NULL,
  source text DEFAULT 'noxia',
  UNIQUE(noxia_uid, path_id)
);
```

2. NOXIA `sync_from_ssf` implementieren:
   - GET `/api/noxia/completion?uid={player.id}` nach Login/Tick
   - Für jeden Abschluss: prüfe `unlocks`-Array des Pfades
   - Schalte NOXIA-Feature frei wenn Unlock-Key matched

3. SSF-Links öffnen mit `?ref=noxia&uid={player.id}`

## Erster Unlock zum Testen

`PATH:SSF:ECO-KREDIT-NOXIA-0001` → `UNL:NOX:bank-credit` → Bank-Kredit-Tab
URL: `https://solarsciencefoundation.vercel.app/learning-paths/PATH%3ASSF%3AECO-KREDIT-NOXIA-0001?ref=noxia&uid={uid}`


## Resolution — 2026-07-19

Implementiert. Alle Commits landed. **Done**
