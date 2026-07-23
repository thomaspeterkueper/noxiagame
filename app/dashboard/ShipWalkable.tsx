'use client'
// app/dashboard/ShipWalkable.tsx
// Erstellt:     20.07.2026
// Aktualisiert: 20.07.2026 — SunDog Phase A: Begehbares Schiff mit Canvas
// Version:      1.0.0
//
// Begehbarer Schiffsgrundtriss als Canvas.
// Figur läuft durch Schiffsbereiche. Module anklicken → Detail-Panel.
// Grundtriss variiert je Schiffstyp (mk1/fast/heavy/scout/pioneer).

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { SHIP_FRAMES, SHIP_MODULES } from '@/lib/game/ships'

interface ShipModule_ {
  slotIndex:  number
  moduleId:   string
  condition:  number
  status:     'active' | 'damaged' | 'disabled'
}

interface Props {
  frameId:      string
  modules:      ShipModule_[]
  credits:      number
  inTransit?:   boolean
  onClose:      () => void
  onCockpit?:   () => void   // Cockpit öffnen
}

// Schiffstyp-spezifische Grundtrisse
const SHIP_LAYOUTS: Record<string, {
  rooms:  { id: string; label: string; icon: string; x: number; y: number; w: number; h: number; color: string }[]
  hullPath: (W: number, H: number) => string
}> = {
  mk1: {
    rooms: [
      { id: 'cockpit',  label: 'Cockpit',     icon: '🛸', x: 140, y: 20,  w: 120, h: 70,  color: '#1a3a6a' },
      { id: 'cargo1',   label: 'Laderaum A',  icon: '📦', x: 80,  y: 110, w: 100, h: 80,  color: '#1a2a1a' },
      { id: 'cargo2',   label: 'Laderaum B',  icon: '📦', x: 220, y: 110, w: 100, h: 80,  color: '#1a2a1a' },
      { id: 'engine',   label: 'Antrieb',     icon: '⚙️', x: 120, y: 210, w: 160, h: 70,  color: '#2a1a0a' },
    ],
    hullPath: (W, H) =>
      `M ${W/2} 10 L ${W/2-80} 60 L ${W/2-100} ${H-30} L ${W/2+100} ${H-30} L ${W/2+80} 60 Z`,
  },
  fast: {
    rooms: [
      { id: 'cockpit',  label: 'Cockpit',     icon: '🛸', x: 150, y: 15,  w: 100, h: 60,  color: '#1a3a6a' },
      { id: 'cargo',    label: 'Laderaum',    icon: '📦', x: 120, y: 95,  w: 160, h: 70,  color: '#1a2a1a' },
      { id: 'engine',   label: 'Turbinen',    icon: '🔥', x: 100, y: 185, w: 200, h: 80,  color: '#2a1a0a' },
    ],
    hullPath: (W, H) =>
      `M ${W/2} 8 L ${W/2-60} 50 L ${W/2-80} ${H-20} L ${W/2+80} ${H-20} L ${W/2+60} 50 Z`,
  },
  heavy: {
    rooms: [
      { id: 'cockpit',  label: 'Brücke',      icon: '🛸', x: 130, y: 20,  w: 140, h: 70,  color: '#1a3a6a' },
      { id: 'cargo1',   label: 'Deck A',      icon: '📦', x: 60,  y: 110, w: 120, h: 90,  color: '#1a2a1a' },
      { id: 'cargo2',   label: 'Deck B',      icon: '📦', x: 220, y: 110, w: 120, h: 90,  color: '#1a2a1a' },
      { id: 'cargo3',   label: 'Deck C',      icon: '📦', x: 130, y: 110, w: 140, h: 90,  color: '#152515' },
      { id: 'crew',     label: 'Mannschaft',  icon: '👥', x: 100, y: 220, w: 200, h: 60,  color: '#1a1a3a' },
      { id: 'engine',   label: 'Triebwerk',   icon: '⚙️', x: 80,  y: 300, w: 240, h: 70,  color: '#2a1a0a' },
    ],
    hullPath: (W, H) =>
      `M ${W/2} 12 L ${W/2-110} 70 L ${W/2-120} ${H-20} L ${W/2+120} ${H-20} L ${W/2+110} 70 Z`,
  },
  scout: {
    rooms: [
      { id: 'cockpit',  label: 'Cockpit',     icon: '🛸', x: 155, y: 15,  w: 90,  h: 60,  color: '#1a3a6a' },
      { id: 'scanner',  label: 'Scanner-Bay', icon: '📡', x: 110, y: 95,  w: 180, h: 70,  color: '#0a2a3a' },
      { id: 'engine',   label: 'Antrieb',     icon: '⚡', x: 130, y: 185, w: 140, h: 60,  color: '#2a1a0a' },
    ],
    hullPath: (W, H) =>
      `M ${W/2} 5 L ${W/2-50} 45 L ${W/2-70} ${H-15} L ${W/2+70} ${H-15} L ${W/2+50} 45 Z`,
  },
  pioneer: {
    rooms: [
      { id: 'cockpit',  label: 'Brücke',       icon: '🛸', x: 140, y: 15,  w: 120, h: 65,  color: '#1a3a6a' },
      { id: 'construction', label: 'Bau-Deck', icon: '🔧', x: 70,  y: 100, w: 140, h: 90,  color: '#2a1a0a' },
      { id: 'colony',   label: 'Kolonisierung',icon: '🏘', x: 220, y: 100, w: 130, h: 90,  color: '#1a2a3a' },
      { id: 'engine',   label: 'Triebwerk',    icon: '⚙️', x: 100, y: 210, w: 200, h: 70,  color: '#1a0a0a' },
    ],
    hullPath: (W, H) =>
      `M ${W/2} 10 L ${W/2-100} 65 L ${W/2-110} ${H-25} L ${W/2+110} ${H-25} L ${W/2+100} 65 Z`,
  },
}

const W = 400, H = 400

function drawFigure(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath(); ctx.ellipse(x, y+12, 7, 3, 0, 0, Math.PI*2); ctx.fill()
  // Beine
  ctx.fillStyle = '#1a2a3a'
  ctx.fillRect(x-4, y+3, 3.5, 7)
  ctx.fillRect(x+1, y+3, 3.5, 7)
  // Körper
  ctx.fillStyle = '#2a4e7a'
  ctx.fillRect(x-5, y-6, 10, 10)
  // Helm
  ctx.fillStyle = '#c9a961'
  ctx.beginPath(); ctx.arc(x, y-9, 5.5, 0, Math.PI*2); ctx.fill()
  ctx.fillStyle = '#4a90d0'
  ctx.globalAlpha = 0.6
  ctx.beginPath(); ctx.arc(x, y-9, 3.5, 0, Math.PI*2); ctx.fill()
  ctx.globalAlpha = 1
}

export default function ShipWalkable({ frameId, modules, credits, inTransit, onClose, onCockpit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameKey  = frameId.replace('freighter_', '').replace('_hauler', '').replace('_courier', '') as keyof typeof SHIP_LAYOUTS
  const layout    = SHIP_LAYOUTS[frameKey] ?? SHIP_LAYOUTS.mk1
  const frame     = SHIP_FRAMES[frameKey] ?? SHIP_FRAMES.mk1

  const [figPos, setFigPos]         = useState({ x: W/2, y: 80 })
  const [selectedRoom, setSelectedRoom] = useState<string | null>('cockpit')
  const [viewport, setViewport]     = useState({ x: 0, y: 0 })

  // Viewport auf Figur zentrieren
  useEffect(() => {
    setViewport({
      x: Math.max(0, figPos.x - 300),
      y: Math.max(0, figPos.y - 200),
    })
  }, [figPos])

  // Canvas rendern
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Weltraum-Hintergrund
    ctx.fillStyle = '#03060f'
    ctx.fillRect(0, 0, W, H)

    // Sterne
    for (let i = 0; i < 30; i++) {
      const sx = (i * 97 + 13) % W
      const sy = (i * 137 + 7) % H
      ctx.fillStyle = `rgba(255,255,255,${0.05 + (i%4)*0.05})`
      ctx.beginPath(); ctx.arc(sx, sy, 0.7, 0, Math.PI*2); ctx.fill()
    }

    // Schiffshülle
    ctx.fillStyle = '#0d1a24'
    ctx.strokeStyle = '#2a4e7a'
    ctx.lineWidth = 2
    ctx.beginPath()
    const hullPath = new Path2D(layout.hullPath(W, H))
    ctx.fill(hullPath)
    ctx.stroke(hullPath)

    // Räume
    for (const room of layout.rooms) {
      const isSelected = selectedRoom === room.id
      const isCockpit  = room.id === 'cockpit'

      ctx.fillStyle = isSelected ? room.color.replace('a', 'b') : room.color
      ctx.strokeStyle = isSelected ? '#c9a961' : (isCockpit ? '#2a6aca' : '#1a3a4a')
      ctx.lineWidth = isSelected ? 2 : 1
      ctx.beginPath()
      ctx.roundRect(room.x, room.y, room.w, room.h, 4)
      ctx.fill()
      ctx.stroke()

      // Icon + Label
      ctx.font = `${Math.min(20, room.h * 0.3)}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(room.icon, room.x + room.w/2, room.y + room.h/2 - 8)
      ctx.font = '8px monospace'
      ctx.fillStyle = isSelected ? '#c9a961' : '#7a9aaa'
      ctx.fillText(room.label, room.x + room.w/2, room.y + room.h/2 + 10)

      // In Reichweite: gestrichelter Rand
      const inRange = figPos.x >= room.x - 15 && figPos.x <= room.x + room.w + 15
                   && figPos.y >= room.y - 15 && figPos.y <= room.y + room.h + 15
      if (inRange && !isSelected) {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'
        ctx.lineWidth = 1
        ctx.setLineDash([3,2])
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = '7px monospace'
        ctx.fillText('[SPACE]', room.x + room.w/2, room.y + room.h - 4)
      }
    }

    // Türen zwischen Räumen
    ctx.strokeStyle = '#3a5a7a'
    ctx.lineWidth = 3
    ctx.setLineDash([2,2])
    const cockpit = layout.rooms.find(r => r.id === 'cockpit')
    const engine  = layout.rooms.find(r => r.id === 'engine')
    if (cockpit) {
      ctx.beginPath()
      ctx.moveTo(W/2 - 8, cockpit.y + cockpit.h)
      ctx.lineTo(W/2 + 8, cockpit.y + cockpit.h)
      ctx.stroke()
    }
    if (engine) {
      ctx.beginPath()
      ctx.moveTo(W/2 - 8, engine.y)
      ctx.lineTo(W/2 + 8, engine.y)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // Triebwerk-Glühen (wenn Transit)
    if (inTransit) {
      const eng = layout.rooms.find(r => r.id === 'engine')
      if (eng) {
        const grad = ctx.createLinearGradient(W/2, eng.y + eng.h, W/2, H)
        grad.addColorStop(0, 'rgba(255,140,30,0.8)')
        grad.addColorStop(1, 'rgba(255,140,30,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.ellipse(W/2, eng.y + eng.h, 40, 12, 0, 0, Math.PI*2)
        ctx.fill()
      }
    }

    // Spieler-Figur
    drawFigure(ctx, figPos.x, figPos.y)

  }, [figPos, selectedRoom, layout, inTransit])

  // Klick → bewegen + Raum selektieren
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const px = (e.clientX - rect.left) * (W / rect.width)
    const py = (e.clientY - rect.top)  * (H / rect.height)
    setFigPos({ x: Math.max(20, Math.min(W-20, px)), y: Math.max(20, Math.min(H-20, py)) })

    // Welcher Raum wurde angeklickt?
    const hit = layout.rooms.find(r =>
      px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
    )
    if (hit) {
      setSelectedRoom(hit.id)
      if (hit.id === 'cockpit' && onCockpit) onCockpit()
    }
  }, [layout, onCockpit])

  // Keyboard
  useEffect(() => {
    const STEP = 10
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === ' ' || e.key === 'Enter') {
        const near = layout.rooms.find(r =>
          figPos.x >= r.x - 15 && figPos.x <= r.x + r.w + 15 &&
          figPos.y >= r.y - 15 && figPos.y <= r.y + r.h + 15
        )
        if (near) {
          setSelectedRoom(near.id)
          if (near.id === 'cockpit' && onCockpit) onCockpit()
        }
        e.preventDefault(); return
      }
      setFigPos(p => ({
        x: e.key === 'ArrowLeft'  || e.key === 'a' ? Math.max(20, p.x-STEP)
         : e.key === 'ArrowRight' || e.key === 'd' ? Math.min(W-20, p.x+STEP) : p.x,
        y: e.key === 'ArrowUp'   || e.key === 'w' ? Math.max(20, p.y-STEP)
         : e.key === 'ArrowDown' || e.key === 's' ? Math.min(H-20, p.y+STEP) : p.y,
      }))
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [figPos, layout, onClose, onCockpit])

  const activeRoom = layout.rooms.find(r => r.id === selectedRoom)
  const slotCount  = frame.slots

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem',
    }} onClick={e => e.target === e.currentTarget && onClose()}>

      {/* Grundtriss */}
      <div style={{ background: '#03060f', border: '1px solid #1d2a3d', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #1d2a3d',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#c9a961', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700 }}>
            ◈ {frame.name.toUpperCase()} — INNENANSICHT
            {inTransit && <span style={{ marginLeft: 8, color: '#ff8a1a', fontSize: '0.65rem' }}>● TRANSIT</span>}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {onCockpit && (
              <button onClick={onCockpit} style={{
                background: '#1a3a6a', border: '1px solid #2a6aca',
                color: '#8abafa', borderRadius: 6, padding: '2px 10px',
                cursor: 'pointer', fontSize: '0.68rem',
              }}>🛸 Cockpit</button>
            )}
            <button onClick={onClose} style={{
              background: 'none', border: '1px solid #1d2a3d',
              color: '#5a6b7a', borderRadius: 6, padding: '2px 8px',
              cursor: 'pointer', fontSize: '0.75rem',
            }}>ESC ✕</button>
          </div>
        </div>
        <canvas ref={canvasRef} width={W} height={H}
          onClick={handleClick}
          style={{ display: 'block', cursor: 'crosshair', width: 300, height: 300 }} />
        <div style={{ padding: '4px 12px', borderTop: '1px solid #0d1a24',
          fontSize: '0.6rem', color: '#2a4e7a', fontFamily: 'monospace' }}>
          WASD · Klick bewegt · SPACE betritt · ESC beenden
        </div>
      </div>

      {/* Raum-Detail Panel */}
      <div style={{ width: 260, background: '#f8f5ee', border: '1px solid #ddd6c8', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ background: '#2a4e7a', color: '#fff', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.58rem', opacity: 0.7, letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>
            {activeRoom ? 'Bereich' : 'Schiff'}
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 2 }}>
            {activeRoom ? `${activeRoom.icon} ${activeRoom.label}` : frame.name}
          </div>
        </div>
        <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {activeRoom?.id === 'cockpit' && (
            <div style={{ fontSize: '0.72rem', color: '#2a4e7a', lineHeight: 1.7 }}>
              {inTransit
                ? '🛸 Kurs gesetzt. Navigation aktiv. Autopilot hält Trajektorie.'
                : 'Triebwerke bereit. Navigation kalibriert. Anflugkorridor frei.'}
              {onCockpit && (
                <button onClick={onCockpit} style={{
                  display: 'block', marginTop: 8, padding: '6px 12px',
                  background: '#1a3a6a', color: '#8abafa',
                  border: '1px solid #2a6aca', borderRadius: 8,
                  cursor: 'pointer', fontSize: '0.72rem', width: '100%',
                }}>🖥 Cockpit-Ansicht öffnen</button>
              )}
            </div>
          )}
          {activeRoom?.id === 'engine' && (
            <div style={{ fontSize: '0.72rem', color: '#6b6357', lineHeight: 1.7 }}>
              {inTransit
                ? '🔥 Triebwerke auf 87% Schub. Kühlmittel nominal. Betriebstemperatur: 3400K.'
                : 'Triebwerke standby. Zündbereit in 3s.'}
            </div>
          )}
          {activeRoom && !['cockpit','engine'].includes(activeRoom.id) && (
            <div style={{ fontSize: '0.72rem', color: '#6b6357', lineHeight: 1.7 }}>
              {activeRoom.id.includes('cargo') || activeRoom.id === 'warehouse'
                ? `Laderaum. Kapazität: ${Math.round(slotCount * 20)}t. Befestigung nominal.`
                : activeRoom.id === 'scanner' ? 'Scanner-Array aktiv. Auflösung: 0.3m. Empfangsbereit.'
                : activeRoom.id === 'construction' ? 'Bau-Ausrüstung gesichert. Montage-Arm eingefahren.'
                : activeRoom.id === 'colony' ? 'Kolonisierungsmodul standby. Versorgungscontainer geladen.'
                : activeRoom.id === 'crew' ? `Crew-Deck. ${Math.ceil(slotCount/2)} Schlafkabinen. O₂ nominal.`
                : 'Systeme nominal.'}
            </div>
          )}

          {/* Module in diesem Raum */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {modules.slice(0, Math.min(4, modules.length)).map((m, i) => {
              const def = SHIP_MODULES[m.moduleId]
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 8px', borderRadius: 6, fontSize: '0.68rem',
                  background: m.status !== 'active' ? 'rgba(181,42,42,0.06)' : 'rgba(42,78,122,0.06)',
                  border: '1px solid #ddd6c8',
                }}>
                  <span style={{ color: '#1a1a18', fontWeight: 600 }}>{def?.name ?? m.moduleId}</span>
                  <span style={{ color: m.condition > 70 ? '#1a7a4a' : '#b52a2a', fontFamily: 'monospace', fontSize: '0.62rem' }}>
                    {m.condition}%
                  </span>
                </div>
              )
            })}
          </div>
          <button onClick={onClose} style={{
            marginTop: 4, padding: '6px', background: 'none',
            border: '1px solid #ddd6c8', borderRadius: 8,
            cursor: 'pointer', fontSize: '0.72rem', color: '#6b6357',
          }}>← Schiff verlassen</button>
        </div>
      </div>
    </div>
  )
}
