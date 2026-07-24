'use client'
// app/dashboard/BuildingInterior.tsx
// Erstellt:     20.07.2026
// Aktualisiert: 20.07.2026 — Raumhafen vollständig: Räume mit echter Funktion (Markt, Werft, Navigation, Schiff, Bar)
// Version:      3.0.0
//
// Zeigt den Innenraum eines Gebäudes als perspektivische Einzelraum-Szenen.
// Räume können eine Aktion öffnen (bestehende NOXIA-Systeme) oder reine
// Atmosphäre sein (Bar). Invariante bleibt: keine Aktion ohne reale Grundlage
// — Werftanschluss erscheint nur, wenn am Ort tatsächlich eine Werft existiert.

import React, { useEffect, useState } from 'react'

interface TileEntity {
  id:          string
  entity_id:   string
  entity_type: string
  tile_row:    number
  tile_col:    number
  profile_id:  string | null
  owner_class: string
  actor_name?: string | null
  username?:   string | null
}

interface LocationResource {
  resource:    string
  stock:       number
  production:  number
  consumption: number
}

type ActionKind = 'market' | 'shipyard' | 'navigation' | 'ship' | 'parts' | null

interface Props {
  entity:            TileEntity
  userId:            string
  locationResources: LocationResource[]
  credits:           number
  population:        number
  hasShipyard:       boolean   // existiert am Ort eine Werft (tile_entities)?
  onClose:           () => void
  onAction?:         (kind: ActionKind) => void   // öffnet bestehendes NOXIA-Overlay
}

interface RoomDef {
  id:       string
  label:    string
  icon:     string
  wallHue:  number
  detail:   'console' | 'crates' | 'beds' | 'shelves' | 'reactor' | 'terminal' | 'desk' | 'bar' | 'stars' | 'dock' | 'plain'
  action?:  ActionKind
  actionLabel?: string
  visible?: (ctx: RoomCtx) => boolean
  items:    (ctx: RoomCtx) => string[]
}

interface RoomCtx {
  stock?:      number
  production?: number
  isOwn:       boolean
  population:  number
  credits:     number
  hasShipyard: boolean
}

// ── Raumhafen: vollständig ausgestaltet ──────────────────────────────────────
const LANDING_PAD_ROOMS: RoomDef[] = [
  { id: 'lobby', label: 'Lobby', icon: '🚪', wallHue: 210, detail: 'desk',
    items: () => ['Ankunftshalle', 'Anzeigetafel mit Abflügen'] },
  { id: 'cargo_office', label: 'Frachtbüro', icon: '📋', wallHue: 40, detail: 'console',
    action: 'market', actionLabel: '📈 Markt öffnen',
    items: () => ['Handelsterminal', 'Preisaushang'] },
  { id: 'parts', label: 'Ersatzteil-Handel', icon: '🔧', wallHue: 25, detail: 'shelves',
    action: 'parts', actionLabel: '🔩 Ersatzteile ansehen',
    items: () => ['Modul-Regale', 'Werkbank'] },
  { id: 'navroom', label: 'Navigationsraum', icon: '🧭', wallHue: 260, detail: 'stars',
    action: 'navigation', actionLabel: '🌌 Sonnensystem ansehen',
    items: () => ['Live-Projektion des Sonnensystems', 'Aktuelle Positionen aller Körper'] },
  { id: 'shipyard_link', label: 'Werftanschluss', icon: '⚙️', wallHue: 15, detail: 'reactor',
    action: 'shipyard', actionLabel: '🛠 Werft öffnen',
    visible: ({ hasShipyard }) => hasShipyard,
    items: () => ['Direktverbindung zur Werft'] },
  { id: 'dock', label: 'Landedock', icon: '🛬', wallHue: 200, detail: 'dock',
    action: 'ship', actionLabel: '🛸 Zum Schiff',
    items: ({ isOwn }) => [isOwn ? 'Dein Schiff liegt hier' : 'Fremdes Dock'] },
  { id: 'bar', label: 'Bar', icon: '🍺', wallHue: 30, detail: 'bar',
    items: () => ['„Hab gehört, Goibniu Co. baut wieder eine Mine…"', 'Ein Pilot nickt dir zu.'] },
]

// ── Andockbucht (Stationen) — kompakter, gleiche Prinzipien ──────────────────
const DOCKING_BAY_ROOMS: RoomDef[] = [
  { id: 'airlock', label: 'Luftschleuse', icon: '🚪', wallHue: 210, detail: 'plain',
    items: () => ['Druckausgleich bereit'] },
  { id: 'navroom', label: 'Navigationsraum', icon: '🧭', wallHue: 260, detail: 'stars',
    action: 'navigation', actionLabel: '🌌 Sonnensystem ansehen',
    items: () => ['Live-Projektion des Sonnensystems'] },
  { id: 'dock', label: 'Andockbucht', icon: '🛸', wallHue: 220, detail: 'dock',
    action: 'ship', actionLabel: '🛸 Zum Schiff',
    items: () => ['Magnetkupplungen aktiv'] },
]

// ── Übrige Gebäude: einfacher, ohne Aktionen (noch nicht ausgestaltet) ───────
const BUILDING_ROOMS: Record<string, RoomDef[]> = {
  landing_pad:   LANDING_PAD_ROOMS,
  docking_bay:   DOCKING_BAY_ROOMS,
  habitat: [
    { id: 'entry',   label: 'Eingangsschleuse', icon: '🚪', wallHue: 200, detail: 'plain',
      items: () => ['Druckluftschleuse', 'Stiefelablage'] },
    { id: 'common',  label: 'Gemeinschaftsraum', icon: '🛋', wallHue: 40, detail: 'desk',
      items: ({ population }) => [`${Math.min(20, Math.ceil(population/50))} Bewohner anwesend`, 'Gemeinschaftstisch'] },
    { id: 'quarters',label: 'Wohneinheiten',    icon: '🛏', wallHue: 220, detail: 'beds',
      items: ({ population }) => [`${Math.min(100, Math.ceil(population/10))} von 100 Plätzen belegt`] },
  ],
  mine: [
    { id: 'entry',   label: 'Stollen-Eingang',  icon: '⛏', wallHue: 30,  detail: 'plain',
      items: () => ['Förderwagen', 'Sicherheitshinweis'] },
    { id: 'shaft',   label: 'Förderanlage',     icon: '⚙️', wallHue: 25,  detail: 'reactor',
      items: ({ production }) => [`Förderung: ${production ?? 0}t/Tick`, 'Förderband aktiv'] },
    { id: 'storage', label: 'Erzlager',         icon: '📦', wallHue: 40,  detail: 'crates',
      items: ({ stock }) => [`Lagerbestand: ${stock ?? 0}t`, 'Bereit zum Abtransport'] },
  ],
  solar: [
    { id: 'control', label: 'Kontrollraum',     icon: '☀️', wallHue: 45,  detail: 'console',
      items: ({ production }) => [`Produktion: ${production ?? 0}t Energie/Tick`, 'Paneele optimal ausgerichtet'] },
    { id: 'buffer',  label: 'Pufferspeicher',   icon: '🔋', wallHue: 200, detail: 'reactor',
      items: () => ['Akku-Bank', 'Ladezustand nominal'] },
  ],
  bank: [
    { id: 'lobby',   label: 'Empfang',          icon: '🏦', wallHue: 45,  detail: 'desk',
      items: () => ['Wartebereich', 'Auskunftsschalter'] },
    { id: 'vault',   label: 'Tresorraum',       icon: '🔐', wallHue: 45,  detail: 'crates',
      items: ({ credits }) => [`Kontostand: ${credits.toLocaleString()} Cr`, 'Zinssatz: 1.2%/Tick'] },
  ],
  school: [
    { id: 'hall',    label: 'Hörsaal',          icon: '🏫', wallHue: 260, detail: 'desk',
      items: () => ['Nächste Vorlesung: Orbital-Mechanik'] },
    { id: 'terminal',label: 'SSF-Terminal',     icon: '💻', wallHue: 200, detail: 'terminal',
      items: () => ['Solar Science Foundation — verbunden', 'Lernmodule verfügbar'] },
  ],
  warehouse: [
    { id: 'ramp',    label: 'Laderampe',        icon: '🚚', wallHue: 40,  detail: 'plain',
      items: () => ['Verladefahrzeug'] },
    { id: 'storage', label: 'Hauptlager',       icon: '📦', wallHue: 40,  detail: 'shelves',
      items: ({ stock }) => [`Lagerbestand: ${stock ?? 0}t gesamt`, 'Kapazität: 500t'] },
  ],
  shipyard: [
    { id: 'hall',    label: 'Empfangshalle',    icon: '⚙️', wallHue: 210, detail: 'desk',
      items: () => ['Auftragsliste'] },
    { id: 'assembly',label: 'Montagehalle',     icon: '🔧', wallHue: 25,  detail: 'reactor',
      items: () => ['Montage-Roboter aktiv', 'Nächstes Schiff: Mk.I'] },
  ],
  admin: [
    { id: 'lobby',   label: 'Empfang',          icon: '🏛', wallHue: 210, detail: 'desk',
      items: () => ['Anzeigetafel'] },
    { id: 'office',  label: 'Büros',            icon: '📋', wallHue: 45,  detail: 'terminal',
      items: ({ population }) => [`Verwaltung für ${population.toLocaleString()} Einwohner`, 'Offene Anträge: 0'] },
  ],
  command_center: [
    { id: 'control', label: 'Kontrollraum',     icon: '📡', wallHue: 210, detail: 'console',
      items: () => ['Alle Systeme nominal', 'Orbitalverbindung aktiv'] },
    { id: 'comm',    label: 'Kommunikation',    icon: '📻', wallHue: 200, detail: 'terminal',
      items: () => ['Nächste Kommunikation: Erde +8min'] },
  ],
}

const DEFAULT_ROOMS: RoomDef[] = [
  { id: 'entry', label: 'Eingang', icon: '🏗', wallHue: 90, detail: 'plain', items: () => ['Gebäude in Betrieb.'] },
]

// ── Trapez-Korridor-Raum ──────────────────────────────────────────────────────
function RoomScene({ room }: { room: RoomDef }) {
  const wallColor  = `hsl(${room.wallHue}, 30%, 34%)`
  const wallLight  = `hsl(${room.wallHue}, 35%, 46%)`
  const wallDark   = `hsl(${room.wallHue}, 25%, 22%)`
  const floorColor = `hsl(${room.wallHue}, 15%, 58%)`

  return (
    <svg viewBox="0 0 400 220" style={{ width: '100%', display: 'block', background: '#05070c' }}>
      <polygon points="0,0 400,0 260,48 140,48" fill={wallDark} />
      <polygon points="0,220 400,220 260,128 140,128" fill={floorColor} opacity={0.85} />
      {[0.35, 0.6, 0.85].map((t, i) => {
        const y = 128 + (220 - 128) * t
        const xL = 140 + (0 - 140) * t
        const xR = 260 + (400 - 260) * t
        return <line key={i} x1={xL} y1={y} x2={xR} y2={y} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />
      })}
      <polygon points="0,0 140,48 140,128 0,220" fill={wallColor} />
      <polygon points="0,0 18,8 18,205 0,220" fill={wallLight} opacity={0.3} />
      <polygon points="400,0 260,48 260,128 400,220" fill={wallColor} />
      <polygon points="400,0 382,8 382,205 400,220" fill={wallDark} opacity={0.4} />
      <polygon points="140,48 260,48 260,128 140,128" fill={wallLight} />

      {room.detail === 'console' && (
        <>
          <rect x={155} y={60} width={90} height={40} rx={2} fill="#0a1520" stroke="#4a90d0" strokeWidth={1.5} />
          <rect x={162} y={66} width={76} height={24} fill="#1a3a5a" opacity={0.8} />
          {[168, 185, 202, 219].map((x, i) => (
            <circle key={i} cx={x} cy={95} r={2} fill={i % 2 === 0 ? '#4aff7a' : '#c9a961'} opacity={0.8} />
          ))}
        </>
      )}
      {room.detail === 'terminal' && (
        <>
          <rect x={165} y={62} width={70} height={44} rx={2} fill="#0a1a0a" stroke="#4ada6a" strokeWidth={1.5} />
          <rect x={171} y={68} width={58} height={30} fill="#0a2a12" />
          <text x={200} y={86} textAnchor="middle" fontSize={5} fill="#4ada6a" fontFamily="monospace">SSF://</text>
        </>
      )}
      {room.detail === 'crates' && (
        <>
          <rect x={150} y={68} width={32} height={32} fill="#2a2418" stroke="#5a4a30" strokeWidth={1} />
          <rect x={188} y={78} width={26} height={22} fill="#241f16" stroke="#5a4a30" strokeWidth={1} />
          <rect x={220} y={68} width={32} height={32} fill="#2a2418" stroke="#5a4a30" strokeWidth={1} />
        </>
      )}
      {room.detail === 'shelves' && (
        <>
          {[0,1,2].map(i => (
            <g key={i}>
              <line x1={155} y1={62+i*16} x2={245} y2={62+i*16} stroke="#5a4a30" strokeWidth={2} />
              <rect x={160+i*8} y={64+i*16} width={14} height={11} fill="#3a3020" />
              <rect x={200-i*4} y={64+i*16} width={14} height={11} fill="#2a2418" />
            </g>
          ))}
        </>
      )}
      {room.detail === 'beds' && (
        <>
          {[0,1,2,3].map(i => (
            <rect key={i} x={150 + i*26} y={70} width={20} height={38} rx={2}
              fill="#1a2a3a" stroke="#3a5a7a" strokeWidth={1} />
          ))}
        </>
      )}
      {room.detail === 'reactor' && (
        <>
          <circle cx={200} cy={85} r={22} fill="none" stroke="#ff8a1a" strokeWidth={2} opacity={0.7} />
          <circle cx={200} cy={85} r={13} fill="#ff8a1a" opacity={0.5}>
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.5s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      {room.detail === 'desk' && (
        <>
          <rect x={160} y={85} width={80} height={8} fill="#3a3020" />
          <rect x={160} y={93} width={80} height={22} fill="#241f16" />
          <circle cx={200} cy={78} r={5} fill="#c9a961" opacity={0.6} />
        </>
      )}
      {room.detail === 'bar' && (
        <>
          <rect x={155} y={90} width={90} height={10} fill="#3a2818" />
          <rect x={155} y={70} width={12} height={20} fill="#2a1a10" />
          {[0,1,2].map(i => (
            <rect key={i} x={165+i*22} y={72} width={6} height={16} rx={1} fill="#8a4a30" opacity={0.8} />
          ))}
        </>
      )}
      {room.detail === 'stars' && (
        <>
          <circle cx={200} cy={85} r={28} fill="none" stroke="#4a90d0" strokeWidth={1} opacity={0.4} />
          {[...Array(12)].map((_, i) => {
            const a = (i / 12) * Math.PI * 2
            const r = 8 + (i % 3) * 6
            return <circle key={i} cx={200 + Math.cos(a)*r} cy={85 + Math.sin(a)*r*0.6}
              r={1} fill="#c9d8ff" opacity={0.7} />
          })}
          <circle cx={200} cy={85} r={4} fill="#c0563f" />
        </>
      )}
      {room.detail === 'dock' && (
        <>
          <rect x={165} y={65} width={70} height={45} rx={2} fill="none" stroke="#4a90d0" strokeWidth={1.5} strokeDasharray="4,2" />
          <polygon points="200,72 185,95 190,105 210,105 215,95" fill="#3a5a7a" stroke="#6a9aca" strokeWidth={1} />
        </>
      )}

      <text x={200} y={170} textAnchor="middle" fontSize={20} opacity={0.85}>{room.icon}</text>
    </svg>
  )
}

export default function BuildingInterior({
  entity, userId, locationResources, credits, population, hasShipyard, onClose, onAction,
}: Props) {
  const allRooms = BUILDING_ROOMS[entity.entity_id] ?? DEFAULT_ROOMS
  const isOwn   = entity.profile_id === userId
  const isState = entity.owner_class === 'STATE'

  const ctxBase: RoomCtx = {
    stock: undefined, production: undefined, isOwn, population, credits, hasShipyard,
  }
  const res = locationResources.find(r =>
    (entity.entity_id === 'mine'  && r.resource === 'metal') ||
    (entity.entity_id === 'solar' && r.resource === 'energy') ||
    (entity.entity_id === 'warehouse' && r.resource === 'water')
  )
  const ctx: RoomCtx = { ...ctxBase, stock: res?.stock, production: res?.production }

  const rooms = allRooms.filter(r => !r.visible || r.visible(ctx))
  const [roomIdx, setRoomIdx] = useState(0)
  const room = rooms[Math.min(roomIdx, rooms.length - 1)]

  const ownerLabel = isOwn ? '🔑 Dein Gebäude'
    : isState ? '🏛 Staatlich'
    : `👤 ${entity.actor_name ?? entity.username ?? 'Fremd'}`

  const items = room.items(ctx)
  const canPrev = roomIdx > 0
  const canNext = roomIdx < rooms.length - 1

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if ((e.key === 'ArrowRight' || e.key === 'd') && canNext) setRoomIdx(i => i + 1)
      if ((e.key === 'ArrowLeft'  || e.key === 'a') && canPrev) setRoomIdx(i => i - 1)
      if ((e.key === ' ' || e.key === 'Enter') && room.action && onAction) {
        onAction(room.action); e.preventDefault()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [canNext, canPrev, onClose, room, onAction])

  return (
    <div style={{
      background: '#000', border: '2px solid #4a3a1a', borderRadius: 4,
      overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontFamily: 'monospace',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 10px', background: '#151510', borderBottom: '1px solid #4a3a1a',
      }}>
        <span style={{ color: '#c9d060', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em' }}>
          {room.label.toUpperCase()}
        </span>
        <span style={{ color: '#c9d060', fontSize: '0.58rem' }}>
          RAUM {roomIdx + 1}/{rooms.length}
        </span>
      </div>

      <RoomScene room={room} />

      <div style={{ padding: '7px 10px', background: '#0a0a08', minHeight: 34 }}>
        <div style={{ color: '#6b6357', fontSize: '0.6rem', marginBottom: 3 }}>{ownerLabel}</div>
        <div style={{ color: '#8fa878', fontSize: '0.64rem', lineHeight: 1.5 }}>
          {items.join(' · ')}
        </div>
      </div>

      {/* Aktions-Button — nur wenn Raum eine echte Funktion öffnet */}
      {room.action && onAction && (
        <div style={{ padding: '0 10px 8px', background: '#0a0a08' }}>
          <button onClick={() => onAction(room.action!)} style={{
            width: '100%', padding: '8px', background: '#1a3a1a',
            border: '1px solid #4a8a4a', borderRadius: 4,
            color: '#a0e0a0', cursor: 'pointer', fontSize: '0.68rem',
            fontFamily: 'monospace', fontWeight: 700,
          }}>{room.actionLabel ?? 'Öffnen'}</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', padding: '7px', background: '#0a0a08', borderTop: '1px solid #2a2418' }}>
        <button disabled={!canPrev} onClick={() => setRoomIdx(i => i - 1)}
          style={{
            flex: 1, padding: '5px 4px', background: canPrev ? '#1a2a1a' : '#0d0d0a',
            border: `1px solid ${canPrev ? '#4a6a3a' : '#2a2418'}`, borderRadius: 4,
            color: canPrev ? '#c9d060' : '#3a3a30', cursor: canPrev ? 'pointer' : 'not-allowed',
            fontSize: '0.6rem', fontFamily: 'monospace',
          }}>◀ Zurück</button>
        <button disabled={!canNext} onClick={() => setRoomIdx(i => i + 1)}
          style={{
            flex: 1, padding: '5px 4px', background: canNext ? '#1a2a1a' : '#0d0d0a',
            border: `1px solid ${canNext ? '#4a6a3a' : '#2a2418'}`, borderRadius: 4,
            color: canNext ? '#c9d060' : '#3a3a30', cursor: canNext ? 'pointer' : 'not-allowed',
            fontSize: '0.6rem', fontFamily: 'monospace',
          }}>Weiter ▶</button>
      </div>
      <button onClick={onClose} style={{
        width: '100%', padding: '6px', background: '#151510',
        border: 'none', borderTop: '1px solid #2a2418',
        cursor: 'pointer', fontSize: '0.6rem', color: '#8a7a50',
      }}>✕ Gebäude verlassen (ESC)</button>
    </div>
  )
}
