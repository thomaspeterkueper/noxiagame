'use client'
// app/dashboard/ShipWalkable.tsx
// Erstellt:     20.07.2026
// Aktualisiert: 20.07.2026 — First-Person-Raumansicht (Gruds in Space-Stil)
// Version:      2.0.0
//
// Statt Top-Down-Canvas: perspektivische Einzelraum-Ansicht wie klassische
// 8-Bit-Adventures (Gruds in Space, 1983). Trapezförmige Wände, EXITS oben,
// Wechsel zwischen Räumen per Richtungstasten/Klick auf Ausgänge.
// Referenz: Sirius Software, "Gruds in Space" (1983).

import React, { useEffect, useState } from 'react'
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
  onCockpit?:   () => void
}

type Dir = 'N' | 'S' | 'E' | 'W'

interface RoomDef {
  id:      string
  label:   string
  icon:    string
  wallHue: number     // Grundfarbton für die Wände (HSL)
  exits:   Partial<Record<Dir, string>>   // Richtung → Ziel-Raum-ID
  items?:  string[]
}

// Schiffstyp-spezifische Raum-Layouts (linear verkettet: Cockpit → ... → Triebwerk)
const SHIP_ROOMS: Record<string, RoomDef[]> = {
  mk1: [
    { id: 'cockpit', label: 'Cockpit',      icon: '🛸', wallHue: 220, exits: { S: 'cargo1' } },
    { id: 'cargo1',  label: 'Laderaum A',   icon: '📦', wallHue: 95,  exits: { N: 'cockpit', S: 'cargo2', E: 'cargo2' }, items: ['Frachtcontainer', 'Ladenetz'] },
    { id: 'cargo2',  label: 'Laderaum B',   icon: '📦', wallHue: 95,  exits: { N: 'cargo1', S: 'engine' }, items: ['Frachtcontainer'] },
    { id: 'engine',  label: 'Antrieb',      icon: '⚙️', wallHue: 25,  exits: { N: 'cargo2' }, items: ['Reaktorkern', 'Kühlmittelleitung'] },
  ],
  fast: [
    { id: 'cockpit', label: 'Cockpit',      icon: '🛸', wallHue: 220, exits: { S: 'cargo' } },
    { id: 'cargo',   label: 'Laderaum',     icon: '📦', wallHue: 95,  exits: { N: 'cockpit', S: 'engine' }, items: ['Schnelltransport-Rack'] },
    { id: 'engine',  label: 'Turbinen',     icon: '🔥', wallHue: 15,  exits: { N: 'cargo' }, items: ['Hochleistungsturbine'] },
  ],
  heavy: [
    { id: 'cockpit', label: 'Brücke',       icon: '🛸', wallHue: 220, exits: { S: 'crew' } },
    { id: 'crew',    label: 'Mannschaft',   icon: '👥', wallHue: 235, exits: { N: 'cockpit', S: 'cargo1' }, items: ['Schlafkojen', 'Gemeinschaftstisch'] },
    { id: 'cargo1',  label: 'Deck A',       icon: '📦', wallHue: 95,  exits: { N: 'crew', S: 'cargo2', E: 'cargo3' }, items: ['Schwerlast-Container'] },
    { id: 'cargo2',  label: 'Deck B',       icon: '📦', wallHue: 95,  exits: { N: 'cargo1', S: 'engine' }, items: ['Schwerlast-Container'] },
    { id: 'cargo3',  label: 'Deck C',       icon: '📦', wallHue: 85,  exits: { W: 'cargo1' }, items: ['Kühlcontainer'] },
    { id: 'engine',  label: 'Triebwerk',    icon: '⚙️', wallHue: 25,  exits: { N: 'cargo2' }, items: ['Vierfach-Reaktor'] },
  ],
  scout: [
    { id: 'cockpit', label: 'Cockpit',      icon: '🛸', wallHue: 220, exits: { S: 'scanner' } },
    { id: 'scanner', label: 'Scanner-Bay',  icon: '📡', wallHue: 200, exits: { N: 'cockpit', S: 'engine' }, items: ['Tiefen-Scanner', 'Kartierungsdrohne'] },
    { id: 'engine',  label: 'Antrieb',      icon: '⚡', wallHue: 25,  exits: { N: 'scanner' }, items: ['Leichtreaktor'] },
  ],
  pioneer: [
    { id: 'cockpit', label: 'Brücke',       icon: '🛸', wallHue: 220, exits: { S: 'construction' } },
    { id: 'construction', label: 'Bau-Deck', icon: '🔧', wallHue: 30, exits: { N: 'cockpit', S: 'engine', E: 'colony' }, items: ['Bau-Ausrüstung', 'Montage-Arm'] },
    { id: 'colony',  label: 'Kolonisierung',icon: '🏘', wallHue: 210, exits: { W: 'construction' }, items: ['Kolonisierungsmodul', 'Versorgungscontainer'] },
    { id: 'engine',  label: 'Triebwerk',    icon: '⚙️', wallHue: 15,  exits: { N: 'construction' }, items: ['Schwerlast-Reaktor'] },
  ],
}

// ── Trapez-Korridor-Raum (Gruds-in-Space-Stil) ────────────────────────────────
function RoomScene({
  room, hasModule, inTransit,
}: { room: RoomDef; hasModule?: string; inTransit?: boolean }) {
  const wallColor  = `hsl(${room.wallHue}, 35%, 32%)`
  const wallLight  = `hsl(${room.wallHue}, 40%, 44%)`
  const wallDark   = `hsl(${room.wallHue}, 30%, 20%)`
  const floorColor = `hsl(${room.wallHue}, 20%, 55%)`

  return (
    <svg viewBox="0 0 400 260" style={{ width: '100%', display: 'block', background: '#05070c' }}>
      {/* Decke */}
      <polygon points="0,0 400,0 260,55 140,55" fill={wallDark} />
      {/* Boden */}
      <polygon points="0,260 400,260 260,150 140,150" fill={floorColor} opacity={0.85} />
      {/* Boden-Streifen (Perspektive) */}
      {[0.35, 0.55, 0.75, 0.92].map((t, i) => {
        const y = 150 + (260 - 150) * t
        const xL = 140 + (0 - 140) * t
        const xR = 260 + (400 - 260) * t
        return <line key={i} x1={xL} y1={y} x2={xR} y2={y} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />
      })}

      {/* Linke Wand */}
      <polygon points="0,0 140,55 140,150 0,260" fill={wallColor} />
      <polygon points="0,0 20,10 20,240 0,260" fill={wallLight} opacity={0.3} />
      {/* Rechte Wand */}
      <polygon points="400,0 260,55 260,150 400,260" fill={wallColor} />
      <polygon points="400,0 380,10 380,240 400,260" fill={wallDark} opacity={0.4} />

      {/* Rückwand (mit Konsole/Panel je nach Raumtyp) */}
      <polygon points="140,55 260,55 260,150 140,150" fill={wallLight} />

      {/* Konsolen-Details je Raumtyp */}
      {room.id === 'cockpit' && (
        <>
          <rect x={155} y={70} width={90} height={45} rx={2} fill="#0a1520" stroke="#4a90d0" strokeWidth={1.5} />
          <rect x={162} y={77} width={76} height={28} fill="#1a3a5a" opacity={0.8} />
          {[168, 185, 202, 219].map((x, i) => (
            <circle key={i} cx={x} cy={112} r={2.5} fill={i % 2 === 0 ? '#4aff7a' : '#c9a961'} opacity={0.8} />
          ))}
          {inTransit && (
            <text x={200} y={95} textAnchor="middle" fontSize={7} fill="#8abafa" fontFamily="monospace">KURS AKTIV</text>
          )}
        </>
      )}
      {room.id === 'engine' && (
        <>
          <circle cx={200} cy={95} r={26} fill="none" stroke="#ff8a1a" strokeWidth={2} opacity={0.7} />
          <circle cx={200} cy={95} r={16} fill={inTransit ? '#ff8a1a' : '#5a3a10'} opacity={0.6}>
            {inTransit && <animate attributeName="opacity" values="0.4;0.9;0.4" dur="1.2s" repeatCount="indefinite" />}
          </circle>
          <rect x={148} y={130} width={104} height={10} fill="#1a1410" />
        </>
      )}
      {(room.id.includes('cargo') || room.id === 'colony') && (
        <>
          <rect x={150} y={75} width={35} height={35} fill="#2a2418" stroke="#5a4a30" strokeWidth={1} />
          <rect x={190} y={85} width={30} height={25} fill="#241f16" stroke="#5a4a30" strokeWidth={1} />
          <rect x={225} y={75} width={35} height={35} fill="#2a2418" stroke="#5a4a30" strokeWidth={1} />
        </>
      )}
      {room.id === 'scanner' && (
        <>
          <circle cx={200} cy={90} r={20} fill="none" stroke="#4ad0d0" strokeWidth={1.5} opacity={0.6} />
          <circle cx={200} cy={90} r={12} fill="none" stroke="#4ad0d0" strokeWidth={1} opacity={0.4} />
          <line x1={180} y1={90} x2={220} y2={90} stroke="#4ad0d0" strokeWidth={0.5} opacity={0.5} />
          <line x1={200} y1={70} x2={200} y2={110} stroke="#4ad0d0" strokeWidth={0.5} opacity={0.5} />
        </>
      )}
      {room.id === 'crew' && (
        <>
          <rect x={148} y={75} width={20} height={40} rx={2} fill="#1a2a3a" stroke="#3a5a7a" strokeWidth={1} />
          <rect x={175} y={75} width={20} height={40} rx={2} fill="#1a2a3a" stroke="#3a5a7a" strokeWidth={1} />
          <rect x={205} y={75} width={20} height={40} rx={2} fill="#1a2a3a" stroke="#3a5a7a" strokeWidth={1} />
          <rect x={232} y={75} width={20} height={40} rx={2} fill="#1a2a3a" stroke="#3a5a7a" strokeWidth={1} />
        </>
      )}
      {room.id === 'construction' && (
        <>
          <rect x={160} y={70} width={80} height={12} fill="#3a3020" stroke="#6a5a30" strokeWidth={1} />
          <line x1={200} y1={82} x2={200} y2={115} stroke="#8a7a50" strokeWidth={3} />
          <circle cx={200} cy={118} r={6} fill="#c9a961" opacity={0.7} />
        </>
      )}

      {/* Türen zu Ausgängen — angedeutet in den Wänden */}
      {room.exits.N && (
        <rect x={175} y={30} width={50} height={25} fill="#0a0a0a" stroke="#3a4a5a" strokeWidth={1} opacity={0.7} />
      )}
      {room.exits.E && (
        <polygon points="260,90 300,95 300,140 260,120" fill="#0a0a0a" opacity={0.5} />
      )}
      {room.exits.W && (
        <polygon points="140,90 100,95 100,140 140,120" fill="#0a0a0a" opacity={0.5} />
      )}

      {/* Icon des Raums (schwebend, Retro-Stil) */}
      <text x={200} y={200} textAnchor="middle" fontSize={22} opacity={0.85}>{room.icon}</text>
    </svg>
  )
}

const DIR_LABEL: Record<Dir, string> = { N: 'Vorne', S: 'Hinten', E: 'Rechts', W: 'Links' }
const DIR_ARROW: Record<Dir, string> = { N: '▲', S: '▼', E: '▶', W: '◀' }

export default function ShipWalkable({ frameId, modules, credits, inTransit, onClose, onCockpit }: Props) {
  const frameKey = (frameId.replace('freighter_', '').replace('_hauler', '').replace('_courier', '')) as keyof typeof SHIP_ROOMS
  const rooms    = SHIP_ROOMS[frameKey] ?? SHIP_ROOMS.mk1
  const frame    = SHIP_FRAMES[frameKey] ?? SHIP_FRAMES.mk1

  const [currentRoomId, setCurrentRoomId] = useState('cockpit')
  const room = rooms.find(r => r.id === currentRoomId) ?? rooms[0]

  const move = (dir: Dir) => {
    const target = room.exits[dir]
    if (target) setCurrentRoomId(target)
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      const map: Record<string, Dir> = {
        ArrowUp: 'N', w: 'N', ArrowDown: 'S', s: 'S',
        ArrowRight: 'E', d: 'E', ArrowLeft: 'W', a: 'W',
      }
      if (map[e.key]) { move(map[e.key]); e.preventDefault() }
      if (e.key === ' ' || e.key === 'Enter') {
        if (room.id === 'cockpit' && onCockpit) onCockpit()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [room, onClose, onCockpit])

  const exitList = (Object.keys(room.exits) as Dir[])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem',
      fontFamily: 'monospace',
    }} onClick={e => e.target === e.currentTarget && onClose()}>

      {/* Raum-Fenster */}
      <div style={{ width: 460, background: '#000', border: '2px solid #4a3a1a', borderRadius: 4, overflow: 'hidden', boxShadow: '0 0 40px rgba(201,169,97,0.15)' }}>
        {/* Kopfzeile — EXITS wie im Original */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '4px 10px', background: '#151510', borderBottom: '1px solid #4a3a1a',
        }}>
          <span style={{ color: '#c9d060', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>
            {room.label.toUpperCase()}
          </span>
          <span style={{ color: '#c9d060', fontSize: '0.62rem' }}>
            EXITS: {exitList.length ? exitList.map(d => DIR_LABEL[d].toUpperCase()).join(' ') : 'KEINE'}
          </span>
        </div>

        <RoomScene room={room} inTransit={inTransit} />

        {/* Beschreibungszeile (wie Adventure-Textzeile) */}
        <div style={{ padding: '8px 10px', background: '#0a0a08', minHeight: 40 }}>
          <div style={{ color: '#8fa878', fontSize: '0.68rem', lineHeight: 1.6 }}>
            {room.items?.length
              ? <>Du siehst: {room.items.join(', ')}.</>
              : <>Nichts Besonderes hier.</>}
          </div>
          {room.id === 'cockpit' && (
            <div style={{ color: '#5a8ac0', fontSize: '0.64rem', marginTop: 4 }}>
              {inTransit ? '● Autopilot aktiv — Kurs gehalten.' : 'Triebwerke bereit.'}
            </div>
          )}
        </div>

        {/* Richtungssteuerung */}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', padding: '8px', background: '#0a0a08', borderTop: '1px solid #2a2418' }}>
          {(['W','N','S','E'] as Dir[]).map(d => {
            const active = !!room.exits[d]
            return (
              <button key={d} disabled={!active} onClick={() => move(d)}
                style={{
                  width: 60, padding: '6px 4px', background: active ? '#1a2a1a' : '#0d0d0a',
                  border: `1px solid ${active ? '#4a6a3a' : '#2a2418'}`, borderRadius: 4,
                  color: active ? '#c9d060' : '#3a3a30', cursor: active ? 'pointer' : 'not-allowed',
                  fontSize: '0.62rem', fontFamily: 'monospace',
                }}>
                {DIR_ARROW[d]} {DIR_LABEL[d]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Seitenpanel */}
      <div style={{ width: 240, background: '#f8f5ee', border: '1px solid #ddd6c8', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ background: '#2a4e7a', color: '#fff', padding: '0.6rem 0.85rem' }}>
          <div style={{ fontSize: '0.56rem', opacity: 0.7, letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>Schiff</div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{frame.name}</div>
        </div>
        <div style={{ padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {room.id === 'cockpit' && onCockpit && (
            <button onClick={onCockpit} style={{
              padding: '6px 10px', background: '#1a3a6a', color: '#8abafa',
              border: '1px solid #2a6aca', borderRadius: 8, cursor: 'pointer', fontSize: '0.7rem',
            }}>🖥 Cockpit-Ansicht öffnen</button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
            {modules.slice(0, 5).map((m, i) => {
              const def = SHIP_MODULES[m.moduleId]
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '3px 7px',
                  borderRadius: 6, fontSize: '0.65rem',
                  background: m.status !== 'active' ? 'rgba(181,42,42,0.06)' : 'rgba(42,78,122,0.05)',
                  border: '1px solid #ddd6c8',
                }}>
                  <span style={{ color: '#1a1a18' }}>{def?.name ?? m.moduleId}</span>
                  <span style={{ color: m.condition > 70 ? '#1a7a4a' : '#b52a2a', fontFamily: 'monospace' }}>{m.condition}%</span>
                </div>
              )
            })}
          </div>
          <button onClick={onClose} style={{
            marginTop: 6, padding: '6px', background: 'none',
            border: '1px solid #ddd6c8', borderRadius: 8, cursor: 'pointer',
            fontSize: '0.68rem', color: '#6b6357',
          }}>← Schiff verlassen (ESC)</button>
        </div>
      </div>
    </div>
  )
}
