// app/dashboard/SolarSystem.tsx
// Erstellt:     15.06.2026
// Aktualisiert: 15.06.2026
//
// Sonnensystem-Screen — reiner Konsument der Orbital-Engine (lib/game/orbits).
// Zeichnet Sonne, Mond-/Marsbahn und die aktuellen Positionen aus position(),
// färbt die Reiselinie Mond↔Mars nach Erreichbarkeit (orbitalBaseSeconds ≤
// shipRange). Autark: eigener Scrubber-State, kein gameStore, keine eigene
// Datenholung — currentTick & shipRange kommen als Props vom DashboardClient.
//
// Die Weltraum-Szene (SVG) nutzt feste Farben (physikalisch, kippt nicht).
// Das Chrome (Kopf, Regler, Kennzahlen) nutzt die NOXIA-Tokens aus ./ui.
// Phobos ist schematisch herausgezogen (real klebt er an Mars) — die ANGEZEIGTEN
// Reisezeiten stammen aber aus der echten, unverzerrten Engine.

'use client'

import { useState, type CSSProperties } from 'react'
import { position, ORBITS, orbitalBaseSeconds } from '@/lib/game/orbits'
import { T } from './ui'

const CX = 340, CY = 235, S = 200 / 150, TAU = Math.PI * 2
const SYNODIC = 214   // synodische Periode Mond/Mars ≈ 214 Ticks

const SCENE = {
  space: '#070b14', ring: '#1d2a3d', sun: '#e9cf8f', glow: '#c9a961',
  moon: '#cdd6e0', mars: '#c0563f', phobos: '#8893a3',
  open: '#2f9e6b', blocked: '#c0563f', openTxt: '#7fd9b0', blkTxt: '#e79a8b',
  label: '#7a6a3a', star: '#aab8cc',
}

// Stabile Sterne (seeded, einmalig — kein Flackern zwischen Renders).
const STARS = (() => {
  let s = 7; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280
  return Array.from({ length: 26 }, () => ({
    cx: +(rnd() * 680).toFixed(1), cy: +(rnd() * 470).toFixed(1),
    r: +(0.4 + rnd() * 0.9).toFixed(2), o: +(0.15 + rnd() * 0.4).toFixed(2),
  }))
})()

function disp(slug: string, tick: number) {
  const p = position(slug, tick)
  return { x: CX + p.x * S, y: CY + p.y * S }
}
// Phobos für die Sichtbarkeit herausgezogen (real ~3 Einheiten = unsichtbar).
function dispPhobos(tick: number) {
  const m = position('mars', tick), o = ORBITS.phobos
  const th = o.phase + TAU * (tick / o.period)
  return { x: CX + m.x * S + 16 * Math.cos(th), y: CY + m.y * S + 16 * Math.sin(th) }
}

const MONO = 'Courier Prime, ui-monospace, monospace'

export default function SolarSystem(
  { currentTick = 0, shipRange = 28 }: { currentTick?: number; shipRange?: number },
) {
  const [explore, setExplore] = useState(false)
  const [scrubTick, setScrubTick] = useState(currentTick)
  const tick = explore ? scrubTick : currentTick

  const mo = disp('moon', tick), ma = disp('mars', tick), ph = dispPhobos(tick)
  const mm = orbitalBaseSeconds('moon', 'mars', tick)
  const mp = orbitalBaseSeconds('moon', 'phobos', tick)
  const rp = orbitalBaseSeconds('mars', 'phobos', tick)
  const open = mm <= shipRange
  const midX = (mo.x + ma.x) / 2, midY = (mo.y + ma.y) / 2 - 6

  const btn: CSSProperties = {
    padding: '0.5rem 0.9rem', border: `1px solid ${T.gold}`, background: 'none',
    color: T.blue, borderRadius: T.radius, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: T.blue }}>Sonnensystem</div>
          <div style={{ fontSize: '0.8rem', color: T.inkFaint }}>Reisezeiten folgen der Himmelsgeometrie — frisch aus dem Tick berechnet.</div>
        </div>
        <button onClick={() => { if (!explore) setScrubTick(currentTick); setExplore(!explore) }} style={btn}>
          {explore ? 'Zurück zu jetzt' : 'Zeit erkunden'}
        </button>
      </div>

      <div style={{ background: SCENE.space, borderRadius: T.radiusLg, padding: 14 }}>
        <svg width="100%" viewBox="0 0 680 470" role="img" style={{ display: 'block', fontFamily: MONO }}>
          <title>Sonnensystem-Karte</title>
          {STARS.map((st, i) => <circle key={i} cx={st.cx} cy={st.cy} r={st.r} fill={SCENE.star} opacity={st.o} />)}
          <circle cx={CX} cy={CY} r={200} fill="none" stroke={SCENE.ring} strokeWidth={0.5} />
          <circle cx={CX} cy={CY} r={66.7} fill="none" stroke={SCENE.ring} strokeWidth={0.5} />
          <circle cx={CX} cy={CY} r={26} fill={SCENE.glow} opacity={0.08} />
          <circle cx={CX} cy={CY} r={16} fill={SCENE.glow} opacity={0.16} />
          <circle cx={CX} cy={CY} r={10} fill={SCENE.sun} />
          <text x={CX} y={CY + 28} fill={SCENE.label} fontSize={11} textAnchor="middle">Sonne</text>
          <line x1={mo.x} y1={mo.y} x2={ma.x} y2={ma.y} stroke={open ? SCENE.open : SCENE.blocked} strokeWidth={1.5} strokeDasharray={open ? 'none' : '4 4'} />
          <text x={midX} y={midY} fill={open ? SCENE.openTxt : SCENE.blkTxt} fontSize={12} textAnchor="middle">{mm}s</text>
          <circle cx={ph.x} cy={ph.y} r={3} fill={SCENE.phobos} />
          <circle cx={mo.x} cy={mo.y} r={6} fill={SCENE.moon} />
          <circle cx={ma.x} cy={ma.y} r={9} fill={SCENE.mars} />
        </svg>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '0.6rem 2px 1rem', fontFamily: MONO, fontSize: 12, color: T.inkFaint }}>
        <span><span style={{ color: SCENE.moon }}>●</span> Mond</span>
        <span><span style={{ color: SCENE.mars }}>●</span> Mars</span>
        <span><span style={{ color: SCENE.phobos }}>●</span> Phobos (schematisch)</span>
      </div>

      {explore && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 2px 1rem' }}>
          <label style={{ fontSize: 13, color: T.inkFaint, minWidth: 92 }}>Tick {scrubTick}</label>
          <input type="range" min={currentTick} max={currentTick + SYNODIC} step={1} value={scrubTick}
            onChange={e => setScrubTick(+e.target.value)} style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: T.inkFaint, minWidth: 56, textAlign: 'right' }}>+{scrubTick - currentTick}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, marginBottom: '0.75rem' }}>
        {([['Mond ↔ Mars', mm], ['Mond ↔ Phobos', mp], ['Mars ↔ Phobos', rp]] as [string, number][]).map(([l, v]) => (
          <div key={l} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.radius, padding: '0.7rem 0.8rem' }}>
            <div style={{ fontSize: 12, color: T.inkFaint }}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: T.blue }}>{v}s</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: open ? T.green : T.red }}>
        {open ? 'Mars erreichbar — Startfenster offen' : 'Mars außer Reichweite — Startfenster zu'}
      </div>
    </div>
  )
}
