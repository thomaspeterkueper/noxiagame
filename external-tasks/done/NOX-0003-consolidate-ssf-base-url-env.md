# NOX-0003 — SSF-Basis-URL: doppelte Env-Var konsolidieren

## Target System
NOXIA

## Origin
KueperKnowledgeGraph — Architektur-/Datenfluss-Review (Ist-Zustand 2026-07-03), am Code verifiziert

## Target Files
- `lib/ssfKnowledge.ts`
- `lib/knowledge/source.ts`
- `SETUP.md`

## Reason
Es existierten zwei verschiedene Env-Variablen für dieselbe SSF-Basis-URL, mit unterschiedlichen Default-Hosts. Je nach aktivem Codepfad zeigte NOXIA damit auf verschiedene SSF-Deployments.

## Requested Change
1. Auf eine Env-Var vereinheitlichen: `SSF_BASE_URL`.
2. Beide Codepfade auf diese eine Variable umstellen; `SSF_API_BASE_URL` höchstens als Alias.
3. Einen kanonischen Default-Host festlegen und in `SETUP.md` dokumentieren.
4. Vercel-Env-Hinweis dokumentieren.

## Status
Done

## Completion Notes
- `lib/knowledge/source.ts` nutzt jetzt kanonisch `SSF_BASE_URL`.
- `SSF_API_BASE_URL` bleibt nur als rückwärtskompatibler Alias mit identischem Default erhalten.
- Kanonischer Default: `https://solarsciencefoundation.vercel.app`.
- `SETUP.md` dokumentiert `KNOWLEDGE_SOURCE` und `SSF_BASE_URL` für `.env.local` und Vercel.

## Commits
- `65eb4ee` — Consolidate SSF base url env
- `df405c9` — Document canonical SSF base url env

## Created
2026-07-03

## Completed
2026-07-08
