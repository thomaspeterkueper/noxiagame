'use client'
// app/dashboard/CockpitView.tsx
// Erstellt:     20.07.2026
// Aktualisiert: 20.07.2026 — Cockpit-Ansicht: Ziel wächst, Sterne fliegen vorbei
// Version:      1.0.0

import React, { useEffect, useRef } from 'react'

interface Props {
  inTransit:      boolean
  progress:       number    // 0.0 – 1.0 Reisefortschritt
  originName:     string
  destName:       string
  destType?:      string    // 'planet' | 'moon' | 'station'
  timeRemaining?: number    // Sekunden
  onClose:        () => void
  onOpenShip?:    () => void
}

// Planet/Mond/Station als SVG-Objekt
function DestinationBody({ type, size, name }: { type: string; size: number; name: string }) {
  const colors: Record<string, string[]> = {
    planet:  ['#c0563f', '#8a3020'],   // Mars-Rot
    moon:    ['#cdd6e0', '#9aacb8'],   // Grausilber
    station: ['#4a6a9a', '#2a4a7a'],   // Stationsblau
    asteroid:['#8a7a6a', '#6a5a4a'],   // Felsgrau
  }
  const col = colors[type] ?? colors.planet

  if (type === 'station') {
    return (
      <g>
        {/* Stationsring */}
        <ellipse cx={0} cy={0} rx={size} ry={size*0.3} fill="none" stroke={col[0]} strokeWidth={size*0.15} />
        {/* Zentralmodul */}
        <circle cx={0} cy={0} r={size*0.25} fill={col[0]} />
        {/* Solarpanele */}
        <rect x={-size*1.4} y={-size*0.06} width={size*0.8} height={size*0.12} rx={2} fill={col[1]} />
        <rect x={size*0.6} y={-size*0.06} width={size*0.8} height={size*0.12} rx={2} fill={col[1]} />
        {/* Lichter */}
        <circle cx={-size*1.3} cy={0} r={2} fill="#ff8a1a" opacity={0.8} />
        <circle cx={size*1.3} cy={0} r={2} fill="#4aff4a" opacity={0.8} />
      </g>
    )
  }

  return (
    <g>
      <circle cx={0} cy={0} r={size} fill={col[0]} />
      {/* Oberflächenstruktur */}
      <circle cx={-size*0.3} cy={-size*0.2} r={size*0.15} fill={col[1]} opacity={0.4} />
      <circle cx={size*0.2} cy={size*0.3}  r={size*0.1}  fill={col[1]} opacity={0.3} />
      {type === 'moon' && (
        <>
          <circle cx={size*0.3} cy={-size*0.1} r={size*0.08} fill={col[1]} opacity={0.5} />
          <circle cx={-size*0.1} cy={size*0.4}  r={size*0.05} fill={col[1]} opacity={0.4} />
        </>
      )}
      {/* Atmosphäre (nur Planeten) */}
      {type === 'planet' && (
        <circle cx={0} cy={0} r={size*1.05} fill="none"
          stroke={col[0]} strokeWidth={size*0.08} opacity={0.25} />
      )}
      {/* Terminator */}
      <ellipse cx={size*0.3} cy={0} rx={size*0.7} ry={size}
        fill="rgba(0,0,0,0.3)" />
    </g>
  )
}

export default function CockpitView({
  inTransit, progress, originName, destName, destType = 'planet',
  timeRemaining, onClose, onOpenShip,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const starsRef  = useRef<{x:number;y:number;z:number;pz:number}[]>([])

  // Sterne initialisieren
  useEffect(() => {
    starsRef.current = Array.from({ length: 200 }, () => ({
      x:  (Math.random() - 0.5) * 2,
      y:  (Math.random() - 0.5) * 2,
      z:  Math.random(),
      pz: 0,
    }))
  }, [])

  // Sterne-Animation
  useEffect(() => {
    if (!inTransit) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height
    let raf = 0
    let t = 0

    const animate = () => {
      ctx.fillStyle = 'rgba(3,6,15,0.25)'
      ctx.fillRect(0, 0, W, H)

      // Sterne mit Tiefeneffekt
      for (const star of starsRef.current) {
        star.pz = star.z
        star.z -= 0.006
        if (star.z <= 0) { star.z = 1; star.x = (Math.random()-0.5)*2; star.y = (Math.random()-0.5)*2 }
        const sx  = (star.x / star.z) * W/2 + W/2
        const sy  = (star.y / star.z) * H/2 + H/2
        const psx = (star.x / star.pz) * W/2 + W/2
        const psy = (star.y / star.pz) * H/2 + H/2
        const size  = Math.max(0.5, (1 - star.z) * 2.5)
        const bright = Math.min(1, (1 - star.z) * 1.5)
        ctx.strokeStyle = `rgba(200,220,255,${bright})`
        ctx.lineWidth = size
        ctx.beginPath(); ctx.moveTo(psx, psy); ctx.lineTo(sx, sy); ctx.stroke()
      }

      t++
      raf = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(raf)
  }, [inTransit])

  // Ziel-Planet wächst mit progress
  const destSize = 8 + progress * 70   // 8px → 78px
  const destType_ = destType ?? 'planet'

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`
    if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`
    return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2100,
      background: '#03060f',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.5rem 1.5rem',
        borderBottom: '1px solid #0d1a2d',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}>
        <span style={{ color: '#c9a961', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700 }}>
          🛸 COCKPIT — {inTransit ? 'TRANSIT AKTIV' : 'STANDBY'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {onOpenShip && (
            <button onClick={onOpenShip} style={{
              background: 'rgba(42,78,122,0.3)', border: '1px solid #2a4e7a',
              color: '#8abafa', borderRadius: 6, padding: '3px 10px',
              cursor: 'pointer', fontSize: '0.68rem',
            }}>◈ Schiff</button>
          )}
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #1d2a3d',
            color: '#5a6b7a', borderRadius: 6, padding: '3px 8px',
            cursor: 'pointer', fontSize: '0.75rem',
          }}>ESC ✕</button>
        </div>
      </div>

      {/* Hauptansicht */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Sterne-Canvas */}
        <canvas ref={canvasRef} width={1200} height={700}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

        {/* Cockpit-Rahmen (SVG-Overlay) */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid meet">

          {/* Cockpit-Rand */}
          <path d="M 0 700 L 0 300 Q 0 200 100 150 L 300 80 L 500 30 L 700 30 L 900 80 L 1100 150 Q 1200 200 1200 300 L 1200 700 Z"
            fill="none" stroke="#1a3a6a" strokeWidth={3} opacity={0.6} />

          {/* Instrumenten-Verkleidung unten */}
          <path d="M 0 700 L 150 580 L 450 520 L 600 510 L 750 520 L 1050 580 L 1200 700 Z"
            fill="#070b14" stroke="#1a3a6a" strokeWidth={1} />

          {/* HUD-Linien */}
          <line x1={600} y1={350} x2={600} y2={510} stroke="#1a3a6a" strokeWidth={1} opacity={0.4} strokeDasharray="4,4" />
          <circle cx={600} cy={350} r={4} fill="none" stroke="#c9a961" strokeWidth={1} opacity={0.6} />
          <circle cx={600} cy={350} r={80} fill="none" stroke="#1a3a6a" strokeWidth={1} opacity={0.25} />
          <circle cx={600} cy={350} r={160} fill="none" stroke="#1a3a6a" strokeWidth={0.5} opacity={0.15} />

          {/* Ziel-Markierung */}
          {inTransit && (
            <g transform={`translate(600, 280)`}>
              <line x1={-destSize*1.5} y1={0} x2={-destSize*0.7} y2={0} stroke="#c9a961" strokeWidth={1} opacity={0.5} />
              <line x1={destSize*0.7}  y1={0} x2={destSize*1.5}  y2={0} stroke="#c9a961" strokeWidth={1} opacity={0.5} />
              <line x1={0} y1={-destSize*1.5} x2={0} y2={-destSize*0.7} stroke="#c9a961" strokeWidth={1} opacity={0.5} />
              <line x1={0} y1={destSize*0.7}  x2={0} y2={destSize*1.5}  stroke="#c9a961" strokeWidth={1} opacity={0.5} />
              <DestinationBody type={destType_} size={destSize} name={destName} />
              <text x={destSize+8} y={-destSize+4} fontSize={10} fill="#c9a961"
                fontFamily="monospace" opacity={0.8}>{destName.toUpperCase()}</text>
            </g>
          )}

          {/* Instrumente */}
          {/* Links: Geschwindigkeit */}
          <rect x={60} y={550} width={140} height={80} rx={4}
            fill="rgba(7,11,20,0.8)" stroke="#1a3a6a" strokeWidth={1} />
          <text x={130} y={570} textAnchor="middle" fontSize={8}
            fill="#5a7a9a" fontFamily="monospace">GESCHWINDIGKEIT</text>
          <text x={130} y={600} textAnchor="middle" fontSize={20}
            fill="#c9a961" fontFamily="monospace" fontWeight="bold">
            {inTransit ? `${(1.0 * 100).toFixed(0)}%` : '0%'}
          </text>
          <text x={130} y={618} textAnchor="middle" fontSize={8}
            fill="#5a7a9a" fontFamily="monospace">SCHUB NOMINAL</text>

          {/* Mitte: Fortschritt */}
          <rect x={510} y={555} width={180} height={70} rx={4}
            fill="rgba(7,11,20,0.8)" stroke="#1a3a6a" strokeWidth={1} />
          <text x={600} y={572} textAnchor="middle" fontSize={8}
            fill="#5a7a9a" fontFamily="monospace">
            {originName.toUpperCase()} → {destName.toUpperCase()}
          </text>
          {/* Fortschrittsbalken */}
          <rect x={522} y={578} width={156} height={8} rx={2} fill="#0d1a2d" />
          <rect x={522} y={578} width={156 * progress} height={8} rx={2} fill="#2a6aca" />
          <text x={600} y={602} textAnchor="middle" fontSize={11}
            fill="#c9a961" fontFamily="monospace" fontWeight="bold">
            {Math.round(progress * 100)}%
          </text>
          {timeRemaining != null && (
            <text x={600} y={618} textAnchor="middle" fontSize={8}
              fill="#5a7a9a" fontFamily="monospace">
              ETA: {formatTime(timeRemaining)}
            </text>
          )}

          {/* Rechts: Navigation */}
          <rect x={1000} y={550} width={140} height={80} rx={4}
            fill="rgba(7,11,20,0.8)" stroke="#1a3a6a" strokeWidth={1} />
          <text x={1070} y={570} textAnchor="middle" fontSize={8}
            fill="#5a7a9a" fontFamily="monospace">NAVIGATION</text>
          <text x={1070} y={595} textAnchor="middle" fontSize={11}
            fill="#c9a961" fontFamily="monospace">{destName.toUpperCase()}</text>
          <text x={1070} y={612} textAnchor="middle" fontSize={8}
            fill="#4aff7a" fontFamily="monospace">KURS GESETZT</text>
          <text x={1070} y={625} textAnchor="middle" fontSize={8}
            fill="#5a7a9a" fontFamily="monospace">
            {inTransit ? 'AUTOPILOT AN' : 'BEREIT'}
          </text>
        </svg>

        {/* Nicht im Transit: Standby-Text */}
        {!inTransit && (
          <div style={{
            position: 'absolute', top: '40%', left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#2a4e7a', fontFamily: 'monospace', fontSize: '0.8rem',
            textAlign: 'center', lineHeight: 2,
          }}>
            <div style={{ fontSize: '1.2rem', color: '#3a6a9a' }}>STANDBY</div>
            <div>Triebwerke kaltgefahren</div>
            <div style={{ fontSize: '0.65rem', color: '#1a3a5a' }}>
              Wähle ein Ziel und starte den Flug
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
