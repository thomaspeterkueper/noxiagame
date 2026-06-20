// app/dashboard/ui.tsx
// Erstellt:     15.06.2026
// Aktualisiert: 15.06.2026
//
// Geteilte UI-Primitive des Dashboards (Refactor Schritt 1): die Design-Tokens
// T, die Inline-SVG-Icon-Sammlung sowie die Mini-Komponenten Toast und
// SectionHead. Aus DashboardClient.tsx herausgelöst, damit künftig
// ausgelagerte Teile (BuyRow, Render-Blöcke) dieselben Bausteine importieren
// statt sie zu duplizieren.
//
// Bewusst KEIN 'use client': alle vier sind rein präsentational bzw. Daten
// (keine Hooks, kein State, keine Browser-APIs) und damit in Server- wie
// Client-Komponenten nutzbar. Importiert von einer Client-Komponente landen
// sie automatisch im Client-Bundle — Verhalten identisch zu vorher.

// ─── Display-Maps ─────────────────────────────────────────────────────────
export const RESOURCE_LABEL: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }
export const RESOURCE_ICON:  Record<string, string> = { water: '💧', energy: '⚡', metal: '⛏️' }
export const LOC_ICON:       Record<string, string> = { moon: '🌙', mars: '🔴', phobos: '🪨' }
export const LOC_NAME:       Record<string, string> = { moon: 'Mond', mars: 'Mars', phobos: 'Phobos' }

// ─── Design-Tokens ───────────────────────────────────────────────────────────
export const T = {
  ink:      '#1b2733',
  inkSoft:  '#5a6b7b',
  inkFaint: '#94a3b8',
  blue:     '#2a4e7a',
  blueDeep: '#1d3a5f',
  gold:     '#b99b6b',
  goldHot:  '#c9a961',
  bg:       '#f4f2ed',
  surface:  '#ffffff',
  line:     '#e7e2d8',
  lineSoft: '#f0ece3',
  green:    '#2f9e6b',
  red:      '#c0563f',
  radius:   '10px',
  radiusLg: '14px',
}

// ─── Inline-SVG-Icons ─────────────────────────────────────────────────────────
export const Icon = {
  trade: (c = 'currentColor') => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h13l-3-3M21 17H8l3 3"/></svg>,
  bolt:  (c = 'currentColor') => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>,
  ship:  (c = 'currentColor') => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17h18M5 17l1-5h12l1 5M9 12V7h6v5M11 7V4h2v3"/></svg>,
  globe: (c = 'currentColor') => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" strokeLinecap="round"/></svg>,
  chart: (c = 'currentColor') => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>,
  arrow: (c = 'currentColor') => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  logout:(c = 'currentColor') => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  alert: (c = 'currentColor') => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>,
  orbit: (c = 'currentColor') => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2.5"/><ellipse cx="12" cy="12" rx="9.5" ry="4.5"/><circle cx="21.5" cy="12" r="1.3" fill={c} stroke="none"/></svg>,
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{
      position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
      background: ok ? T.blue : T.red, color: '#fff', padding: '0.7rem 1.6rem',
      borderRadius: T.radius, fontSize: '0.82rem', fontWeight: 600, zIndex: 3000,
      boxShadow: '0 8px 24px rgba(27,39,51,0.18)', letterSpacing: '0.01em',
    }}>{msg}</div>
  )
}

// ─── Abschnitts-Überschrift ─────────────────────────────────────────────────
export function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: '1.05rem', color: T.blueDeep, margin: 0, letterSpacing: '0.01em' }}>{title}</h2>
      {action}
    </div>
  )
}
