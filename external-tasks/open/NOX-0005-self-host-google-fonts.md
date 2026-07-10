# NOX-0005 — Verbleibende Google Fonts self-hosten

## Target System
NOXIA

## Origin
Kueper Knowledge Graph — Datenschutz-/Legal-Review

## Target File
`app/layout.tsx`

## Status
Open

## Priority
Medium-High

## Reason
Courier Prime und Playfair Display werden aktuell über rohe Remote-Links von `fonts.googleapis.com` und `fonts.gstatic.com` geladen. Dadurch baut der Browser des Besuchers eine Verbindung zu Google auf. Geist und Geist Mono sind bereits über `next/font/google` eingebunden und werden beim Build self-hosted.

## Requested Change

1. Imports erweitern:

```ts
import {
  Geist,
  Geist_Mono,
  Courier_Prime,
  Playfair_Display,
} from 'next/font/google'
```

2. Fonts konfigurieren:

```ts
const courierPrime = Courier_Prime({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-courier-prime',
})

const playfair = Playfair_Display({
  weight: ['400', '700', '900'],
  subsets: ['latin'],
  variable: '--font-playfair',
})
```

3. Beide Variablen wie Geist/Geist Mono auf `<html>` oder `<body>` anwenden.
4. Die Remote-`<link>`-Einbindung einschließlich beider `preconnect`-Zeilen zu Google entfernen.
5. CSS auf lokale Variablen umstellen beziehungsweise prüfen:

```css
font-family: var(--font-courier-prime);
font-family: var(--font-playfair);
```

6. Nach dem Build prüfen, dass im ausgelieferten HTML/CSS keine Laufzeitreferenz auf `fonts.googleapis.com` oder `fonts.gstatic.com` verbleibt.

## Akzeptanzkriterien

- Courier Prime und Playfair Display werden durch Next.js beim Build self-hosted.
- Keine Google-Font-Requests im Browser-Netzwerkprotokoll.
- Typografie bleibt visuell erhalten.
- Keine unnötigen `preconnect`-Links zu Google Fonts.

## Blocking
Vor öffentlicher NOXIA-Bewerbung und vor juristischer Freigabe der Datenschutzerklärung erledigen.

## Created
2026-07-09

## Curator
T.P.K.
