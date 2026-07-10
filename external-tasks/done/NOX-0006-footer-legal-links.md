<!--
KUEPER · NOXIA
Path:    external-tasks/done/NOX-0006-footer-legal-links.md
Version: 1.1.0
Created: 2026-07-10
Completed: 2026-07-10
Depends: REQ-KG-LEGAL-ACCESS-20260710 (done), NOX-0005 (done)
-->

# NOX-0006 — Legal-Links im Footer/Layout einbauen

**Target:** `SYS:KUEPER:noxia`
**Origin:** OTA-Kurator
**Status:** Done
**Priority:** High

## Umsetzung

- `app/_components/SiteFooter.tsx` angelegt
- global in `app/layout.tsx` eingebunden
- `/impressum`, `/datenschutz` und `/nutzungsbedingungen` verlinkt
- Footer liegt außerhalb des Seiteninhalts und wird über das Root-Layout auf allen Seiten gerendert

## Commits

- `7bcaa57` — globale Footer-Komponente
- `e2cbe0b` — Footer im Root-Layout eingebunden

## Hinweis

Einzelne Seiten können noch lokale Footer enthalten. Diese können später separat dedupliziert werden; der globale Zugriff auf die Legal-Seiten ist hergestellt.
