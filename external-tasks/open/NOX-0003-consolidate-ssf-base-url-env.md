# NOX-0003 — SSF-Basis-URL: doppelte Env-Var konsolidieren

## Target System
NOXIA

## Origin
KueperKnowledgeGraph — Architektur-/Datenfluss-Review (Ist-Zustand 2026-07-03), am Code verifiziert

## Target Files
- `lib/ssfKnowledge.ts`
- `lib/knowledge/source.ts`

## Reason
Es existieren **zwei verschiedene Env-Variablen für dieselbe SSF-Basis-URL, mit
unterschiedlichen Default-Hosts**. Je nach aktivem Codepfad zeigt NOXIA damit auf
verschiedene SSF-Deployments — ein stiller Konfigurationsdefekt.

Verifiziert am Code:

```
lib/ssfKnowledge.ts:20  DEFAULT_SSF_BASE_URL = 'https://solarsciencefoundation.vercel.app'
lib/ssfKnowledge.ts:23  process.env.SSF_BASE_URL      ?? DEFAULT_SSF_BASE_URL
lib/knowledge/source.ts:9  process.env.SSF_API_BASE_URL ?? 'https://solarsciencefoundation.org'
```

`SSF_BASE_URL` → `…vercel.app` und `SSF_API_BASE_URL` → `….org` divergieren.

## Requested Change
1. Auf **eine** Env-Var vereinheitlichen (Vorschlag: `SSF_BASE_URL`).
2. Beide Codepfade auf diese eine Variable umstellen; `SSF_API_BASE_URL` entfernen
   oder als Alias mit identischem Default führen.
3. **Einen** kanonischen Default-Host festlegen (`.vercel.app` **oder** `.org`) und
   in `SETUP.md` dokumentieren.
4. Prüfen, ob in den Vercel-Env-Vars `SSF_BASE_URL` gesetzt ist; falls nicht,
   bewusst setzen, damit nicht der Default entscheidet.

## Priority
High (still divergierende Ziele; betrifft die einzige reale Cross-System-Kopplung)

## Blocking
Blockiert die produktive Aktivierung von NOXIA→SSF (`KNOWLEDGE_SOURCE=ssf`), weil
der Vertrag sonst nicht deterministisch auf ein Ziel zeigt.

## Status
Open

## Created
2026-07-03
