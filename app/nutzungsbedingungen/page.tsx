// app/nutzungsbedingungen/page.tsx
// Erstellt:     10.07.2026
// Aktualisiert: 10.07.2026 — Initiale Version, Quelle: DOC:KUE:LEGAL-TERMS-DE
// Version:      1.0.0
// Status: draft_productive — nicht juristisch freigegeben
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Nutzungsbedingungen — noχ¹ᐃ', robots: 'noindex' }

const S = {
  page:  { maxWidth: 680, margin: '4rem auto', padding: '0 1.5rem', fontFamily: 'system-ui, sans-serif', color: '#1a1a18', lineHeight: 1.75 } as React.CSSProperties,
  h1:    { fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.4rem' } as React.CSSProperties,
  h2:    { fontSize: '1rem', fontWeight: 700, margin: '1.5rem 0 0.4rem' } as React.CSSProperties,
  draft: { background: '#fef3cd', border: '1px solid #e8c040', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '2rem', fontSize: '0.8rem', color: '#6b4c00' } as React.CSSProperties,
  foot:  { fontSize: '0.72rem', color: '#9e9485', marginTop: '3rem', borderTop: '1px solid #ddd6c8', paddingTop: '1rem' } as React.CSSProperties,
  link:  { color: '#2a4e7a' },
}

export default function NutzungsbedingungenPage() {
  return (
    <main style={S.page}>
      <h1 style={S.h1}>Nutzungsbedingungen</h1>
      <div style={S.draft}>
        <strong>Entwurf — nicht juristisch freigegeben.</strong> Status: <code>draft_productive</code>.
        Vor produktiver Nutzung juristisch prüfen lassen.
      </div>

      <h2 style={S.h2}>1. Anbieter</h2>
      <p>Thomas Peter Küper, Mörfelder Landstraße 103, 60598 Frankfurt am Main, Deutschland.<br />
      E-Mail: <a href="mailto:t.kueper@camaleo.de" style={S.link}>t.kueper@camaleo.de</a></p>

      <h2 style={S.h2}>2. Gegenstand</h2>
      <p>NOXIA ist ein privates Hobby- und Forschungsprojekt in der Alpha-Phase — eine browserbasierte
      Wirtschafts- und Zivilisationssimulation. Inhalte können als Entwurf oder Arbeitszustand
      gekennzeichnet sein.</p>

      <h2 style={S.h2}>3. Benutzerkonten</h2>
      <p>Zugangsdaten sind vertraulich zu behandeln. Missbrauch, technische Eingriffe oder
      das Verwenden fremder Konten sind untersagt.</p>

      <h2 style={S.h2}>4. Urheberrecht</h2>
      <p>Inhalte, Spielmechaniken und Texte können urheberrechtlich geschützt sein. Private Nutzung
      im Rahmen des Spielbetriebs ist gestattet. Kommerzielle Verwertung bedarf der Zustimmung.</p>

      <h2 style={S.h2}>5. Haftung</h2>
      <p>Das Spiel befindet sich in der Alpha-Phase. Es besteht kein Anspruch auf dauerhafte
      Verfügbarkeit. Haftung für Vorsatz und grobe Fahrlässigkeit bleibt unberührt.</p>

      <h2 style={S.h2}>6. Anwendbares Recht</h2>
      <p>Es gilt deutsches Recht.</p>

      <p style={S.foot}>Stand: 2026-07-09 · Quelle: DOC:KUE:LEGAL-TERMS-DE (draft_productive)</p>
      <p style={{ marginTop: '1.5rem' }}><a href="/" style={S.link}>← Zurück</a></p>
    </main>
  )
}
