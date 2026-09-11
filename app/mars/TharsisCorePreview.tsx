'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { THARSIS_HUB_BUILDINGS, THARSIS_HUB_POPULATION, THARSIS_HUB_ROADS } from '@/lib/game/seeds/tharsisHubSeed'

type SpatialPayload = {
  location?: { id: string; slug: string; name: string }
  frame?: {
    origin_status?: string | null
    origin_lat_deg?: number | null
    origin_lon_deg?: number | null
    terrain_dataset_id?: string | null
    vertical_datum?: string | null
  } | null
  terrain?: {
    activeDataset?: { id: string; status: string; resolution_m?: number | null; vertical_reference?: string | null } | null
    resolution?: { status: string; zM: number | null }
  }
  entities?: Array<{ id: string; entity_id: string; placement_mode?: string | null; x_m?: number | null; y_m?: number | null }>
  builds?: Array<{ id: string; buildable_id: string; placement_mode?: string | null; x_m?: number | null; y_m?: number | null }>
  error?: string
}

const COLS = 32
const ROWS = 24

export default function TharsisCorePreview() {
  const [payload, setPayload] = useState<SpatialPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const token = await getToken()
        if (!token) throw new Error('Nicht angemeldet')
        const response = await fetch('/api/game/build/spatial?location=mars', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const json = await response.json() as SpatialPayload
        if (!response.ok) throw new Error(json.error ?? 'Mars-Core-Zustand konnte nicht geladen werden')
        if (!cancelled) setPayload(json)
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
      }
    })()
    return () => { cancelled = true }
  }, [])

  const roadKeys = useMemo(() => new Set(THARSIS_HUB_ROADS.map(road => `${road.row}:${road.col}`)), [])
  const liveEntities = payload?.entities ?? []
  const metricEntities = liveEntities.filter(entity => entity.x_m != null && entity.y_m != null)
  const frameReady = payload?.frame?.origin_status === 'verified'
  const terrainReady = payload?.terrain?.activeDataset?.status === 'ready'

  return <section style={{ background: '#0d0b0a', color: '#eee6df', padding: '28px 24px 48px' }}>
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ fontSize: 12, letterSpacing: '.16em', opacity: .62 }}>THARSIS HUB · CANON + CORE</div>
      <h2 style={{ margin: '6px 0 4px', fontSize: 30 }}>Lokaler Weltzustand</h2>
      <p style={{ marginTop: 0, opacity: .72, maxWidth: 980 }}>
        Das kanonische 32×24-Startlayout bleibt sichtbar, solange der produktive Mars-World-Frame noch nicht georeferenziert ist. Core-Live-Daten werden daneben geprüft; Legacy-Tiles werden ausdrücklich nicht als Meterkoordinaten ausgegeben.
      </p>
      {error ? <div style={noticeStyle}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16 }}>
        <div style={{ position: 'relative', aspectRatio: `${COLS} / ${ROWS}`, border: '1px solid rgba(255,255,255,.12)', borderRadius: 16, background: 'radial-gradient(circle at 50% 48%, #43261d 0%, #251610 42%, #140e0b 100%)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${COLS},1fr)`, gridTemplateRows: `repeat(${ROWS},1fr)` }}>
            {Array.from({ length: COLS * ROWS }, (_, index) => {
              const row = Math.floor(index / COLS)
              const col = index % COLS
              const road = roadKeys.has(`${row}:${col}`)
              return <div key={`${row}:${col}`} style={{ borderRight: '1px solid rgba(255,255,255,.025)', borderBottom: '1px solid rgba(255,255,255,.025)', background: road ? 'rgba(157,121,91,.25)' : 'transparent' }} />
            })}
          </div>

          {THARSIS_HUB_BUILDINGS.map(building => (
            <button
              key={building.id}
              title={`${building.id} · Zone ${building.zone} · Tile ${building.col}/${building.row}`}
              style={{
                position: 'absolute',
                left: `${((building.col + .5) / COLS) * 100}%`,
                top: `${((building.row + .5) / ROWS) * 100}%`,
                transform: 'translate(-50%,-50%)',
                width: '2.6%',
                aspectRatio: '1',
                minWidth: 8,
                padding: 0,
                border: building.critical ? '1px solid rgba(255,245,220,.95)' : '1px solid rgba(255,255,255,.55)',
                borderRadius: 4,
                background: building.zone.startsWith('D') ? '#b97745' : building.zone === 'C' ? '#7f9b9e' : building.zone === 'F' ? '#a88f71' : '#d0aa78',
                boxShadow: building.critical ? '0 0 7px rgba(255,210,145,.28)' : 'none',
              }}
            />
          ))}
        </div>

        <aside style={{ display: 'grid', alignContent: 'start', gap: 12 }}>
          <div style={panelStyle}>
            <small>LOCATION</small>
            <div style={{ fontSize: 22, marginTop: 6 }}>{payload?.location?.name ?? 'Mars / Tharsis Hub'}</div>
            <div style={{ opacity: .65, marginTop: 5 }}>{THARSIS_HUB_POPULATION} Bewohner · kanonischer Start-Seed</div>
          </div>
          <div style={panelStyle}>
            <small>LAYOUT</small>
            <div style={{ fontSize: 28, marginTop: 6 }}>{THARSIS_HUB_BUILDINGS.length}</div>
            <div style={{ opacity: .65 }}>kanonische Startgebäude · {THARSIS_HUB_ROADS.length} Straßen-Tiles</div>
          </div>
          <div style={panelStyle}>
            <small>CORE LIVE</small>
            <div style={{ marginTop: 7, lineHeight: 1.55, opacity: .82 }}>{liveEntities.length} persistierte Gebäude/Module · {metricEntities.length} bereits mit metrischer Position.</div>
          </div>
          <div style={panelStyle}>
            <small>GEODESY</small>
            <div style={{ marginTop: 7, lineHeight: 1.55, opacity: .82 }}>
              World-Frame: <strong>{frameReady ? 'verified' : payload?.frame?.origin_status ?? 'pending'}</strong><br />
              MOLA: <strong>{terrainReady ? 'ready' : payload?.terrain?.activeDataset?.status ?? 'catalogued'}</strong><br />
              Terrain gate: <strong>{payload?.terrain?.resolution?.status ?? 'unresolved'}</strong>
            </div>
          </div>
          <div style={panelStyle}>
            <small>PLACEMENT</small>
            <div style={{ marginTop: 7, lineHeight: 1.55, opacity: .82 }}>
              Neue Weltkoordinaten bleiben gesperrt, bis Ursprung und Vertikalbezug verifiziert sind. Danach kann das Seed-Layout kontrolliert in ENU-Meter migriert und gegen MOLA-Slope geprüft werden.
            </div>
          </div>
        </aside>
      </div>
    </div>
  </section>
}

const panelStyle: React.CSSProperties = { border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', borderRadius: 14, padding: 16 }
const noticeStyle: React.CSSProperties = { border: '1px solid rgba(255,160,120,.35)', background: 'rgba(150,70,40,.16)', borderRadius: 12, padding: 12, margin: '12px 0' }
