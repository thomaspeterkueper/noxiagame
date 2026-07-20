'use client'

// ColonyStats.tsx
// Aktualisiert: 31.05.2026 — Kolonieübersicht-Minicard
// Version:      0.1.0
// app/dashboard/ColonyStats.tsx
// Erstellt: 31.05.2026
// Mini-Übersicht aller Kolonien als Karten-Grid
// Wird im Kolonien-Tab über den Kachelgrids angezeigt

// Konstanten für Icons und Namen
const LOC_ICON: Record<string, string> = { moon: '🌙', mars: '🔴', phobos: '🪨', earth: '🌍', prometheus: '🛸' }
const LOC_NAME: Record<string, string> = { moon: 'Mond', mars: 'Mars', phobos: 'Phobos', earth: 'Erde', prometheus: 'Prometheus' }

export default function ColonyStats({ locations }: { locations: any[] }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '1rem',
      marginBottom: '1.5rem',
    }}>
      {locations.filter((loc: any) => loc.location_type === 'colony' || !loc.location_type).map((loc: any) => {
        // Wasserressource für Anzeige
        const water  = loc.location_resources?.find((r: any) => r.resource === 'water')
        const popPct = (loc.population / loc.population_max) * 100

        return (
          <div key={loc.id} style={{
            background: `linear-gradient(135deg, ${loc.is_supplied ? '#1a3a2a' : '#3a2a2a'}, #1a2a3a)`,
            borderRadius: '12px',
            padding: '0.8rem 1rem',
            border: `1px solid ${loc.is_supplied ? '#2a6a4a' : '#6a3a2a'}`,
          }}>
            {/* Header: Name + Versorgungsstatus */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '1.1rem' }}>{LOC_ICON[loc.slug]}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff', marginLeft: '0.3rem' }}>
                  {LOC_NAME[loc.slug]}
                </span>
              </div>
              <span style={{
                fontSize: '0.55rem', padding: '2px 6px', borderRadius: '10px',
                background: loc.is_supplied ? '#2a6a4a' : '#6a3a2a', color: '#fff',
              }}>
                {loc.is_supplied ? 'VERSORGT' : 'MANGEL'}
              </span>
            </div>

            {/* Bevölkerung mit Balken */}
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.55rem', color: '#8a9ab0', marginBottom: '0.2rem' }}>BEVÖLKERUNG</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>
                {loc.population.toLocaleString('de')} / {loc.population_max.toLocaleString('de')}
              </div>
              <div style={{ background: '#0a1a2a', height: '3px', borderRadius: '2px', marginTop: '0.3rem' }}>
                <div style={{ width: `${popPct}%`, height: '100%', background: '#6fcf97', borderRadius: '2px' }} />
              </div>
            </div>

            {/* Ressourcen-Schnellübersicht */}
            <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.6rem' }}>
              <div>
                <span style={{ color: '#8a9ab0' }}>💧</span>
                <span style={{ color: '#fff', marginLeft: '2px' }}>{water?.stock ?? 0}t</span>
              </div>
              <div>
                <span style={{ color: '#8a9ab0' }}>Δ</span>
                <span style={{ color: (water?.production ?? 0) >= (water?.consumption ?? 0) ? '#6fcf97' : '#e74c3c', marginLeft: '2px' }}>
                  {((water?.production ?? 0) - (water?.consumption ?? 0)) >= 0 ? '+' : ''}
                  {(water?.production ?? 0) - (water?.consumption ?? 0)}/t
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
