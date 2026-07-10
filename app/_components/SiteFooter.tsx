// app/_components/SiteFooter.tsx
// Version: 1.0.0
// Erstellt: 10.07.2026 — globale Legal-Navigation (NOX-0006)

export default function SiteFooter() {
  return (
    <footer
      style={{
        marginTop: 'auto',
        borderTop: '1px solid rgba(148,163,184,0.22)',
        background: '#050910',
        color: '#718096',
        padding: '1rem 1.5rem',
        fontSize: '0.72rem',
      }}
    >
      <div
        style={{
          maxWidth: 1800,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem 1.5rem',
        }}
      >
        <span>© {new Date().getFullYear()} Thomas Peter Küper · noχ¹ᐃ Alpha</span>
        <nav aria-label="Rechtliche Informationen" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          <a href="/impressum" style={{ color: '#9fb3c8', textDecoration: 'none' }}>Impressum</a>
          <a href="/datenschutz" style={{ color: '#9fb3c8', textDecoration: 'none' }}>Datenschutz</a>
          <a href="/nutzungsbedingungen" style={{ color: '#9fb3c8', textDecoration: 'none' }}>Nutzungsbedingungen</a>
        </nav>
      </div>
    </footer>
  )
}
