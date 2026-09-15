'use client'

import { buildInteriorTemplateOverview, type InteriorTemplate } from '@/lib/game/buildings/interiors'

export default function InteriorTemplateOverview({
  template,
  hostId,
}: {
  template: InteriorTemplate
  hostId?: string
}) {
  const overview = buildInteriorTemplateOverview(template)

  return (
    <section style={{ marginBottom: 14, border: '1px solid #b9c7c7', borderRadius: 9, background: '#f8faf7', overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', background: '#dfe8e5', borderBottom: '1px solid #b9c7c7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <div>
            <small style={{ display: 'block', color: '#607279', fontWeight: 800, letterSpacing: '.07em' }}>INNENRAUMPLAN · VORLAGE</small>
            <b style={{ display: 'block', marginTop: 3, color: '#173744' }}>{overview.name}</b>
          </div>
          <small style={{ color: '#708186' }}>v{overview.version}{hostId ? ` · Host ${hostId}` : ''}</small>
        </div>
        <p style={{ margin: '6px 0 0', color: '#607279', fontSize: 10, lineHeight: 1.45 }}>
          Struktur und Fähigkeiten stammen aus dem gemeinsamen Interior-Core. Angezeigt wird noch kein persistierter Raum-, Personen-, Zugriffs- oder Umweltzustand. Eine vorhandene Fähigkeit oder Funktion bedeutet weder Wissens-Freischaltung noch Autorisierung des Spielers.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 8, padding: 10 }}>
        {overview.levels.map(level => (
          <details key={level.id} open={level.order === 0} style={{ border: '1px solid #ccd6d4', borderRadius: 7, background: '#fff' }}>
            <summary style={{ cursor: 'pointer', padding: '8px 10px', fontSize: 11, fontWeight: 900, color: '#244553' }}>
              {level.name} · {level.rooms.length} Räume
            </summary>
            <div style={{ display: 'grid', gap: 6, padding: '0 9px 9px' }}>
              {level.rooms.map(room => (
                <div key={room.id} style={{ padding: '8px 9px', borderTop: '1px solid #e2e8e6', fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <b style={{ color: '#1f3e49' }}>{room.name}</b>
                    <span style={{ color: '#74868a' }}>{room.kind}{room.capacity ? ` · Kapazität ${room.capacity}` : ''}</span>
                  </div>

                  {room.capabilities.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                      {room.capabilities.map(capability => (
                        <span key={capability.id} title={capability.id} style={{ padding: '3px 6px', borderRadius: 999, background: '#edf2ef', border: '1px solid #d3dcda', color: '#38545d' }}>
                          {capability.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {room.functions.length > 0 && (
                    <div style={{ marginTop: 6, color: '#62757a', lineHeight: 1.45 }}>
                      Funktionen: {room.functions.map(item => item.label).join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
