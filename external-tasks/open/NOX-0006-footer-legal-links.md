<!--
KUEPER · NOXIA
Path:    external-tasks/open/NOX-0006-footer-legal-links.md
Version: 1.0.0
Created: 2026-07-10
Depends: REQ-KG-LEGAL-ACCESS-20260710 (done), NOX-0005 (done)
-->

# NOX-0006 — Legal-Links im Footer/Layout einbauen

**Target:** `SYS:KUEPER:noxia`
**Origin:** OTA-Kurator
**Status:** Open
**Priority:** High — vor öffentlicher Bewerbung
**Blocking:** Datenschutz-Compliance

---

## Ist-Zustand

`app/layout.tsx` hat keinen Footer. Die neuen Legal-Seiten liegen unter:
- `/impressum` → `app/impressum/page.tsx`
- `/datenschutz` → `app/datenschutz/page.tsx`
- `/nutzungsbedingungen` → `app/nutzungsbedingungen/page.tsx`

Sie sind nirgends verlinkt.

---

## Requested Change

### 1. Footer-Komponente erstellen: `app/_components/SiteFooter.tsx`

```tsx
export default function SiteFooter() {
  return (
    <footer className="border-t border-gray-800 mt-auto py-6 px-4">
      <div className="max-w-7xl mx-auto flex flex-wrap gap-4 justify-between
                      text-xs text-gray-500">
        <span>© {new Date().getFullYear()} Thomas Peter Küper · noχ¹ᐃ Alpha</span>
        <nav className="flex gap-4">
          <a href="/impressum" className="hover:text-gray-300">Impressum</a>
          <a href="/datenschutz" className="hover:text-gray-300">Datenschutz</a>
          <a href="/nutzungsbedingungen" className="hover:text-gray-300">
            Nutzungsbedingungen
          </a>
        </nav>
      </div>
    </footer>
  );
}
```

### 2. `app/layout.tsx` — Footer einbinden

```tsx
import SiteFooter from './_components/SiteFooter';

// In RootLayout:
<body className="min-h-full flex flex-col">
  <MusicProvider>
    {children}
    <MusicControls />
  </MusicProvider>
  <SiteFooter />
</body>
```

### 3. Verifikation

- Footer erscheint auf allen Seiten
- Alle drei Links führen zu den Legal-Seiten
- Inhalte kommen aus KG, kein lokal gepflegter Text
- Draft-Banner sichtbar

---

## Akzeptanzkriterien

- Footer auf allen NOXIA-Seiten sichtbar
- `/impressum`, `/datenschutz`, `/nutzungsbedingungen` erreichbar und korrekt
- Kein Google-Font-Request (NOX-0005 bereits erledigt) ✓

---

*Kurator: T.P.K. · 2026-07-10*
