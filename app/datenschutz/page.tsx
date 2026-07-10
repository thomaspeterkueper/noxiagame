// app/datenschutz/page.tsx
// Erstellt:     10.07.2026
// Aktualisiert: 10.07.2026 — Initiale Version, Quelle: DOC:KUE:LEGAL-PRIVACY-DE
// Version:      1.0.0
// Status: draft_productive — nicht juristisch freigegeben
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Datenschutz — noχ¹ᐃ', robots: 'noindex' }

const S = {
  page:  { maxWidth: 680, margin: '4rem auto', padding: '0 1.5rem', fontFamily: 'system-ui, sans-serif', color: '#1a1a18', lineHeight: 1.75 } as React.CSSProperties,
  h1:    { fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.4rem' } as React.CSSProperties,
  h2:    { fontSize: '1rem', fontWeight: 700, margin: '1.5rem 0 0.4rem' } as React.CSSProperties,
  draft: { background: '#fef3cd', border: '1px solid #e8c040', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '2rem', fontSize: '0.8rem', color: '#6b4c00' } as React.CSSProperties,
  foot:  { fontSize: '0.72rem', color: '#9e9485', marginTop: '3rem', borderTop: '1px solid #ddd6c8', paddingTop: '1rem' } as React.CSSProperties,
  link:  { color: '#2a4e7a' },
}

export default function DatenschutzPage() {
  return (
    <main style={S.page}>
      <h1 style={S.h1}>Datenschutzerklärung</h1>
      <div style={S.draft}>
        <strong>Entwurf — nicht juristisch freigegeben.</strong> Status: <code>draft_productive</code>.
        Vor produktiver Nutzung juristisch prüfen lassen.
      </div>

      <h2 style={S.h2}>1. Verantwortlicher</h2>
      <p>Thomas Peter Küper, Mörfelder Landstraße 103, 60598 Frankfurt am Main, Deutschland,<br />
      E-Mail: <a href="mailto:t.kueper@camaleo.de" style={S.link}>t.kueper@camaleo.de</a></p>

      <h2 style={S.h2}>2. Hosting</h2>
      <p>NOXIA wird über <strong>Vercel</strong> ausgeliefert. Beim Aufruf können technisch notwendige
      Zugriffsdaten verarbeitet werden (IP-Adresse, Zeitpunkt, Ressource, Referrer, Browser).
      Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.</p>

      <h2 style={S.h2}>3. Schriftarten</h2>
      <p>NOXIA lädt derzeit Courier Prime und Playfair Display von Google Fonts. Beim Laden wird
      eine Verbindung zu Google-Servern hergestellt (NOX-0005: Umstellung auf self-hosted beauftragt).</p>

      <h2 style={S.h2}>4. Cookies</h2>
      <p>Keine Analyse- oder Marketing-Cookies. Für Benutzerkonten werden technisch notwendige
      Session-Cookies eingesetzt. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</p>

      <h2 style={S.h2}>5. Benutzerkonten (Supabase)</h2>
      <p>NOXIA verwendet <strong>Supabase</strong> für Authentifizierung und Spielstände.
      Gespeichert werden: E-Mail-Adresse, Benutzername, Avatar, Credits, Spielfortschritt.
      Konto-Löschung: Einstellungen → Account löschen. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</p>

      <h2 style={S.h2}>6. Betroffenenrechte</h2>
      <p>Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch nach DSGVO.
      Anfragen an: <a href="mailto:t.kueper@camaleo.de" style={S.link}>t.kueper@camaleo.de</a></p>

      <h2 style={S.h2}>7. Beschwerderecht</h2>
      <p>Zuständige Aufsichtsbehörde: Hessischer Beauftragter für Datenschutz und Informationsfreiheit.</p>

      <p style={S.foot}>Stand: 2026-07-09 · Quelle: DOC:KUE:LEGAL-PRIVACY-DE (draft_productive)</p>
      <p style={{ marginTop: '1.5rem' }}><a href="/" style={S.link}>← Zurück</a></p>
    </main>
  )
}
