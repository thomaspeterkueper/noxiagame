'use client'

import type { OverlayDef } from '@/lib/game/buildings/types'

export default function BuildingOverlay({ overlay, onClose, onAction }: {
  overlay: OverlayDef
  onClose: () => void
  onAction?: (actionId: string) => void
}) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ width:'min(760px,95vw)', background:'#fff', borderRadius:12, padding:'1rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start' }}>
          <div>
            <h2 style={{ margin:0 }}>{overlay.title}</h2>
            {overlay.subtitle && <div style={{ opacity:.7 }}>{overlay.subtitle}</div>}
          </div>
          <button onClick={onClose}>✕</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'0.75rem', marginTop:'1rem' }}>
          {overlay.metrics.map(m => (
            <div key={m.id} style={{ border:'1px solid #ddd', borderRadius:8, padding:'0.75rem' }}>
              <div style={{ fontSize:'0.75rem', opacity:.7 }}>{m.label}</div>
              <div style={{ fontWeight:700 }}>{m.value}{m.unit ?? ''}</div>
              {m.hint && <div style={{ fontSize:'0.7rem', opacity:.65 }}>{m.hint}</div>}
            </div>
          ))}
        </div>

        {overlay.alerts.length > 0 && (
          <div style={{ marginTop:'1rem' }}>
            {overlay.alerts.map(a => (
              <div key={a.id} style={{ marginBottom:'0.4rem' }}>{a.text}</div>
            ))}
          </div>
        )}

        {overlay.insight && (
          <div style={{ marginTop:'1rem', padding:'0.75rem', border:'1px solid #e6e0c8', borderRadius:8 }}>
            <strong>Einordnung</strong>
            <div>{overlay.insight}</div>
          </div>
        )}

        <div style={{ display:'flex', gap:'0.5rem', marginTop:'1rem', flexWrap:'wrap' }}>
          {overlay.actions.map(a => (
            <button key={a.id} disabled={a.disabled} onClick={() => onAction?.(a.id)} style={{ fontWeight:a.primary ? 700 : 500 }}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
