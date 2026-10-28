// app/earth/HospitalityItemIcon.tsx
// Gezeichnete Bilder für die Posten der Karte. Eigene Zeichnungen statt Emoji,
// damit Speisen und Getränke auf jedem Gerät gleich aussehen.
// Unbekannte Posten bekommen einen Teller mit Haube – nie ein leeres Feld.

import type { ReactNode } from 'react'

const LINE = '#2b2018'
const s = { stroke: LINE, strokeWidth: 1.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

const ICONS: Record<string, ReactNode> = {
  // Becher mit Dampf
  drink: <>
    <path d="M8 13h14v9a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" fill="#f4ead6" {...s} />
    <path d="M22 15h2.5a3 3 0 0 1 0 6H22" fill="none" {...s} />
    <path d="M9.5 15h11v2.5h-11z" fill="#7a4a2a" />
    <path d="M12 9c-1.5-2 1.5-3 0-5M17 9c-1.5-2 1.5-3 0-5" fill="none" stroke="#c9d6d2" strokeWidth="1.5" strokeLinecap="round" />
  </>,
  // Tortenstück
  cake: <>
    <path d="M4 24 26 12v12z" fill="#f1d9a8" {...s} />
    <path d="M4 24 26 12v4L6.5 24z" fill="#fff6e6" {...s} />
    <path d="M10 24l16-5" fill="none" stroke="#c0574a" strokeWidth="2" />
    <circle cx="23" cy="10" r="2.6" fill="#d2423a" {...s} />
    <path d="M3 27h26" {...s} />
  </>,
  // Teller mit Besteck
  meal: <>
    <circle cx="16" cy="17" r="9" fill="#f4ead6" {...s} />
    <circle cx="16" cy="17" r="5.5" fill="#e8d9bb" stroke={LINE} strokeWidth="1" />
    <path d="M13 16a3 2.5 0 0 1 6 0z" fill="#b5713c" />
    <circle cx="14" cy="19" r="1.5" fill="#6f9a4b" /><circle cx="18.5" cy="19.5" r="1.5" fill="#d2423a" />
    <path d="M3.5 8v8M2 8v4a1.5 1.5 0 0 0 3 0V8M3.5 16v10" fill="none" {...s} />
    <path d="M29 8c-2 2-2 6 0 8v10" fill="none" {...s} />
  </>,
  // Brezel
  snack: <>
    <path d="M16 14c-3-7-12-5-11 2 1 6 8 8 11 2 3 6 10 4 11-2 1-7-8-9-11-2z" fill="none" stroke="#a8672f" strokeWidth="4" strokeLinejoin="round" />
    <path d="M9 24 16 16l7 8" fill="none" stroke="#a8672f" strokeWidth="4" strokeLinecap="round" />
    <circle cx="8" cy="14" r=".8" fill="#fff" /><circle cx="16" cy="19" r=".8" fill="#fff" /><circle cx="24" cy="14" r=".8" fill="#fff" /><circle cx="12" cy="22" r=".8" fill="#fff" />
  </>,
  // Hohes Glas mit Halm und Scheibe
  longdrink: <>
    <path d="M10 8h12l-1.5 19h-9z" fill="#dff1ee" {...s} />
    <path d="M10.6 14h10.8L20.5 27h-9z" fill="#e58a3c" />
    <path d="M18 14 23 3" fill="none" stroke="#d2423a" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="10" cy="9" r="3.5" fill="#f2d24b" {...s} />
    <rect x="13" y="17" width="3" height="3" fill="#fff" opacity=".7" /><rect x="16.5" y="21" width="3" height="3" fill="#fff" opacity=".7" />
  </>,
  // Salatschale
  starter: <>
    <path d="M6 15c1-5 5-6 7-3 1-5 7-5 8 0 3-2 6 0 5 3z" fill="#6f9a4b" {...s} />
    <circle cx="13" cy="13" r="1.6" fill="#d2423a" /><circle cx="20" cy="12" r="1.6" fill="#f2d24b" />
    <path d="M4 15h24a12 11 0 0 1-24 0z" fill="#f4ead6" {...s} />
    <path d="M12 27h8" {...s} />
  </>,
  // Teller unter der Haube
  main: <>
    <path d="M5 22a11 11 0 0 1 22 0z" fill="#d7dcdc" {...s} />
    <path d="M9 19a7 7 0 0 1 5-5" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="16" cy="9.5" r="1.8" fill="#d7dcdc" {...s} />
    <path d="M3 22h26v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#f4ead6" {...s} />
  </>,
  // Wasserflasche – Grundversorgung der Hafenkantine
  water: <>
    <path d="M13 4h6v3h-6z" fill="#8fb7c9" {...s} />
    <path d="M12 7h8l2 5v13a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V12z" fill="#dff1f7" {...s} />
    <path d="M11 16h10v9a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1z" fill="#8fc5e0" />
    <path d="M14 13h4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
  </>,
  // Ration – verpackter Riegel
  ration: <>
    <path d="M5 11h22v12H5z" fill="#b9a46b" {...s} />
    <path d="M5 11l-2-3M27 11l2-3M5 23l-2 3M27 23l2 3" fill="none" {...s} />
    <path d="M9 14h14v6H9z" fill="#6f5a2b" />
    <path d="M12 16h8M12 18h8" stroke="#d9c58c" strokeWidth="1" />
  </>,
  // Zimmerschlüssel – ein Zimmer für eine Nacht
  room_night: <>
    <circle cx="11" cy="11" r="7" fill="#e8c35a" {...s} />
    <circle cx="11" cy="11" r="2.5" fill="#6b5a2b" />
    <path d="M16 16l11 11M23 23l3-3M20 20l3-3" fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
    <path d="M16 16l11 11M23 23l3-3M20 20l3-3" fill="none" stroke="#e8c35a" strokeWidth="1.5" strokeLinecap="round" />
  </>,
  // Eintrittskarte mit Abriss (Nachtclub)
  entry: <>
    <path d="M4 10h24v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z" fill="#b14cff" {...s} />
    <path d="M21 10v12" fill="none" stroke="#fff" strokeWidth="1.2" strokeDasharray="1.5 1.5" />
    <path d="M9 16h8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
  </>,
  // Kurzes Glas (Shot)
  shot: <>
    <path d="M11 11h10l-1.5 12h-7z" fill="#dff1ee" {...s} />
    <path d="M11.6 15h8.8l-1 8h-6.8z" fill="#e5c23c" />
  </>,
  // Dessertglas
  dessert: <>
    <path d="M8 12h16a8 8 0 0 1-16 0z" fill="#dff1ee" {...s} />
    <path d="M9 12a7 6 0 0 1 14 0z" fill="#f6d9de" {...s} />
    <circle cx="16" cy="5.5" r="2.2" fill="#d2423a" {...s} />
    <path d="M16 20v6M11 27h10" fill="none" {...s} />
  </>,
}

export const HOSPITALITY_ICON_CODES = Object.keys(ICONS)

export default function HospitalityItemIcon({ code, size = 32, title }: { code: string; size?: number; title?: string }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={title ?? code} style={{ display: 'block', flex: 'none' }}>
    {title && <title>{title}</title>}
    {ICONS[code] ?? ICONS.main}
  </svg>
}
