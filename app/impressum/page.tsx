// app/impressum/page.tsx
// Erstellt:     10.07.2026
// Aktualisiert: 10.07.2026 — Initiale Version, Quelle: DOC:KUE:LEGAL-IMPRINT-DE
// Version:      1.0.0
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Impressum — noχ¹ᐃ', robots: 'noindex' }

const S = {
  page:  { maxWidth: 640, margin: '4rem auto', padding: '0 1.5rem', fontFamily: 'system-ui, sans-serif', color: '#1a1a18', lineHeight: 1.7 } as React.CSSProperties,
  h1:    { fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.4rem' } as React.CSSProperties,
  h2:    { fontSize: '1rem', fontWeight: 700, margin: '1.5rem 0 0.4rem' } as React.CSSProperties,
  sub:   { fontSize: '0.75rem', color: '#6b6357', marginBottom: '2rem' } as React.CSSProperties,
  foot:  { fontSize: '0.72rem', color: '#9e9485', marginTop: '3rem', borderTop: '1px solid #ddd6c8', paddingTop: '1rem' } as React.CSSProperties,
  link:  { color: '#2a4e7a' },
}

export default function ImpressumPage() {
  return (
    <main style={S.page}>
      <h1 style={S.h1}>Impressum</h1>
      <p style={S.sub}>Angaben gemäß § 5 TMG</p>

      <h2 style={S.h2}>Verantwortlicher</h2>
      <p>Thomas Peter Küper<br />
      Mörfelder Landstraße 103, 60598 Frankfurt am Main, Deutschland<br />
      E-Mail: <a href="mailto:t.kueper@camaleo.de" style={S.link}>t.kueper@camaleo.de</a></p>

      <h2 style={S.h2}>Hinweis</h2>
      <p>NOXIA ist ein privates Hobby- und Forschungsprojekt in der Alpha-Phase.</p>

      <h2 style={S.h2}>Haftung für Inhalte</h2>
      <p>Die Inhalte wurden sorgfältig erstellt. Für Richtigkeit, Vollständigkeit und Aktualität
      kann keine Gewähr übernommen werden.</p>

      <p style={S.foot}>Stand: 2026-07-09 · Quelle: DOC:KUE:LEGAL-IMPRINT-DE</p>
      <p style={{ marginTop: '1.5rem' }}><a href="/" style={S.link}>← Zurück</a></p>
    </main>
  )
}
