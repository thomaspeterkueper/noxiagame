'use client'

import { useEffect, useMemo, useState } from 'react'
import type { EarthLandmark } from '@/lib/world/spatial/earthLandmarks'

type GeoPoint = { lat: number; lon: number }
type Feature = {
  id: string
  featureType: string
  properties?: Record<string, string>
  geometry: { kind: 'point'; coordinates: GeoPoint } | { kind: 'line' | 'polygon'; coordinates: GeoPoint[] }
}
type Payload = {
  ok: boolean
  bounds?: { south: number; west: number; north: number; east: number }
  features?: Feature[]
  attribution?: string
  error?: string
}

const W = 1000
const H = 560
const PAD = 28

function styleFor(type: string) {
  switch (type) {
    case 'water': return { fill: '#75abc9', stroke: '#5a93b1', width: 1 }
    case 'waterway': return { fill: 'none', stroke: '#6cb0d0', width: 2 }
    case 'forest': return { fill: '#58775e', stroke: '#49664f', width: .6 }
    case 'farmland': return { fill: '#9e996d', stroke: '#87825b', width: .5 }
    case 'urban': return { fill: '#777d7b', stroke: '#666c6b', width: .5 }
    case 'building': return { fill: '#bcb9ae', stroke: '#8d8a82', width: .55 }
    case 'rail': return { fill: 'none', stroke: '#c5bba5', width: 1.2 }
    case 'road': return { fill: 'none', stroke: '#e2cc92', width: 1.8 }
    default: return { fill: 'none', stroke: '#6d8588', width: .7 }
  }
}

export default function EarthLandmarkRegionFocus({
  landmark,
  point,
  onClose,
}: {
  landmark: EarthLandmark
  point: GeoPoint
  onClose: () => void
}) {
  const [payload, setPayload] = useState<Payload | null>(null)

  useEffect(() => {
    let cancelled = false
    setPayload(null)
    const q = new URLSearchParams({ lat: String(point.lat), lon: String(point.lon), radiusKm: '.8' })
    fetch(`/api/earth/region?${q.toString()}`, { cache: 'no-store' })
      .then(async response => {
        const json = await response.json() as Payload
        if (!response.ok && json.ok !== false) return { ok: false, error: `HTTP ${response.status}` } as Payload
        return json
      })
      .then(json => { if (!cancelled) setPayload(json) })
      .catch(error => { if (!cancelled) setPayload({ ok: false, error: String(error) }) })
    return () => { cancelled = true }
  }, [landmark.id, point.lat, point.lon])

  const projected = useMemo(() => {
    if (!payload?.ok || !payload.bounds) return []
    const b = payload.bounds
    const x = (lon: number) => PAD + ((lon - b.west) / (b.east - b.west)) * (W - PAD * 2)
    const y = (lat: number) => H - PAD - ((lat - b.south) / (b.north - b.south)) * (H - PAD * 2)
    return (payload.features ?? []).map(feature => {
      if (feature.geometry.kind === 'point') {
        return { feature, point: { x: x(feature.geometry.coordinates.lon), y: y(feature.geometry.coordinates.lat) } }
      }
      const d = feature.geometry.coordinates.map((p, index) => `${index ? 'L' : 'M'}${x(p.lon).toFixed(2)} ${y(p.lat).toFixed(2)}`).join(' ')
        + (feature.geometry.kind === 'polygon' ? ' Z' : '')
      return { feature, d }
    })
  }, [payload])

  const center = payload?.bounds ? {
    x: PAD + ((point.lon - payload.bounds.west) / (payload.bounds.east - payload.bounds.west)) * (W - PAD * 2),
    y: H - PAD - ((point.lat - payload.bounds.south) / (payload.bounds.north - payload.bounds.south)) * (H - PAD * 2),
  } : null

  const openCanonicalEntry = () => {
    const element = document.getElementById(landmark.id)
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return <section className="region-focus" aria-live="polite">
    <header>
      <div>
        <small>EARTH · REGIONALER LANDMARK-FOKUS</small>
        <h3>{landmark.name}</h3>
        <p>{landmark.locality} · lokaler Ausschnitt ±0,8 km um den Landmark-Viewpoint. Geladen über die bestehende Earth-Region-Authority.</p>
      </div>
      <button className="close" onClick={onClose} aria-label="Regionalansicht schließen">×</button>
    </header>

    {!payload && <div className="state">Reale Umgebungsdaten werden geladen …</div>}
    {payload && !payload.ok && <div className="state error">Region derzeit nicht verfügbar: {payload.error ?? 'unbekannter Fehler'}</div>}
    {payload?.ok && payload.bounds && <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Regionale Earth-Ansicht für ${landmark.name}`}>
        <rect width={W} height={H} rx="14" fill="#253b36" />
        {projected.map(item => {
          const style = styleFor(item.feature.featureType)
          if ('point' in item && item.point) {
            const label = item.feature.properties?.name
            return <g key={item.feature.id}>
              <circle cx={item.point.x} cy={item.point.y} r="3" fill="#d8e5de" opacity=".8" />
              {label && <text x={item.point.x + 5} y={item.point.y - 5} fill="#e8eee9" fontSize="8">{label}</text>}
            </g>
          }
          return <path key={item.feature.id} d={item.d} fill={style.fill} stroke={style.stroke} strokeWidth={style.width} opacity=".88" />
        })}
        {center && <g>
          <circle cx={center.x} cy={center.y} r="18" fill="none" stroke="#efc75e" strokeWidth="2" opacity=".55" />
          <circle cx={center.x} cy={center.y} r="6" fill="#efc75e" stroke="#fff0b6" strokeWidth="2" />
          <text x={center.x + 13} y={center.y - 12} fill="#fff5d3" fontSize="11" fontWeight="800">{landmark.name}</text>
        </g>}
      </svg>
      <div className="meta">
        <span>{(payload.features ?? []).length} reale Kartenobjekte im Ausschnitt</span>
        <span>{payload.attribution ?? 'Earth region data'}</span>
      </div>
    </>}

    <footer>
      <div>
        <b>Earth-Navigationsziel</b>
        <span>Dieser Fokus ist noch keine simulierte terrestrische Reise. Er verwendet ausschließlich die vorhandene Earth-Geodaten-Authority; Fahrzeug-/Transportzeit wird erst angebunden, wenn dafür eine Core-Authority existiert.</span>
      </div>
      <button onClick={openCanonicalEntry}>Kanonischen Eintrag öffnen ↓</button>
    </footer>

    <style jsx>{`
      .region-focus{margin-top:12px;padding:13px;background:#112a33;border:1px solid #45636b;border-radius:12px}.region-focus header{display:flex;justify-content:space-between;gap:14px;align-items:start}.region-focus small{font-size:8px;letter-spacing:.14em;color:#d2ae58;font-weight:900}.region-focus h3{font-family:Georgia,serif;font-size:21px;font-weight:400;margin:2px 0 4px}.region-focus header p{margin:0;color:#9cb0b3;font-size:9px;line-height:1.5}.close{border:1px solid #49656c;background:transparent;color:#b7c7c9;border-radius:6px;width:30px;height:30px;font-size:18px;cursor:pointer}.state{display:grid;place-items:center;min-height:180px;margin-top:10px;background:#0b2028;border-radius:10px;color:#a8babc;font-size:10px}.state.error{color:#f0c7c3;background:#41292c}.region-focus svg{display:block;width:100%;height:auto;margin-top:10px;border:1px solid #38545b;border-radius:12px;background:#253b36}.meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:6px;color:#7f969a;font-size:7px}.region-focus footer{display:flex;justify-content:space-between;gap:14px;align-items:end;margin-top:12px;padding-top:10px;border-top:1px solid #34515a}.region-focus footer div{display:grid;gap:3px;max-width:780px}.region-focus footer b{font-size:8px;letter-spacing:.09em;text-transform:uppercase;color:#d1ad57}.region-focus footer span{font-size:8px;line-height:1.45;color:#8fa4a8}.region-focus footer button{border:1px solid #bea04f;background:#d0ad59;color:#16292f;border-radius:7px;padding:7px 10px;font-size:8px;font-weight:850;cursor:pointer;white-space:nowrap}@media(max-width:700px){.region-focus footer{align-items:stretch;flex-direction:column}.region-focus footer button{align-self:flex-start}}
    `}</style>
  </section>
}
