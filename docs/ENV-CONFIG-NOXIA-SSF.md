<!--
KUEPER · NOXIA + SSF Cross-System-Konfiguration
Path:    docs/ENV-CONFIG-NOXIA-SSF.md
Version: 1.0.0
Created: 2026-07-08
Bezug:   NOX-0003, NOX-0004, KG-0003
-->

# ENV-CONFIG-NOXIA-SSF.md
## Umgebungsvariablen für die NOXIA↔SSF-Verbindung

**Status:** Kanonisch  
**Zielgruppe:** Vercel-Deployment beider Projekte  
**Voraussetzung:** Vercel Pro (beide Projekte), NOX-0003, KG-0003  

---

## Übersicht

```
NOXIA ──── SSF_BASE_URL ────────────────────────→ SSF /api/noxia/*
             + X-NOXIA-API-KEY (NOXIA_API_KEY)
SSF   ──── NOXIA_API_KEY ────────────────────────→ Authentifizierung
```

---

## Schritt 1 — Gemeinsamen API-Key generieren

Einmalig ausführen (lokal oder in der Vercel-Shell):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Diesen Wert notieren. Er wird identisch in **beide** Projekte eingetragen.

---

## Schritt 2 — NOXIA: Vercel-Env-Vars setzen

```bash
# In das NOXIA-Projektverzeichnis wechseln
cd noxiagame

# SSF_BASE_URL (kanonisch, nicht mehr SSF_API_BASE_URL)
vercel env add SSF_BASE_URL
# Sensitive? → N
# Wert: https://solarsciencefoundation.vercel.app
# Environments → Production, Preview, Development (alle drei)

# API-Key für SSF-Authentifizierung
vercel env add NOXIA_API_KEY
# Sensitive? → Y
# Wert: <generierter Key aus Schritt 1>
# Environments → Production, Preview, Development

# SSF-Wissensmodus aktivieren
vercel env add KNOWLEDGE_SOURCE
# Sensitive? → N
# Wert: ssf
# Environments → Production (Preview erstmal auf 'local' lassen)
```

**Achtung:** `SSF_API_BASE_URL` ist veraltet. Nur `SSF_BASE_URL` verwenden.

---

## Schritt 3 — SSF: Vercel-Env-Vars setzen

```bash
# In das SSF-Projektverzeichnis wechseln
cd solarsciencefoundation

# Identischer API-Key (derselbe Wert wie in NOXIA)
vercel env add NOXIA_API_KEY
# Sensitive? → Y
# Wert: <identischer Key aus Schritt 1>
# Environments → Production, Preview, Development

# Optional: NOXIA-Origin für CORS
vercel env add NOXIA_ORIGIN
# Sensitive? → N
# Wert: https://noxiagame.vercel.app
# Environments → Production
```

---

## Schritt 4 — Deployment triggern

```bash
# NOXIA neu deployen
cd noxiagame && vercel --prod

# SSF neu deployen
cd solarsciencefoundation && vercel --prod
```

---

## Schritt 5 — Verbindung testen

```bash
# Test 1: SSF-Endpunkt direkt
curl -X POST https://solarsciencefoundation.vercel.app/api/noxia/unlocks/check \
  -H "Content-Type: application/json" \
  -H "X-NOXIA-API-KEY: <dein-key>" \
  -d '{"completedModules": ["MAT-L0-000001"], "unlockId": "UNL:NOX:orbital-navigation"}'

# Erwartete Antwort:
# { "schema": "SSF-NOXIA-UNLOCK-CHECK-0.2", "mode": "authenticated", ... }

# Test 2: Via NOXIA-Proxy
curl -X POST https://noxiagame.vercel.app/api/ssf/unlocks/check \
  -H "Content-Type: application/json" \
  -d '{"completedModules": ["MAT-L0-000001"], "unlockId": "UNL:NOX:orbital-navigation"}'

# Erwartete Antwort:
# { "schema": "NOXIA-SSF-UNLOCK-CHECK-0.1", "source": "https://solarsciencefoundation.vercel.app", ... }
```

---

## Vollständige Env-Var-Übersicht

### NOXIA (`noxiagame`)

| Variable | Wert | Sensitiv | Pflicht |
|----------|------|----------|---------|
| `SSF_BASE_URL` | `https://solarsciencefoundation.vercel.app` | N | Ja |
| `NOXIA_API_KEY` | `<generierter Key>` | **Y** | Ja (für Prod) |
| `KNOWLEDGE_SOURCE` | `ssf` | N | Für SSF-Modus |
| `CRON_SECRET` | `<generierter Key>` | **Y** | Ja |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-URL | N | Ja |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-Role-Key | **Y** | Ja |

### SSF (`solarsciencefoundation`)

| Variable | Wert | Sensitiv | Pflicht |
|----------|------|----------|---------|
| `NOXIA_API_KEY` | `<identischer Key>` | **Y** | Ja (für Prod) |
| `NOXIA_ORIGIN` | `https://noxiagame.vercel.app` | N | Für CORS |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-URL | N | Ja |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-Role-Key | **Y** | Ja |
| `KUEPER_KXF_MODULES_URL` | *(leer = GitHub Raw Default)* | N | Optional |

---

## Was danach funktioniert

Nach erfolgreichem Setup:

- NOXIA→SSF-Verbindung ist authentifiziert und produktiv
- `KNOWLEDGE_SOURCE=ssf` schaltet Wissensinhalte von SSF statt lokalem Fallback
- Cron-Jobs `population` (tägl. 08:00), `prices` (alle 30 min), `orders` (stündl. :15) laufen
- SSF-`/api/noxia/unlocks/check` antwortet mit `mode: "authenticated"`
- Demo-Endpunkt `/api/noxia/unlocks/demo` bleibt für Tests erhalten

---

## NOX-0003 / NOX-0004 Checkliste

- [x] `lib/knowledge/source.ts` — `SSF_BASE_URL` kanonisch, `SSF_API_BASE_URL` als Alias
- [x] `lib/ssfKnowledge.ts` — verwendet `SSF_BASE_URL`
- [x] `app/api/ssf/unlocks/check/route.ts` — sendet `X-NOXIA-API-KEY`
- [x] `vercel.json` — alle drei Crons vorhanden (population, prices, orders)
- [ ] Vercel: `NOXIA_API_KEY` in NOXIA setzen
- [ ] Vercel: `NOXIA_API_KEY` in SSF setzen
- [ ] Vercel: `SSF_BASE_URL` in NOXIA setzen (falls noch nicht gesetzt)
- [ ] Vercel: `KNOWLEDGE_SOURCE=ssf` in NOXIA Production setzen
- [ ] Deploy beide Projekte neu
- [ ] Test via curl (Schritt 5)

---

*Kurator: T.P.K. · 2026-07-08 · Bezug: NOX-0003, NOX-0004, KG-0003*
