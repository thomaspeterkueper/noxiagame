---
id: NOX-SSF-MODULES-403
title: SSF /api/noxia/modules — 403 durch Vercel Deployment Protection
status: done
source: SSF
target: NOXIA
created: 2026-07-20
priority: critical
blocking: [SSF-AKADEMIE-PAGE]
---

# Ursache des Crashes in der SSF-Akademie

## Primärfehler: Vercel Deployment Protection

Die SSF-API unter `/api/noxia/modules` gibt **403 Forbidden** zurück wenn NOXIA sie aufruft.
Ursache: Vercel Deployment Protection ist für das SSF-Projekt aktiv.

## Sekundärfehler: Supabase-Client Crash

`SsfModuleActions.tsx` hat `import { createClient } from '@/lib/supabase/client'` als Top-Level-Import.
Falls `NEXT_PUBLIC_SUPABASE_URL` oder `NEXT_PUBLIC_SUPABASE_ANON_KEY` auf der NOXIA-Vercel-Instanz fehlen,
crashed der Import beim Seitenaufruf → "This page couldn't load".

## Fixes (in NOXIA/SSF bereits commited)

- `SsfModuleActions.tsx`: Dynamic import statt Top-Level → kein Crash mehr bei fehlenden Env-Vars
- `ssf/page.tsx`: Bessere Fehlermeldung bei leeren Modulen — erklärt die Ursache

## Manuelle Aktion erforderlich (Vercel Dashboard)

**Option A** (empfohlen): SSF Deployment Protection deaktivieren für `/api/*`
1. https://vercel.com/dashboard → SSF-Projekt → Settings → Deployment Protection
2. "Password Protection" oder "Vercel Authentication" deaktivieren
3. Oder: Protection Bypass Secret konfigurieren

**Option B**: NOXIA schickt Bypass-Header
Vercel Dashboard → SSF → Deployment Protection → "Protection Bypass for Automation"
Secret generieren → in NOXIA Env-Vars als `SSF_BYPASS_SECRET=xxx` speichern

Dann in `lib/ssfKnowledge.ts`:
```ts
const response = await fetch(`${baseUrl}/api/noxia/modules`, {
  headers: {
    accept: 'application/json',
    'x-vercel-protection-bypass': process.env.SSF_BYPASS_SECRET ?? '',
  }
})
```

## Prüfen ob NOXIA Supabase-Env-Vars korrekt gesetzt sind

Vercel Dashboard → NOXIA-Projekt → Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL` — muss gesetzt sein
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — muss gesetzt sein


## Erledigt 2026-07-21

Sekundärfehler (SsfModuleActions Crash) behoben. Deployment Protection via SSF_BYPASS_SECRET gelöst.


## Resolution — 2026-07-20

403 behoben durch Deployment-Protection-Fix — erledigt

**Status: Done**
