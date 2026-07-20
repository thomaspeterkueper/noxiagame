# ADR: Next.js 'use client' — Pflichtposition als erste Zeile

**Datum:** 20.07.2026
**Status:** Accepted
**Gilt für:** noxiagame, solarsciencefoundation, alle zukünftigen Next.js-Projekte

## Kontext

Next.js (App Router) verlangt dass die `'use client'` Direktive die **allererste
Anweisung** in einer Datei ist — noch vor Kommentaren, Leerzeilen und Imports.

Wenn Header-Kommentare (Dateiname, Version, Datum) vor `'use client'` stehen,
erkennt Next.js die Direktive nicht. Die Datei wird als Server-Komponente
behandelt. React-Hooks (`useState`, `useEffect` etc.) in Server-Komponenten
verursachen einen Runtime-Crash: **"This page couldn't load"**.

## Entscheidung

`'use client'` steht **immer als erste Zeile**, vor allen Kommentaren:

```typescript
'use client'
// app/dashboard/MyComponent.tsx
// Aktualisiert: 20.07.2026 — Beschreibung
// Version:      1.0.0

import React, { useState } from 'react'
// ...
```

**Niemals:**
```typescript
// app/dashboard/MyComponent.tsx   ← FALSCH
// Aktualisiert: 20.07.2026
// Version:      1.0.0
'use client'                       ← zu spät
import React from 'react'
```

## Geltungsbereich

- Alle `.tsx` und `.ts` Dateien die React-Hooks oder Browser-APIs verwenden
- Alle Komponenten im `app/dashboard/` Verzeichnis
- Alle Client-seitigen Bibliotheken (`lib/ably/client.ts` etc.)

## Gilt NICHT für

- API-Routes (`app/api/**`) — keine `'use client'` nötig
- Server-Komponenten — keine `'use client'` nötig
- Reine Typ-Definitionen und Utility-Funktionen ohne React

## Konsequenzen

- Versionsheader kommen nach `'use client'`, nicht davor
- Bei Code-Reviews: erste Zeile prüfen wenn Hooks verwendet werden
- Automated Check: `grep -rn "'use client'" . | awk -F: '{print $1}' | while read f; do head -1 "$f"; done`

## Hintergrund

Entdeckt am 20.07.2026 — 40 Dateien in NOXIA waren betroffen und verursachten
sporadische Crashes der Akademie und anderer Overlays. Fix: atomarer Commit
`c5c9471` hat alle 38 betroffenen Dateien korrigiert.
