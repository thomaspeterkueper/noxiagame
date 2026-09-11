'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'

type SpatialEntity = {
  id: string
  entity_id: string
  name?: string
  x_m: number | null
  y_m: number | null
  rotation_deg?: number | null
  status: string
  type_id?: string | null
}

type SpatialPayload = {
  location?: { id: string; slug: string; name: string }
  spatialRegion?: { id: string; name: string; origin?: { lat: number; lon: number } } | null
  entities?: SpatialEntity[]
  pendingBuilds?: Array<{ id: string; type_id: string; x_m: number | null; y_m: number | null; status: string }>
  error?: string
}

export default function TharsisCorePreview() {
  const [payload, setPayload] = useState<SpatialPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const token = await getToken()
        if (!token) throw new Error('Nicht angemeldet')
        const response = await fetch('/api/game/build/spatial?location=mars', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const json = await response.json() as SpatialPayload
        if (!response.ok) throw new Error(json.error ?? 'Mars-Core-Zustand konnte nicht geladen werden')
        if (!cancelled) setPayload(json)
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
      }
    })()
    return () => { cancelled = true }
  }, [])

  const entities = useMemo(() => (payload?.entities ?? []).filter(entity => entity.x_m != null && entity.y_m != null), [payload])
  const bounds = useMemo(() => {
    if (!entities.length) return { minX: -100, maxX: 100, minY: -100, maxY: 100 }
    const xs = entities.map(entity => Number(entity.x_m)), ys = entities.map(entity => Number(entity.y_m))
    const pad = 50
    return { minX: Math.min(...xs) - pad, maxX: Math.max(...xs) + pad, minY: Math.min(...ys) - pad, maxY: Math.max(...ys) + pad }
  }, [entities])
  const sx = (x: number) => ((x - bounds.minX) / Math.max(1, bounds.maxX - bounds.minX)) * 100
  const sy = (y: number) => 100 - ((y - bounds.minY) / Math.max(1, bounds.maxY - bounds.minY)) * 100

  return <section style={{ background: '#0d0b0a', color: '#eee6df', padding: '28px 24px 48px' }}>
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ fontSize: 12, letterSpacing: '.16em', opacity: .62 }}>THARSIS HUB · CORE LIVE</div>
      <h2 style={{ margin: '6px 0 4px', fontSize: 30 }}>Lokaler Weltzustand</h2>
      <p style={{ marginTop: 0, opacity: .72 }}>Bestehende Core-Objekte werden in ihren metrischen Weltkoordinaten dargestellt. Das ist der Anschluss zwischen dem kanonischen Tharsis-Hub und der neuen Mars-Geodäsie.</p>
      {error ? <div style={noticeStyle}>{error}</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16 }}>
        <div style={{ position: 'relative', minHeight: 520, border: '1px solid rgba(255,255,255,.12)', borderRadius: 16, background: 'radial-gradient(circle at 50% 48%, #43261d 0%, #251610 42%, #140e0b 100%)', overflow: 'hidden' }}>
          {entities.map(entity => <button key={entity.id} title={`${entity.name ?? entity.entity_id} · ${entity.x_m?.toFixed?.(1) ?? entity.x_m} / ${entity.y_m?.toFixed?.(1) ?? entity.y_m} m`} style={{ position: 'absolute', left: `${sx(Number(entity.x_m))}%`, top: `${sy(Number(entity.y_m))}%`, transform: `translate(-50%,-50%) rotate(${entity.rotation_deg ?? 0}deg)`, width: 12, height: 12, padding: 0, border: '1px solid rgba(255,255,255,.9)', borderRadius: entity.type_id?.includes('road') ? 2 : 4, background: entity.type_id?.includes('road') ? '#8b6b57' : '#d9a66c', boxShadow: '0 1px 5px rgba(0,0,0,.5)' }} />)}
          {!entities.length && !error ? <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: .65 }}>Core-Zustand wird geladen …</div> : null}
        </div>
        <aside style={{ display: 'grid', alignContent: 'start', gap: 12 }}>
          <div style={panelStyle}><small>LOCATION</small><div style={{ fontSize: 22, marginTop: 6 }}>{payload?.location?.name ?? 'Mars'}</div><div style={{ opacity: .65, marginTop: 5 }}>{payload?.spatialRegion?.name ?? 'Spatial region pending'}</div></div>
          <div style={panelStyle}><small>CORE OBJECTS</small><div style={{ fontSize: 28, marginTop: 6 }}>{entities.length}</div><div style={{ opacity: .65 }}>Objekte mit metrischer Position</div></div>
          <div style={panelStyle}><small>TERRAIN GATE</small><div style={{ marginTop: 7, lineHeight: 1.55, opacity: .82 }}>MOLA-DEM, Slope und Buildability werden separat auf dieselben lokalen Meterkoordinaten gelegt. Bis ein Terrain-Sample aufgelöst ist, darf Placement nicht stillschweigend als baubar gelten.</div></div>
        </aside>
      </div>
    </div>
  </section>
}

const panelStyle: React.CSSProperties = { border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', borderRadius: 14, padding: 16 }
const noticeStyle: React.CSSProperties = { border: '1px solid rgba(255,160,120,.35)', background: 'rgba(150,70,40,.16)', borderRadius: 12, padding: 12, margin: '12px 0' }
