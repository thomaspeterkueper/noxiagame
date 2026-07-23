'use client'
// app/dashboard/FoundLocationOverlay.tsx
// Erstellt:     20.07.2026
// Aktualisiert: 20.07.2026 — Gründungs-UI: 3-Schritt-Flow
// Version:      1.0.0
//
// Schritt 1: Sonnensystem → Himmelskörper wählen
// Schritt 2: Körper-Karte → Position wählen (lat/lon oder Orbit)
// Schritt 3: Bestätigung → Name, Kosten, Gründen

import React, { useEffect, useState } from 'react'
import { T } from './ui'
import { ORBIT_CLASSES, FOUNDING_COSTS, type OrbitClass, type LocationType } from '@/lib/game/celestialBodies'
import { getToken } from '@/lib/supabase/auth'

type Step = 'body' | 'position' | 'confirm'

interface CelestialBody {
  id:              string
  name:            string
  slug:            string
  body_type:       string
  orbit_radius_au: number | null
  surface_gravity: number
  has_atmosphere:  boolean
  map_x:           number
  map_y:           number
  description:     string | null
}

interface FoundData {
  celestialBodyId: string
  bodyName:        string
  locationType:    LocationType
  surfaceLat?:     number
  surfaceLon?:     number
  orbitClass?:     OrbitClass
  name:            string
}

const C = {
  bg:      '#f8f5ee',
  surface: '#ffffff',
  border:  '#ddd6c8',
  text:    '#1a1a18',
  muted:   '#6b6357',
  faint:   '#9e9485',
  blue:    '#2a4e7a',
  gold:    '#8a6a00',
  red:     '#b52a2a',
  space:   '#070b14',
}

// Sonnensystem SVG — klickbare Himmelskörper
function SolarSystemPicker({
  bodies, onSelect, existingLocations,
}: {
  bodies: CelestialBody[]
  onSelect: (b: CelestialBody) => void
  existingLocations: any[]
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  // Körper nach Orbit sortieren für Darstellung
  const sorted = [...bodies].filter(b => b.body_type !== 'star')
    .sort((a, b) => (a.orbit_radius_au ?? 0) - (b.orbit_radius_au ?? 0))

  // Radien für visuelle Darstellung (logarithmisch)
  const radii: Record<string, number> = {
    earth: 80, moon: 95, mars: 145, phobos: 152, deimos: 160,
    ceres: 220, jupiter: 300,
  }

  const bodyColors: Record<string, string> = {
    earth: '#3a7abf', moon: '#cdd6e0', mars: '#c0563f',
    phobos: '#8893a3', deimos: '#a09590', ceres: '#b0a898', jupiter: '#c8a870',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ fontSize: '0.68rem', color: C.muted, lineHeight: 1.7 }}>
        Wähle einen Himmelskörper als Standort für deine neue Siedlung.
        Jeder Körper hat andere Voraussetzungen und Kosten.
      </div>

      {/* SVG Sonnensystem-Übersicht */}
      <div style={{ background: C.space, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` }}>
        <svg viewBox="0 0 680 340" style={{ width: '100%', display: 'block' }}>
          {/* Sonne */}
          <circle cx={30} cy={170} r={22} fill="#e9cf8f" opacity={0.9} />
          <circle cx={30} cy={170} r={28} fill="none" stroke="#c9a961" strokeWidth={1} opacity={0.3} />

          {/* Orbit-Ringe */}
          {Object.entries(radii).filter(([slug]) => !['moon','phobos','deimos'].includes(slug)).map(([slug, r]) => (
            <circle key={slug} cx={30} cy={170} r={r} fill="none"
              stroke="#1d2a3d" strokeWidth={1} opacity={0.6} />
          ))}

          {/* Himmelskörper */}
          {sorted.map(body => {
            const r = radii[body.slug] ?? 200
            const isHov = hovered === body.id
            const col = bodyColors[body.slug] ?? '#aaa'
            const size = ['jupiter'].includes(body.slug) ? 14
              : ['earth','mars'].includes(body.slug) ? 9
              : ['ceres'].includes(body.slug) ? 6 : 5

            return (
              <g key={body.id}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHovered(body.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelect(body)}
              >
                <circle cx={30 + r} cy={170} r={size + (isHov ? 3 : 0)}
                  fill={col} stroke={isHov ? '#fff' : 'none'} strokeWidth={1.5}
                  style={{ transition: 'all 0.15s' }} />
                {/* Monde klebt am Planeten */}
                {body.slug === 'moon' && (
                  <circle cx={30 + r + 12} cy={170 - 8} r={3}
                    fill={bodyColors.moon} style={{ cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation() }} />
                )}
                <text x={30 + r} y={170 + size + 14}
                  textAnchor="middle" fontSize={9}
                  fill={isHov ? '#fff' : '#7a8a9a'}
                  style={{ transition: 'fill 0.15s', userSelect: 'none' }}>
                  {body.name}
                </text>
              </g>
            )
          })}

          {/* Legende */}
          <text x={10} y={330} fontSize={8} fill="#3a4a5a">
            Klicke auf einen Körper um ihn zu wählen
          </text>
        </svg>
      </div>

      {/* Körper-Liste */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        {sorted.map(body => (
          <button
            key={body.id}
            onClick={() => onSelect(body)}
            style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '0.6rem 0.75rem', cursor: 'pointer',
              textAlign: 'left' as const, transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = C.blue)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
          >
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: C.text }}>{body.name}</div>
            <div style={{ fontSize: '0.62rem', color: C.muted, marginTop: 2 }}>
              {body.body_type === 'moon' ? '🌑 Mond' : body.body_type === 'planet' ? '🪐 Planet' : '☄️ Asteroid'}
              {' · '}
              {body.surface_gravity.toFixed(2)}g
              {body.has_atmosphere ? ' · Atmosphäre' : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Positions-Picker für Oberfläche (lat/lon) oder Orbit
function PositionPicker({
  body, onSelect,
}: {
  body: CelestialBody
  onSelect: (d: Partial<FoundData>) => void
}) {
  const [locationType, setLocationType] = useState<LocationType>('colony')
  const [lat, setLat]     = useState('')
  const [lon, setLon]     = useState('')
  const [orbit, setOrbit] = useState<OrbitClass>('LEO')
  const [svgPos, setSvgPos] = useState<{x:number,y:number}|null>(null)

  const isStation = locationType === 'station' || locationType === 'relay'
  const canFound  = isStation ? true : (lat !== '' && lon !== '')

  // SVG-Klick → lat/lon berechnen (simple Mercator-Projektion)
  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isStation) return
    const svg  = e.currentTarget.getBoundingClientRect()
    const px   = (e.clientX - svg.left) / svg.width
    const py   = (e.clientY - svg.top)  / svg.height
    const latV = ((0.5 - py) * 180).toFixed(1)
    const lonV = ((px - 0.5) * 360).toFixed(1)
    setLat(latV)
    setLon(lonV)
    setSvgPos({ x: px * 100, y: py * 100 })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: C.blue }}>{body.name}</div>
      <div style={{ fontSize: '0.68rem', color: C.muted }}>{body.description}</div>

      {/* Typ-Auswahl */}
      <div>
        <div style={{ fontSize: '0.6rem', color: C.faint, textTransform: 'uppercase' as const, letterSpacing: '0.15em', marginBottom: 6 }}>Siedlungstyp</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' as const }}>
          {(['colony','station','outpost','relay'] as LocationType[]).map(t => (
            <button key={t} onClick={() => setLocationType(t)}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem', cursor: 'pointer',
                background: locationType === t ? C.blue : C.surface,
                color: locationType === t ? '#fff' : C.muted,
                border: `1px solid ${locationType === t ? C.blue : C.border}`,
                fontWeight: locationType === t ? 700 : 400,
              }}>
              {t === 'colony' ? '🏘 Kolonie' : t === 'station' ? '🛸 Station' : t === 'outpost' ? '🔭 Außenposten' : '📡 Relais'}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.62rem', color: C.muted, marginTop: 4 }}>
          Grundkosten: <strong>{(FOUNDING_COSTS[locationType] * (isStation ? ORBIT_CLASSES[orbit].cost_mult : 1)).toLocaleString()} Cr</strong>
        </div>
      </div>

      {isStation ? (
        /* Orbit-Auswahl */
        <div>
          <div style={{ fontSize: '0.6rem', color: C.faint, textTransform: 'uppercase' as const, letterSpacing: '0.15em', marginBottom: 6 }}>Umlaufbahn</div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
            {(Object.entries(ORBIT_CLASSES) as [OrbitClass, typeof ORBIT_CLASSES[OrbitClass]][]).map(([cls, info]) => (
              <button key={cls} onClick={() => setOrbit(cls)}
                style={{
                  padding: '0.5rem 0.75rem', borderRadius: 8, cursor: 'pointer', textAlign: 'left' as const,
                  background: orbit === cls ? 'rgba(42,78,122,0.08)' : C.surface,
                  border: `1px solid ${orbit === cls ? C.blue : C.border}`,
                }}>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: orbit === cls ? C.blue : C.text }}>
                  {cls} · {info.label}
                </div>
                <div style={{ fontSize: '0.62rem', color: C.muted, marginTop: 2 }}>{info.desc}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Oberflächen-Karte */
        <div>
          <div style={{ fontSize: '0.6rem', color: C.faint, textTransform: 'uppercase' as const, letterSpacing: '0.15em', marginBottom: 6 }}>
            Position auf {body.name} — klicke die Karte
          </div>
          <div style={{ position: 'relative', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <svg viewBox="0 0 100 50" style={{ width: '100%', display: 'block', cursor: 'crosshair' }}
              onClick={handleMapClick}>
              {/* Vereinfachte Oberfläche */}
              <rect width={100} height={50}
                fill={body.slug === 'mars' ? '#6b3020' : body.slug === 'moon' ? '#3a3a3a' : '#1a3a5a'} />
              {/* Raster */}
              {[-60,-30,0,30,60].map(lat => (
                <line key={lat} x1={0} y1={(0.5 - lat/180) * 50} x2={100} y2={(0.5 - lat/180) * 50}
                  stroke="rgba(255,255,255,0.1)" strokeWidth={0.3} />
              ))}
              {[-120,-60,0,60,120].map(lon => (
                <line key={lon} x1={(lon/360 + 0.5) * 100} y1={0} x2={(lon/360 + 0.5) * 100} y2={50}
                  stroke="rgba(255,255,255,0.1)" strokeWidth={0.3} />
              ))}
              {/* Bestehende Siedlungen */}
              {svgPos && (
                <circle cx={svgPos.x} cy={svgPos.y} r={2}
                  fill="#c9a961" stroke="#fff" strokeWidth={0.5} />
              )}
              {/* Äquator-Label */}
              <text x={1} y={26} fontSize={3} fill="rgba(255,255,255,0.4)">0°</text>
              <text x={49} y={4} fontSize={3} fill="rgba(255,255,255,0.4)">N</text>
              <text x={49} y={49} fontSize={3} fill="rgba(255,255,255,0.4)">S</text>
            </svg>
          </div>
          {/* Koordinaten-Eingabe */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.6rem', color: C.faint, marginBottom: 3 }}>Breitengrad (°N)</div>
              <input type="number" min={-90} max={90} step={0.1} value={lat}
                onChange={e => setLat(e.target.value)}
                style={{ width: '100%', padding: '5px 8px', border: `1px solid ${C.border}`,
                  borderRadius: 6, fontSize: '0.8rem', background: C.surface, color: C.text, boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.6rem', color: C.faint, marginBottom: 3 }}>Längengrad (°E/W)</div>
              <input type="number" min={-180} max={180} step={0.1} value={lon}
                onChange={e => setLon(e.target.value)}
                style={{ width: '100%', padding: '5px 8px', border: `1px solid ${C.border}`,
                  borderRadius: 6, fontSize: '0.8rem', background: C.surface, color: C.text, boxSizing: 'border-box' as const }} />
            </div>
          </div>
          {lat && lon && (
            <div style={{ fontSize: '0.65rem', color: C.muted, marginTop: 4 }}>
              📍 {parseFloat(lat) >= 0 ? `${lat}°N` : `${Math.abs(parseFloat(lat))}°S`}
              {', '}
              {parseFloat(lon) >= 0 ? `${lon}°O` : `${Math.abs(parseFloat(lon))}°W`}
            </div>
          )}
        </div>
      )}

      <button
        disabled={!canFound}
        onClick={() => onSelect({
          locationType,
          surfaceLat:  isStation ? undefined : parseFloat(lat),
          surfaceLon:  isStation ? undefined : parseFloat(lon),
          orbitClass:  isStation ? orbit : undefined,
        })}
        style={{
          padding: '0.65rem', background: canFound ? C.blue : C.border,
          color: canFound ? '#fff' : C.faint, border: 'none', borderRadius: 8,
          cursor: canFound ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.82rem',
        }}
      >
        Weiter →
      </button>
    </div>
  )
}

// Bestätigungs-Screen
function ConfirmScreen({
  data, playerCredits, body, onConfirm, loading, error,
}: {
  data: FoundData, playerCredits: number, body: CelestialBody | null,
  onConfirm: () => void, loading: boolean, error: string | null,
}) {
  const isStation = data.locationType === 'station' || data.locationType === 'relay'
  const orbitInfo = data.orbitClass ? ORBIT_CLASSES[data.orbitClass] : null
  const cost = Math.round(FOUNDING_COSTS[data.locationType]
    * (orbitInfo ? orbitInfo.cost_mult : 1))
  const canAfford = playerCredits >= cost

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: C.blue }}>Gründung bestätigen</div>

      {/* Name */}
      <div>
        <div style={{ fontSize: '0.6rem', color: C.faint, textTransform: 'uppercase' as const, letterSpacing: '0.15em', marginBottom: 6 }}>Name der Siedlung</div>
        <input
          value={data.name}
          readOnly
          style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`,
            borderRadius: 8, fontSize: '0.9rem', fontWeight: 700, color: C.blue,
            background: C.surface, boxSizing: 'border-box' as const }}
        />
      </div>

      {/* Zusammenfassung */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.75rem 1rem' }}>
        {[
          ['Körper',    body?.name ?? '?'],
          ['Typ',       data.locationType === 'colony' ? '🏘 Kolonie' : data.locationType === 'station' ? '🛸 Station' : data.locationType === 'outpost' ? '🔭 Außenposten' : '📡 Relais'],
          isStation
            ? ['Orbit', orbitInfo ? `${data.orbitClass} · ${orbitInfo.altitude.toLocaleString()} km` : '?']
            : ['Position', `${data.surfaceLat ?? 0 >= 0 ? data.surfaceLat+'°N' : Math.abs(data.surfaceLat ?? 0)+'°S'}, ${data.surfaceLon ?? 0 >= 0 ? data.surfaceLon+'°O' : Math.abs(data.surfaceLon ?? 0)+'°W'}`],
          ['Startgröße', isStation ? '8×8 Kacheln' : '16×16 Kacheln'],
          ['Kosten',    `${cost.toLocaleString()} Cr`],
        ].map(([k,v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}`, fontSize: '0.78rem' }}>
            <span style={{ color: C.muted }}>{k}</span>
            <span style={{ color: C.text, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', fontSize: '0.78rem' }}>
          <span style={{ color: C.muted }}>Deine Credits</span>
          <span style={{ color: canAfford ? '#1a7a4a' : C.red, fontWeight: 700 }}>
            {playerCredits.toLocaleString()} Cr
          </span>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.6rem 0.75rem', background: 'rgba(181,42,42,0.08)',
          border: '1px solid rgba(181,42,42,0.3)', borderRadius: 8,
          fontSize: '0.75rem', color: C.red }}>
          {error}
        </div>
      )}

      <button
        onClick={onConfirm}
        disabled={!canAfford || loading}
        style={{
          padding: '0.75rem', background: canAfford ? C.blue : C.border,
          color: canAfford ? '#fff' : C.faint, border: 'none', borderRadius: 8,
          cursor: canAfford ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.85rem',
        }}
      >
        {loading ? '⏳ Wird gegründet…' : canAfford ? `🚀 Für ${cost.toLocaleString()} Cr gründen` : 'Zu wenig Credits'}
      </button>
    </div>
  )
}

// ── Haupt-Overlay ─────────────────────────────────────────────────────────────
interface Props {
  onClose:   () => void
  onFounded: (slug: string, name: string) => void
  credits:   number
}

export default function FoundLocationOverlay({ onClose, onFounded, credits }: Props) {
  const [step, setStep]               = useState<Step>('body')
  const [bodies, setBodies]           = useState<CelestialBody[]>([])
  const [existingLocs, setExistingLocs] = useState<any[]>([])
  const [playerCredits, setPlayerCredits] = useState(credits)
  const [selectedBody, setSelectedBody] = useState<CelestialBody | null>(null)
  const [foundData, setFoundData]     = useState<Partial<FoundData>>({})
  const [name, setName]               = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      const res = await fetch('/api/game/found-location', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setBodies(data.celestialBodies ?? [])
      setExistingLocs(data.existingLocations ?? [])
      setPlayerCredits(data.playerCredits ?? credits)
    }
    load()
  }, [])

  async function handleConfirm() {
    if (!selectedBody || !foundData.locationType || !name.trim()) return
    setLoading(true); setError(null)
    try {
      const token = await getToken()
      const res = await fetch('/api/game/found-location', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:            name.trim(),
          celestialBodyId: selectedBody.id,
          locationType:    foundData.locationType,
          surfaceLat:      foundData.surfaceLat,
          surfaceLon:      foundData.surfaceLon,
          orbitClass:      foundData.orbitClass,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        onFounded(data.slug, name.trim())
        onClose()
      } else {
        setError(data.error ?? 'Unbekannter Fehler')
      }
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }

  const STEPS = ['body', 'position', 'confirm'] as Step[]
  const stepLabel = { body: '1 · Himmelskörper', position: '2 · Position', confirm: '3 · Bestätigen' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 'min(640px, 95vw)', maxHeight: '90vh', background: C.bg,
        borderRadius: 16, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '0.58rem', color: C.faint, letterSpacing: '0.15em',
              textTransform: 'uppercase' as const }}>Neue Siedlung</div>
            <h2 style={{ margin: '0.1rem 0 0', fontSize: '1.1rem', fontWeight: 700,
              color: C.blue, fontFamily: 'Georgia, serif' }}>🚀 Gründen</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ fontSize: '0.62rem', padding: '3px 8px', borderRadius: 12,
                background: step === s ? C.blue : 'transparent',
                color: step === s ? '#fff' : C.faint,
                border: `1px solid ${step === s ? C.blue : C.border}`,
                cursor: i < STEPS.indexOf(step) ? 'pointer' : 'default' }}
                onClick={() => { if (i < STEPS.indexOf(step)) setStep(s) }}>
                {stepLabel[s]}
              </div>
            ))}
            <button onClick={onClose} style={{ background: 'none', border: `1px solid ${C.border}`,
              borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: C.muted }}>✕</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          {step === 'body' && (
            <SolarSystemPicker
              bodies={bodies}
              existingLocations={existingLocs}
              onSelect={body => {
                setSelectedBody(body)
                setFoundData({ celestialBodyId: body.id, bodyName: body.name })
                setStep('position')
              }}
            />
          )}
          {step === 'position' && selectedBody && (
            <PositionPicker
              body={selectedBody}
              onSelect={pos => {
                setFoundData(prev => ({ ...prev, ...pos }))
                setStep('confirm')
              }}
            />
          )}
          {step === 'confirm' && foundData.locationType && (
            <>
              {/* Name-Eingabe im Confirm-Screen */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.6rem', color: C.faint, textTransform: 'uppercase' as const,
                  letterSpacing: '0.15em', marginBottom: 6 }}>Name der Siedlung</div>
                <input
                  type="text"
                  placeholder={`z.B. "${selectedBody?.name} Base Alpha"`}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={40}
                  autoFocus
                  style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`,
                    borderRadius: 8, fontSize: '0.9rem', fontWeight: 700, color: C.blue,
                    background: C.surface, boxSizing: 'border-box' as const, outline: 'none' }}
                />
              </div>
              {name.trim().length >= 3 && (
                <ConfirmScreen
                  data={{ ...foundData as FoundData, name }}
                  playerCredits={playerCredits}
                  body={selectedBody}
                  onConfirm={handleConfirm}
                  loading={loading}
                  error={error}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
