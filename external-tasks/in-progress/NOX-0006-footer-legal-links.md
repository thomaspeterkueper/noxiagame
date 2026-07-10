<!--
KUEPER · NOXIA
Path:    external-tasks/in-progress/NOX-0006-footer-legal-links.md
Version: 1.0.1
Created: 2026-07-10
Modified: 2026-07-10
Depends: REQ-KG-LEGAL-ACCESS-20260710 (done), NOX-0005 (done)
-->

# NOX-0006 — Legal-Links im Footer/Layout einbauen

**Target:** `SYS:KUEPER:noxia`
**Origin:** OTA-Kurator
**Status:** Accepted — in progress
**Priority:** High — vor öffentlicher Bewerbung
**Blocking:** Datenschutz-Compliance

---

## Ist-Zustand

`app/layout.tsx` hat keinen Footer. Die neuen Legal-Seiten liegen unter:
- `/impressum` → `app/impressum/page.tsx`
- `/datenschutz` → `app/datenschutz/page.tsx`
- `/nutzungsbedingungen` → `app/nutzungsbedingungen/page.tsx`

Sie sind nicht global verlinkt.

---

## Requested Change

1. Globale Footer-Komponente unter `app/_components/SiteFooter.tsx` erstellen.
2. Footer in `app/layout.tsx` außerhalb des `MusicProvider` einbinden.
3. Alle drei Legal-Seiten global erreichbar machen.
4. Bestehende lokale Footer dürfen später dedupliziert werden.

---

## Bewertung NOXIA

Angenommen. Die Anforderung betrifft ausschließlich NOXIA und ist für die öffentliche Bereitstellung sinnvoll. Die Legal-Seiten bestehen bereits; offen ist nur die globale Navigation.

## Akzeptanzkriterien

- Footer auf allen NOXIA-Seiten sichtbar
- `/impressum`, `/datenschutz`, `/nutzungsbedingungen` korrekt verlinkt
- Inhalte weiterhin aus dem Knowledge Graph
- kein externer Font-Request

---

*Kurator: T.P.K. · 2026-07-10*
