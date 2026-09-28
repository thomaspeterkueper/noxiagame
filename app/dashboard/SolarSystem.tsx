'use client'

// SolarSystem.tsx
// Aktualisiert: 28.09.2026 — Navigationsraum kann Flüge tatsächlich starten
// Version:      0.3.0
// app/dashboard/SolarSystem.tsx
//
// Sonnensystem-Screen — Konsument der Orbital-Engine (lib/game/orbits).
// Zeichnet Sonne, Orbit-Ringe und aktuelle Positionen aller Orte.
// Erreichbarkeits-Check basiert auf currentLocation des Spielers.
// Zusätzlich bietet der Screen jetzt echte, serverautoritative Reiseziele an.

import { useState, type CSSProperties } from 'react'
import { position, ORBITS, orbitalBaseSeconds } from '@/lib/game/orbits'
import { flightEnergyCost } from '@/lib/game/ships'
import { useGameStore, type LocationSlug } from '@/lib/store/gameStore'
import { T } from './ui'

const CX = 340, CY = 240, TAU = Math.PI * 2
const S = 200 / 150
const SYNODIC = 214

const SCENE = {
  space: '#070b14', ring: '#1d2a3d', sun: '#e9cf8f', glow: '#c9a961',
  earth: '#3a7abf', moon: '#cdd6e0', mars: '#c0563f', phobos: '#8893a3', deimos: '#a09590',
  kepler: '#c9a961',
  open: '#2f9e6b', blocked: '#c0563f', openTxt: '#7fd9b0', blkTxt: '#e79a8b',
  label: '#7a8a9a', labelGold: '#c9a961', star: '#aab8cc',
}

const STARS = (() => {
  let s = 7; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280
  return Array.from({ length: 30 }, () => ({
    cx: +(rnd() * 680).toFixed(1), cy: +(rnd() * 480).toFixed(1),
    r: +(0.4 + rnd() * 0.9).toFixed(2), o: +(0.15 + rnd() * 0.4).toFixed(2),
  }))
})()

function disp(slug: string, tick: number) {
  const p = position(slug, tick)
  return { x: CX + p.x * S, y: CY + p.y * S }
}

function dispPhobos(tick: number) {
  const m = position('mars', tick), o = ORBITS.phobos
  const th = o.phase + TAU * (tick / o.period)
  return { x: CX + m.x * S + 18 * Math.cos(th), y: CY + m.y * S + 18 * Math.sin(th) }
}

function dispDeimos(tick: number) {
  const m = position('mars', tick), o = ORBITS.deimos
  const th = o.phase + TAU * (tick / o.period)
  return { x: CX + m.x * S + 26 * Math.cos(th), y: CY + m.y * S + 26 * Math.sin(th) }
}

function dispMoon(tick: number) {
  const e = position('earth', tick), o = ORBITS.moon
  const th = o.phase + TAU * (tick / o.period)
  return { x: CX + e.x * S + 16 * Math.cos(th), y: CY + e.y * S + 16 * Math.sin(th) }
}

const MONO = 'Courier Prime, ui-monospace, monospace'

function RouteCard({ label, seconds }: { label: string; seconds: number }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.radius, padding: '0.6rem 0.8rem' }}>
      <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: MONO }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color: T.blue, fontFamily: MONO }}>{seconds}s</div>
    </div>
  )
}

interface Props {
  currentTick?: number
  shipRange?: number
  currentLocation?: string
}

const DESTINATIONS: Array<{ slug: LocationSlug; label: string; icon: string }> = [
  { slug: 'earth', label: 'Erde', icon: '🌍' },
  { slug: 'moon', label: 'Mond', icon: '🌙' },
  { slug: 'mars', label: 'Mars', icon: '🔴' },
  { slug: 'phobos', label: 'Phobos', icon: '◻' },
  { slug: 'deimos', label: 'Deimos', icon: '◽' },
]

export default function SolarSystem({
  currentTick = 0,
  shipRange = 250,
  currentLocation = 'earth',
}: Props) {
  const [explore, setExplore] = useState(false)
  const [scrubTick, setScrubTick] = useState(currentTick)
  const [launching, setLaunching] = useState<LocationSlug | null>(null)
  const travel = useGameStore(s => s.travel)
  const inTransit = useGameStore(s => s.inTransit)
  const cargoEnergy = useGameStore(s => s.cargo.energy)
  const tick = explore ? scrubTick : currentTick

  const ea = disp('earth', tick)
  const mo = dispMoon(tick)
  const kp = disp('kepler', tick)
  const ma = disp('mars', tick)
  const ph = dispPhobos(tick)
  const de = dispDeimos(tick)

  const t_ea_mo = orbitalBaseSeconds('earth', 'moon', tick)
  const t_ea_kp = orbitalBaseSeconds('earth', 'kepler', tick)
  const t_ea_ma = orbitalBaseSeconds('earth', 'mars', tick)
  const t_mo_ma = orbitalBaseSeconds('moon', 'mars', tick)
  const t_kp_ma = orbitalBaseSeconds('kepler', 'mars', tick)
  const t_ma_ph = orbitalBaseSeconds('mars', 'phobos', tick)
  const t_ma_de = orbitalBaseSeconds('mars', 'deimos', tick)

  const reachable = (to: string) => {
    if (!ORBITS[currentLocation] || !ORBITS[to]) return false
    const secs = orbitalBaseSeconds(currentLocation, to, tick)
    return secs <= shipRange
  }

  const moonOpen = reachable('moon')
  const keplerOpen = reachable('kepler')
  const marsOpen = reachable('mars')
  void moonOpen
  void keplerOpen

  async function startTravel(dest: LocationSlug) {
    if (inTransit || launching || dest === currentLocation || !reachable(dest)) return
    setLaunching(dest)
    await travel(dest, tick)
    setLaunching(null)

    // Der Navigationsraum lebt als lokales Dashboard-Overlay. Nach erfolgreichem
    // Start laden wir den serverautoritativen Transit-State neu; dadurch wird das
    // Overlay geschlossen und TransitPanel sofort sichtbar. Fehler bleiben im
    // travel()-Pfad und lassen den Navigationsraum offen.
    if (useGameStore.getState().inTransit) window.location.assign('/dashboard')
  }

  const btn: CSSProperties = {
    padding: '0.45rem 0.85rem', border: `1px solid ${T.gold}`, background: 'none',
    color: T.blue, borderRadius: T.radius, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
  }

  const R_EARTH_MOON = 45 * S
  const R_MARS = 150 * S

  const destinations = DESTINATIONS.filter(d => d.slug !== currentLocation)

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: T.blue }}>Sonnensystem</div>
          <div style={{ fontSize: '0.8rem', color: T.inkFaint }}>Reisezeiten folgen der Himmelsgeometrie — Ziele können direkt gestartet werden.</div>
        </div>
        <button onClick={() => { if (!explore) setScrubTick(currentTick); setExplore(!explore) }} style={btn}>
          {explore ? 'Zurück zu jetzt' : 'Zeit erkunden'}
        </button>
      </div>

      <div style={{ background: SCENE.space, borderRadius: T.radiusLg, padding: 14 }}>
        <svg width="100%" viewBox="0 0 680 480" role="img" style={{ display: 'block', fontFamily: MONO }}>
          <title>Sonnensystem-Karte</title>
          {STARS.map((st, i) => <circle key={i} cx={st.cx} cy={st.cy} r={st.r} fill={SCENE.star} opacity={st.o} />)}
          <circle cx={CX} cy={CY} r={R_MARS} fill="none" stroke={SCENE.ring} strokeWidth={0.5} />
          <circle cx={CX} cy={CY} r={R_EARTH_MOON} fill="none" stroke={SCENE.ring} strokeWidth={0.5} />

          <circle cx={CX} cy={CY} r={26} fill={SCENE.glow} opacity={0.08} />
          <circle cx={CX} cy={CY} r={16} fill={SCENE.glow} opacity={0.16} />
          <circle cx={CX} cy={CY} r={10} fill={SCENE.sun} />
          <text x={CX} y={CY + 26} fill={SCENE.label} fontSize={10} textAnchor="middle">Sonne</text>

          {(() => {
            const from = currentLocation === 'moon' ? mo
                       : currentLocation === 'kepler' || currentLocation === 'prometheus' ? kp
                       : currentLocation === 'phobos' ? ph
                       : currentLocation === 'deimos' ? de
                       : currentLocation === 'mars' ? ma
                       : ea
            const lineColor = marsOpen ? SCENE.open : SCENE.blocked
            const midX = (from.x + ma.x) / 2, midY = (from.y + ma.y) / 2 - 8
            return <>
              <line x1={from.x} y1={from.y} x2={ma.x} y2={ma.y}
                stroke={lineColor} strokeWidth={1.5}
                strokeDasharray={marsOpen ? 'none' : '4 4'} opacity={0.7} />
              <text x={midX} y={midY} fill={marsOpen ? SCENE.openTxt : SCENE.blkTxt}
                fontSize={11} textAnchor="middle">{ORBITS[currentLocation] ? orbitalBaseSeconds(currentLocation, 'mars', tick) : '–'}s</text>
            </>
          })()}

          <circle cx={ph.x} cy={ph.y} r={3} fill={SCENE.phobos} />
          <text x={ph.x + 6} y={ph.y + 4} fill={SCENE.label} fontSize={9}>Phobos</text>

          <circle cx={de.x} cy={de.y} r={3} fill={SCENE.deimos} />
          <text x={de.x + 6} y={de.y + 4} fill={SCENE.label} fontSize={9}>Deimos</text>

          <circle cx={ma.x} cy={ma.y} r={9} fill={SCENE.mars} />
          <text x={ma.x} y={ma.y - 14} fill={SCENE.label} fontSize={11} textAnchor="middle">Mars</text>

          <circle cx={kp.x} cy={kp.y} r={5} fill={SCENE.kepler} opacity={0.9} />
          <text x={kp.x} y={kp.y - 10} fill={SCENE.labelGold} fontSize={10} textAnchor="middle">Kepler Station</text>

          <circle cx={ea.x} cy={ea.y} r={7} fill={SCENE.earth} />
          <text x={ea.x} y={ea.y - 12} fill={SCENE.label} fontSize={11} textAnchor="middle">Erde</text>

          <circle cx={mo.x} cy={mo.y} r={4} fill={SCENE.moon} />
          <text x={mo.x + 7} y={mo.y + 4} fill={SCENE.label} fontSize={9}>Mond</text>
        </svg>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '0.6rem 2px 0.5rem', fontFamily: MONO, fontSize: 12, color: T.inkFaint }}>
        <span><span style={{ color: SCENE.earth }}>●</span> Erde</span>
        <span><span style={{ color: SCENE.moon }}>●</span> Mond (schematisch)</span>
        <span><span style={{ color: SCENE.kepler }}>●</span> Kepler Station · L5</span>
        <span><span style={{ color: SCENE.mars }}>●</span> Mars</span>
        <span><span style={{ color: SCENE.phobos }}>●</span> Phobos (schematisch)</span>
        <span><span style={{ color: SCENE.deimos }}>●</span> Deimos (schematisch)</span>
      </div>

      {explore && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 2px 0.75rem' }}>
          <label style={{ fontSize: 13, color: T.inkFaint, minWidth: 92 }}>Tick {scrubTick}</label>
          <input type="range" min={currentTick} max={currentTick + SYNODIC} step={1} value={scrubTick}
            onChange={e => setScrubTick(+e.target.value)} style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: T.inkFaint, minWidth: 56, textAlign: 'right' }}>+{scrubTick - currentTick}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: '0.75rem' }}>
        <RouteCard label="Erde ↔ Mond" seconds={t_ea_mo} />
        <RouteCard label="Erde ↔ Kepler" seconds={t_ea_kp} />
        <RouteCard label="Erde ↔ Mars" seconds={t_ea_ma} />
        <RouteCard label="Mond ↔ Mars" seconds={t_mo_ma} />
        <RouteCard label="Kepler ↔ Mars" seconds={t_kp_ma} />
        <RouteCard label="Mars ↔ Phobos" seconds={t_ma_ph} />
        <RouteCard label="Mars ↔ Deimos" seconds={t_ma_de} />
      </div>

      <div style={{ marginTop: '0.9rem', paddingTop: '0.85rem', borderTop: `1px solid ${T.line}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.blue }}>Reiseziel wählen</div>
            <div style={{ fontSize: 11, color: T.inkFaint }}>Energie an Bord: {cargoEnergy} t · Reichweite: {shipRange}</div>
          </div>
          {inTransit && <div style={{ fontSize: 11, color: T.gold }}>Transit läuft</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {destinations.map(dest => {
            const canReach = reachable(dest.slug)
            const seconds = ORBITS[currentLocation] && ORBITS[dest.slug]
              ? orbitalBaseSeconds(currentLocation, dest.slug, tick)
              : null
            const energy = flightEnergyCost(currentLocation, dest.slug)
            const hasEnergy = cargoEnergy >= energy
            const disabled = inTransit || !!launching || !canReach || !hasEnergy
            return (
              <button
                key={dest.slug}
                onClick={() => void startTravel(dest.slug)}
                disabled={disabled}
                title={!canReach ? 'Außer Reichweite' : !hasEnergy ? `Benötigt ${energy} t Energie` : `Flug nach ${dest.label}`}
                style={{
                  border: `1px solid ${disabled ? T.line : T.gold}`,
                  background: disabled ? T.bg : T.surface,
                  color: disabled ? T.inkFaint : T.blue,
                  borderRadius: T.radius,
                  padding: '0.7rem 0.8rem',
                  textAlign: 'left',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.65 : 1,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{dest.icon} {dest.label}</div>
                <div style={{ fontSize: 10, marginTop: 3, fontFamily: MONO }}>
                  {launching === dest.slug ? 'Start wird freigegeben …' : `${seconds ?? '–'}s · ${energy}t Energie`}
                </div>
                {!canReach && <div style={{ fontSize: 10, color: T.red, marginTop: 2 }}>außer Reichweite</div>}
                {canReach && !hasEnergy && <div style={{ fontSize: 10, color: T.red, marginTop: 2 }}>Energie fehlt</div>}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: '0.75rem', fontSize: 14, fontWeight: 600, color: marsOpen ? T.green : T.red }}>
        {marsOpen
          ? 'Mars erreichbar — Startfenster offen'
          : 'Mars außer Reichweite — Startfenster zu'}
      </div>
    </div>
  )
}
