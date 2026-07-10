# KUE-NOX-0002 — `.env.example` ergänzen

## Target System
NOXIA (`noxiagame`)

## Origin
kueper.com (`SYS:KUEPER:kueper-com`)

## Status
Done

## Umsetzung

Im Repo-Root wurde `.env.example` ergänzt.

Dokumentiert sind:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `CRON_SECRET`
- `KNOWLEDGE_SOURCE`
- `SSF_BASE_URL`

`SSF_BASE_URL` ist kanonisch. `SSF_API_BASE_URL` ist nur noch als auskommentierter, veralteter Alias dokumentiert.

Die serverseitigen Secrets sind ausdrücklich als Vercel-Sensitive-Werte gekennzeichnet.

## Commit

`cc7847b` — `docs(env): add deployment environment example`

## Completed
2026-07-10
