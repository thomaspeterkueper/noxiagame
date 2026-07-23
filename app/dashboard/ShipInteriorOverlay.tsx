'use client'
// app/dashboard/ShipInteriorOverlay.tsx
// Erstellt:     20.07.2026
// Aktualisiert: 20.07.2026 — SunDog-Prinzip Phase A: Schiffsgrundtriss
// Version:      1.0.0
//
// Begehbarer Schiffsgrundtriss (Top-Down, SVG).
// Spieler-Figur bewegt sich durch Schiffsbereiche.
// Module sind anklickbare Zonen → Upgrade-Panel öffnet sich.
// Prinzip: SunDog: Frozen Legacy (1984) — physische Präsenz statt Menü.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { SHIP_FRAMES, SHIP_MODULES, type ShipModule } from '@/lib/game/ships'
import { T } from './ui'

// ── Typen ─────────────────────────────────────────────────────────────────────
interface ShipModule_ {
  slotIndex:  number
  moduleId:   string
  entityId?:  string
  condition:  number
  status:     'active' | 'damaged' | 'disabled'
}

interface Props {
  frameId:    string
  modules:    ShipModule_[]
  credits:    number
  onClose:    () => void
  onUpgrade?: (slotIndex: number, moduleId: string) => Promise<void>
}

// ── Geometrie: Schiffsgrundtriss ──────────────────────────────────────────────
// Koordinatensystem: 0,0 = links oben, 400×600px ViewBox
// Nase: oben, Triebwerke: unten (wie ShipSVG topdown)
const W = 400, H = 600
const HULL_CX   = 200   // Mittellinie
const NOSE_Y    = 40    // Nasenspitze
const TAIL_Y    = 560   // Triebwerk-Ende
const HULL_W    = 90    // Halbe Rumpfbreite bei Slots

// Bereiche des Schiffs (Room-Konzept)
const ROOMS = {
  cockpit:  { label: 'Cockpit',       y: 50,  h: 80,  icon: '🛸' },
  cargo:    { label: 'Frachtraum',    y: 150, h: 240, icon: '📦' },
  engine:   { label: 'Maschinenraum', y: 410, h: 130, icon: '⚙️' },
}

// Slot-Positionen entlang der Mittellinie
function slotY(slotIndex: number, totalSlots: number): number {
  const available = ROOMS.cargo.h - 20
  const step = available / Math.max(totalSlots, 1)
  return ROOMS.cargo.y + 10 + slotIndex * step + step / 2
}

// Figur-Sprite (16×24px, einfaches Astronauten-Icon)
function FigureSprite({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x - 8},${y - 12})`} style={{ transition: 'transform 0.3s ease' }}>
      {/* Helm */}
      <circle cx={8} cy={5} r={6} fill="#c9a961" stroke="#8a6a00" strokeWidth={1} />
      <circle cx={8} cy={5} r={3.5} fill="#4a90d0" opacity={0.7} />
      {/* Körper */}
      <rect x={3} y={10} width={10} height={10} rx={2} fill="#2a4e7a" stroke="#1a3a5a" strokeWidth={1} />
      {/* Beine */}
      <rect x={3} y={19} width={4} height={5} rx={1} fill="#1a2a3a" />
      <rect x={9} y={19} width={4} height={5} rx={1} fill="#1a2a3a" />
      {/* Arme */}
      <rect x={-1} y={11} width={4} height={7} rx={1} fill="#2a4e7a" />
      <rect x={13} y={11} width={4} height={7} rx={1} fill="#2a4e7a" />
    </g>
  )
}

// Modul-Glyph im Grundtriss (kleiner als ShipSVG, klickbar)
function ModuleZone({
  slot, moduleId, condition, status, totalSlots, isSelected, onClick,
}: {
  slot: number; moduleId: string; condition: number; status: string
  totalSlots: number; isSelected: boolean; onClick: () => void
}) {
  const mod = SHIP_MODULES[moduleId]
  const cy  = slotY(slot, totalSlots)
  const w   = HULL_W * 1.8, h = Math.min(50, (ROOMS.cargo.h - 20) / totalSlots - 4)
  const x   = HULL_CX - w / 2
  const broken = status !== 'active'

  const bgColor = broken ? '#3a1010' : isSelected ? '#1a3a6a' : '#1d2a38'
  const borderColor = broken ? '#c04040' : isSelected ? '#c9a961' : '#3a4e5a'
  const condColor = condition > 70 ? '#2a9a4a' : condition > 30 ? '#c9a961' : '#c04040'

  const typeIcon: Record<string, string> = {
    cargo: '📦', tank: '🛢', habitat: '🏠', equipment: '⚙️',
  }

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Slot-Hintergrund */}
      <rect x={x} y={cy - h/2} width={w} height={h} rx={4}
        fill={bgColor} stroke={borderColor} strokeWidth={isSelected ? 2 : 1}
        style={{ transition: 'all 0.15s' }} />
      {/* Condition-Balken links */}
      <rect x={x + 3} y={cy - h/2 + 3} width={4} height={h - 6} rx={2} fill="#0a0c10" />
      <rect x={x + 3} y={cy - h/2 + 3 + (h-6) * (1 - condition/100)}
            width={4} height={(h-6) * condition/100} rx={2} fill={condColor} />
      {/* Modul-Name */}
      <text x={x + 14} y={cy - 4} fontSize={9} fill={broken ? '#804040' : '#8a9aaa'}
        fontFamily="monospace">
        {mod?.name ?? moduleId}
      </text>
      <text x={x + 14} y={cy + 7} fontSize={8} fill={broken ? '#804040' : '#c9a961'}>
        {mod ? `${typeIcon[mod.type] ?? '?'} ${mod.type}` : '?'}
        {broken ? `  ⚠ ${status}` : ''}
      </text>
      {/* Klick-Highlight */}
      {isSelected && (
        <rect x={x} y={cy - h/2} width={w} height={h} rx={4}
          fill="none" stroke="#c9a961" strokeWidth={2} opacity={0.6}
          style={{ animation: 'ship-pulse 1.5s ease-in-out infinite' }} />
      )}
    </g>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function ShipInteriorOverlay({
  frameId, modules, credits, onClose, onUpgrade,
}: Props) {
  const frame       = SHIP_FRAMES[frameId] ?? SHIP_FRAMES.mk1
  const [figurePos, setFigurePos] = useState({ x: HULL_CX, y: ROOMS.cockpit.y + 40 })
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [hoverRoom, setHoverRoom] = useState<string | null>(null)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  // SVG-Klick → Figur bewegen (nur innerhalb des Rumpfes)
  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = W / rect.width
    const scaleY = H / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top)  * scaleY
    // Nur innerhalb Rumpf-Bereich bewegen
    if (px < HULL_CX - HULL_W - 10 || px > HULL_CX + HULL_W + 10) return
    if (py < NOSE_Y + 20 || py > TAIL_Y - 20) return
    setFigurePos({ x: px, y: py })
    setSelectedSlot(null)
  }, [])

  const handleModuleClick = useCallback((slotIndex: number) => {
    const cy = slotY(slotIndex, frame.slots)
    setFigurePos({ x: HULL_CX - HULL_W * 0.5, y: cy })
    setSelectedSlot(prev => prev === slotIndex ? null : slotIndex)
  }, [frame.slots])

  const selectedModule = selectedSlot !== null
    ? modules.find(m => m.slotIndex === selectedSlot) : null
  const selectedModDef = selectedModule ? SHIP_MODULES[selectedModule.moduleId] : null

  // Keyboard: Escape schließt
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '1.5rem', padding: '1rem',
    }} onClick={e => e.target === e.currentTarget && onClose()}>

      <style>{`
        @keyframes ship-pulse {
          0%,100% { opacity: 0.4 } 50% { opacity: 1 }
        }
        @keyframes figure-step {
          0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) }
        }
      `}</style>

      {/* ── Schiffsgrundtriss ─────────────────────────────────────────────── */}
      <div style={{
        background: '#070b14', border: '1px solid #1d2a3d',
        borderRadius: 16, overflow: 'hidden', flexShrink: 0,
        boxShadow: '0 0 40px rgba(42,78,122,0.3)',
      }}>
        <div style={{
          padding: '0.6rem 1rem', borderBottom: '1px solid #1d2a3d',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: '#c9a961', fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700 }}>
            ◈ {frame.name.toUpperCase()} — INNENANSICHT
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #1d2a3d', color: '#5a6b7a',
            borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: '0.75rem',
          }}>ESC ✕</button>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width={260}
          height={390}
          style={{ display: 'block', cursor: 'crosshair' }}
          onClick={handleSvgClick}
        >
          {/* Sterne im Hintergrund */}
          {[...Array(20)].map((_,i) => {
            const sx = (i * 137.5) % W
            const sy = (i * 97.3) % H
            return <circle key={i} cx={sx} cy={sy} r={0.8} fill="white" opacity={0.15} />
          })}

          {/* Rumpf-Silhouette */}
          <path
            d={`M ${HULL_CX} ${NOSE_Y}
                L ${HULL_CX - HULL_W - 10} ${NOSE_Y + 60}
                L ${HULL_CX - HULL_W} ${NOSE_Y + 80}
                L ${HULL_CX - HULL_W} ${TAIL_Y - 40}
                L ${HULL_CX - HULL_W - 15} ${TAIL_Y}
                L ${HULL_CX + HULL_W + 15} ${TAIL_Y}
                L ${HULL_CX + HULL_W} ${TAIL_Y - 40}
                L ${HULL_CX + HULL_W} ${NOSE_Y + 80}
                L ${HULL_CX + HULL_W + 10} ${NOSE_Y + 60}
                Z`}
            fill="#0f1a24" stroke="#1d3050" strokeWidth={2}
          />

          {/* Raum-Bereiche */}
          {Object.entries(ROOMS).map(([key, room]) => (
            <g key={key}>
              <rect
                x={HULL_CX - HULL_W + 5} y={room.y}
                width={(HULL_W - 5) * 2} height={room.h}
                rx={4} fill={hoverRoom === key ? 'rgba(42,78,122,0.12)' : 'transparent'}
                stroke="#1d3050" strokeWidth={1} strokeDasharray="4 3"
                onMouseEnter={() => setHoverRoom(key)}
                onMouseLeave={() => setHoverRoom(null)}
                style={{ cursor: 'default' }}
              />
              <text x={HULL_CX - HULL_W + 10} y={room.y + 14}
                fontSize={8} fill="#2a4e7a" fontFamily="monospace">
                {room.icon} {room.label.toUpperCase()}
              </text>
            </g>
          ))}

          {/* Mittellinie */}
          <line x1={HULL_CX} y1={NOSE_Y + 20} x2={HULL_CX} y2={TAIL_Y - 20}
            stroke="#1d3050" strokeWidth={1} strokeDasharray="6 4" opacity={0.5} />

          {/* Cockpit-Fenster */}
          <ellipse cx={HULL_CX} cy={NOSE_Y + 30} rx={22} ry={14}
            fill="#0a1520" stroke="#2a4e7a" strokeWidth={1.5} />
          <ellipse cx={HULL_CX} cy={NOSE_Y + 30} rx={14} ry={9}
            fill="#4a90d0" opacity={0.2} />

          {/* Module-Zonen */}
          {Array.from({ length: frame.slots }, (_, i) => {
            const mod = modules.find(m => m.slotIndex === i)
            if (!mod) {
              // Leerer Slot
              const cy = slotY(i, frame.slots)
              const w  = HULL_W * 1.8, h = Math.min(50, (ROOMS.cargo.h - 20) / frame.slots - 4)
              return (
                <rect key={i}
                  x={HULL_CX - w/2} y={cy - h/2} width={w} height={h} rx={4}
                  fill="none" stroke="#1d3050" strokeWidth={1}
                  strokeDasharray="3 3" opacity={0.4} />
              )
            }
            return (
              <ModuleZone key={i}
                slot={i} moduleId={mod.moduleId}
                condition={mod.condition} status={mod.status}
                totalSlots={frame.slots}
                isSelected={selectedSlot === i}
                onClick={() => handleModuleClick(i)}
              />
            )
          })}

          {/* Triebwerke */}
          <rect x={HULL_CX - HULL_W - 10} y={TAIL_Y - 30}
            width={(HULL_W + 10) * 2} height={20} rx={4}
            fill="#0f1a24" stroke="#2a4e7a" strokeWidth={1.5} />
          {[-30, -10, 10, 30].map((dx, i) => (
            <g key={i}>
              <ellipse cx={HULL_CX + dx * (HULL_W / 40)} cy={TAIL_Y - 5} rx={5} ry={4}
                fill="#0a0c10" stroke="#3a4e5a" strokeWidth={1} />
              <ellipse cx={HULL_CX + dx * (HULL_W / 40)} cy={TAIL_Y + 5} rx={3} ry={3}
                fill="#ff8a1a" opacity={0.6} style={{ animation: `ship-pulse ${0.8 + i*0.1}s ease-in-out infinite` }} />
            </g>
          ))}

          {/* Spieler-Figur */}
          <g style={{ transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)' }}
            transform={`translate(${figurePos.x},${figurePos.y})`}>
            <FigureSprite x={0} y={0} />
          </g>

          {/* Positions-Hint */}
          <text x={10} y={H - 10} fontSize={7} fill="#2a4e7a" fontFamily="monospace">
            Klicken zum Bewegen · Modul anklicken zum Auswählen
          </text>
        </svg>
      </div>

      {/* ── Modul-Panel (rechts) ──────────────────────────────────────────── */}
      <div style={{
        width: 280, background: '#f8f5ee',
        border: '1px solid #ddd6c8', borderRadius: 16,
        overflow: 'hidden', flexShrink: 0,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #ddd6c8',
          background: '#2a4e7a', color: '#fff' }}>
          <div style={{ fontSize: '0.58rem', opacity: 0.7, letterSpacing: '0.15em',
            textTransform: 'uppercase', fontFamily: 'monospace' }}>
            {frame.name}
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 2 }}>
            {selectedSlot !== null ? `Slot ${selectedSlot + 1} — ${selectedModDef?.name ?? 'Leer'}` : 'Schiffssysteme'}
          </div>
        </div>

        <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {selectedSlot === null ? (
            /* Schiffs-Übersicht */
            <>
              <div style={{ fontSize: '0.68rem', color: '#6b6357', lineHeight: 1.7 }}>
                Klicke ein Modul im Grundtriss um Details zu sehen.
                Deine Figur bewegt sich zum ausgewählten Modul.
              </div>
              {/* Slot-Übersicht */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                {Array.from({ length: frame.slots }, (_, i) => {
                  const mod = modules.find(m => m.slotIndex === i)
                  const def = mod ? SHIP_MODULES[mod.moduleId] : null
                  const broken = mod?.status !== 'active'
                  return (
                    <div key={i}
                      onClick={() => mod && handleModuleClick(i)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 8px', borderRadius: 6,
                        background: mod ? (broken ? 'rgba(181,42,42,0.06)' : 'rgba(42,78,122,0.06)') : 'transparent',
                        border: `1px solid ${mod ? (broken ? 'rgba(181,42,42,0.2)' : '#ddd6c8') : '#e8e0d4'}`,
                        cursor: mod ? 'pointer' : 'default',
                      }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: '#9e9485', width: 16 }}>
                        {i + 1}
                      </span>
                      {mod ? (
                        <>
                          <span style={{ fontSize: '0.75rem', flex: 1, color: broken ? '#b52a2a' : '#1a1a18', fontWeight: 600 }}>
                            {def?.name ?? mod.moduleId}
                          </span>
                          <span style={{ fontSize: '0.62rem', color: mod.condition > 70 ? '#1a7a4a' : mod.condition > 30 ? '#8a6a00' : '#b52a2a' }}>
                            {mod.condition}%
                          </span>
                          {broken && <span style={{ fontSize: '0.6rem', color: '#b52a2a' }}>⚠</span>}
                        </>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: '#9e9485', fontStyle: 'italic' }}>— leer —</span>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* Credits */}
              <div style={{ marginTop: 8, padding: '0.5rem 0.75rem', background: 'rgba(42,78,122,0.06)',
                border: '1px solid #ddd6c8', borderRadius: 8,
                display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: '#6b6357' }}>Verfügbare Credits</span>
                <span style={{ fontWeight: 700, color: '#2a4e7a' }}>{credits.toLocaleString()} Cr</span>
              </div>
            </>
          ) : (
            /* Modul-Detail */
            <>
              {selectedModule && selectedModDef ? (
                <>
                  {/* Condition */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                      fontSize: '0.62rem', color: '#6b6357', marginBottom: 4 }}>
                      <span>Zustand</span>
                      <span style={{ fontWeight: 700, color: selectedModule.condition > 70 ? '#1a7a4a' : selectedModule.condition > 30 ? '#8a6a00' : '#b52a2a' }}>
                        {selectedModule.condition}%
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#e8e0d4', borderRadius: 3 }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${selectedModule.condition}%`,
                        background: selectedModule.condition > 70 ? '#1a7a4a' : selectedModule.condition > 30 ? '#c9a961' : '#b52a2a',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>

                  {/* Modul-Info */}
                  {[
                    ['Typ', selectedModDef.type],
                    ['Kapazität', selectedModDef.capacity > 0 ? `${selectedModDef.capacity}t` : '—'],
                    ['Masse', `${selectedModDef.mass}t`],
                    ['Funktionen', (selectedModDef as any).provides?.join(', ') ?? '—'],
                    ['Status', selectedModule.status],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between',
                      fontSize: '0.72rem', padding: '3px 0',
                      borderBottom: '1px solid #e8e0d4' }}>
                      <span style={{ color: '#6b6357' }}>{k}</span>
                      <span style={{ fontWeight: 600, color: '#1a1a18',
                        textTransform: selectedModule.status !== 'active' && k === 'Status' ? 'uppercase' : 'none',
                        color: k === 'Status' && selectedModule.status !== 'active' ? '#b52a2a' : '#1a1a18',
                      } as any}>{v}</span>
                    </div>
                  ))}

                  {/* Upgrade-Optionen */}
                  {onUpgrade && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: '0.6rem', color: '#9e9485', textTransform: 'uppercase',
                        letterSpacing: '0.15em', marginBottom: 6, fontFamily: 'monospace' }}>
                        Austausch / Upgrade
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                        {Object.values(SHIP_MODULES)
                          .filter(m => m.id !== selectedModule.moduleId)
                          .map(mod => {
                            const canAfford = credits >= mod.cost
                            return (
                              <button key={mod.id}
                                disabled={!canAfford || upgradeLoading}
                                onClick={async () => {
                                  if (!onUpgrade || !canAfford) return
                                  setUpgradeLoading(true)
                                  await onUpgrade(selectedSlot!, mod.id)
                                  setUpgradeLoading(false)
                                  setSelectedSlot(null)
                                }}
                                style={{
                                  padding: '6px 10px', borderRadius: 8, textAlign: 'left',
                                  background: canAfford ? 'rgba(42,78,122,0.06)' : 'transparent',
                                  border: `1px solid ${canAfford ? '#ddd6c8' : '#e8e0d4'}`,
                                  cursor: canAfford ? 'pointer' : 'not-allowed',
                                  opacity: canAfford ? 1 : 0.5,
                                }}>
                                <div style={{ fontWeight: 600, fontSize: '0.75rem', color: '#1a1a18' }}>
                                  {mod.name}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between',
                                  fontSize: '0.62rem', color: '#6b6357', marginTop: 2 }}>
                                  <span>{mod.type} · {mod.capacity > 0 ? `${mod.capacity}t` : (mod as any).provides?.[0] ?? '—'}</span>
                                  <span style={{ fontWeight: 700, color: canAfford ? '#2a4e7a' : '#9e9485' }}>
                                    {mod.cost.toLocaleString()} Cr
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '0.72rem', color: '#9e9485', fontStyle: 'italic' }}>
                  Leerer Slot — kein Modul installiert
                </div>
              )}

              <button onClick={() => setSelectedSlot(null)}
                style={{ marginTop: 8, padding: '6px', background: 'none',
                  border: '1px solid #ddd6c8', borderRadius: 8, cursor: 'pointer',
                  fontSize: '0.72rem', color: '#6b6357' }}>
                ← Zurück zur Übersicht
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
