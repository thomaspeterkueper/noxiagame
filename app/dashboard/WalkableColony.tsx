'use client'
// app/dashboard/WalkableColony.tsx
// Erstellt:     20.07.2026
// Aktualisiert: 20.07.2026 — Isometrische Darstellung (Populous/SimCity2000-Stil)
// Version:      0.4.0
//
// Phase B Vertical Slice.
// Frage: Fühlt sich NOXIA anders an, sobald ich meine Kolonie betreten kann?
//
// Invariante: Die Mikroebene erfindet keinen zweiten Weltzustand.
//             Alles ist Projektion des bestehenden Weltzustands.
//
// Straßen: ausschließlich über getStreetTiles() — kein direktes generateGrid().

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { getStreetTiles, isStreet, nearestStreetTile } from '@/lib/game/streetTiles'

// ── Typen ─────────────────────────────────────────────────────────────────────
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

interface Ship {
  id:          string
  ship_type:   string
  is_active:   boolean
  location_id: string
}

interface Props {
  locationSlug:      string
  locationName:      string
  population:        number
  entities:          TileEntity[]
  pending:           any[]
  ships:             Ship[]
  locationId:        string
  userId:            string
  onClose:           () => void
  onEnterBuilding?:  (entity: TileEntity) => void
}

// ── Render-Konstanten ─────────────────────────────────────────────────────────
const COLS      = 32
const ROWS      = 24
const ISO_W     = 32        // Halbe Rautenbreite
const ISO_H     = 16        // Halbe Rautenhöhe
const BLOCK_H   = 26        // Gebäudehöhe (Extrusion)
const CANVAS_W  = (COLS + ROWS) * ISO_W + 100
const CANVAS_H  = (COLS + ROWS) * ISO_H + 200

// Isometrische Projektion: Grid-Koordinaten → Canvas-Pixel
function isoProject(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * ISO_W + CANVAS_W / 2,
    y: (col + row) * ISO_H + 60,
  }
}

// Viewport: was der Spieler sieht (scrollbar)
const VP_W = 800
const VP_H = 500

// Figur-Größe
const FIG_W = 14
const FIG_H = 20

// ── Farben ────────────────────────────────────────────────────────────────────
const C = {
  ground:    '#3d3428',   // Mond/Mars Regolith — warmes Sandbraun
  road:      '#5a5040',   // Straße — heller als Gelände
  roadMain:  '#6a6050',   // Hauptstraße
  crossing:  '#7a7060',   // Kreuzung
  roadLine:  '#9a9080',   // Straßen-Markierung
  habitat:   '#4a6e5a',   // Habitat — gedämpftes Grün
  pad:       '#4a4a6e',   // Landing Pad — Blaugrau
  padActive: '#3a5a9a',   // Pad mit Schiff — helles Blau
  terminal:  '#6e5a3a',   // Terminal — Ocker
  state:     '#3a5a6e',   // Staatliche Gebäude — Stahlblau
  corp:      '#6e4a2a',   // Corporation — Rost
  figure:    '#c9a961',   // Spieler-Figur — Gold
  npc:       '#9abac0',   // NPC — Hellblau
  ship:      '#6a9aca',   // Schiff — Blau
  gridLine:  'rgba(255,255,255,0.08)',
  text:      '#d4c8b0',   // Text — warmes Creme
}

// ── Figur zeichnen (isometrisch, mit Schatten) ───────────────────────────────
function drawFigure(
  ctx:   CanvasRenderingContext2D,
  x:     number,
  y:     number,
  color: string = C.figure,
  label: string = '',
) {
  // Schatten (Ellipse auf dem Boden)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.ellipse(x, y + 3, 9, 4, 0, 0, Math.PI * 2)
  ctx.fill()

  const baseY = y - 4  // Füße stehen auf dem Boden

  // Beine
  ctx.fillStyle = '#1a2a3a'
  ctx.fillRect(x - 4, baseY - 8, 3.5, 8)
  ctx.fillRect(x + 1, baseY - 8, 3.5, 8)

  // Körper
  ctx.fillStyle = '#2a4e7a'
  ctx.fillRect(x - 5, baseY - 18, 10, 11)

  // Arme
  ctx.fillStyle = '#2a4e7a'
  ctx.fillRect(x - 8, baseY - 17, 3.5, 8)
  ctx.fillRect(x + 5, baseY - 17, 3.5, 8)

  // Helm (mit Highlight für 3D-Effekt)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, baseY - 22, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.beginPath()
  ctx.arc(x - 2, baseY - 24, 2.5, 0, Math.PI * 2)
  ctx.fill()

  // Visier
  ctx.fillStyle = '#4a90d0'
  ctx.globalAlpha = 0.7
  ctx.beginPath()
  ctx.arc(x, baseY - 22, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  if (label) {
    ctx.fillStyle = C.text
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(label, x, baseY - 32)
  }
}

// ── Iso-Boden zeichnen (flache Raute) ────────────────────────────────────────
function drawIsoFloor(
  ctx:   CanvasRenderingContext2D,
  col:   number,
  row:   number,
  color: string,
) {
  const { x, y } = isoProject(col, row)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y - ISO_H)
  ctx.lineTo(x + ISO_W, y)
  ctx.lineTo(x, y + ISO_H)
  ctx.lineTo(x - ISO_W, y)
  ctx.closePath()
  ctx.fill()
}

// ── Iso-Gebäude zeichnen (extrudierter Block mit Schattenseiten) ────────────
function drawIsoBuilding(
  ctx:      CanvasRenderingContext2D,
  col:      number,
  row:      number,
  topColor: string,
  label?:   string,
  icon?:    string,
  height:   number = BLOCK_H,
) {
  const { x, y } = isoProject(col, row)
  const topY = y - height

  // Farb-Varianten für 3D-Schattierung
  const shade = (hex: string, factor: number) => {
    const c = hex.replace('#', '')
    const r = Math.max(0, Math.min(255, parseInt(c.slice(0,2),16) * factor))
    const g = Math.max(0, Math.min(255, parseInt(c.slice(2,4),16) * factor))
    const b = Math.max(0, Math.min(255, parseInt(c.slice(4,6),16) * factor))
    return `rgb(${r|0},${g|0},${b|0})`
  }
  const leftColor  = shade(topColor, 0.55)   // dunkler (Schatten)
  const rightColor = shade(topColor, 0.75)   // mittel

  // Linke Wand (Süd-West-Fläche)
  ctx.fillStyle = leftColor
  ctx.beginPath()
  ctx.moveTo(x - ISO_W, y)
  ctx.lineTo(x, y + ISO_H)
  ctx.lineTo(x, y + ISO_H - height)
  ctx.lineTo(x - ISO_W, y - height)
  ctx.closePath()
  ctx.fill()

  // Rechte Wand (Süd-Ost-Fläche)
  ctx.fillStyle = rightColor
  ctx.beginPath()
  ctx.moveTo(x, y + ISO_H)
  ctx.lineTo(x + ISO_W, y)
  ctx.lineTo(x + ISO_W, y - height)
  ctx.lineTo(x, y + ISO_H - height)
  ctx.closePath()
  ctx.fill()

  // Dach (Top-Fläche, helle Raute)
  ctx.fillStyle = topColor
  ctx.beginPath()
  ctx.moveTo(x, topY - ISO_H)
  ctx.lineTo(x + ISO_W, topY)
  ctx.lineTo(x, topY + ISO_H)
  ctx.lineTo(x - ISO_W, topY)
  ctx.closePath()
  ctx.fill()

  // Kontur
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 0.5
  ctx.stroke()

  // Icon auf dem Dach
  if (icon) {
    ctx.font = '14px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(icon, x, topY)
  }
  // Label unter dem Gebäude
  if (label) {
    ctx.fillStyle = C.text
    ctx.font = '7px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(label, x, y + ISO_H + 10)
  }
}

// ── Schiff zeichnen ───────────────────────────────────────────────────────────
function drawShip(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath(); ctx.ellipse(cx, cy + 26, 20, 6, 0, 0, Math.PI*2); ctx.fill()
  // Rumpf (isometrisch angedeutet)
  ctx.fillStyle = C.ship
  ctx.beginPath()
  ctx.moveTo(cx, cy - 22)
  ctx.lineTo(cx - 16, cy + 6)
  ctx.lineTo(cx - 11, cy + 18)
  ctx.lineTo(cx + 11, cy + 18)
  ctx.lineTo(cx + 16, cy + 6)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#8ab8e8'
  ctx.lineWidth = 1
  ctx.stroke()
  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.beginPath()
  ctx.moveTo(cx, cy - 22); ctx.lineTo(cx - 8, cy - 2); ctx.lineTo(cx, cy - 2)
  ctx.closePath(); ctx.fill()
  // Triebwerk-Glühen
  ctx.fillStyle = '#ff8a1a'
  ctx.globalAlpha = 0.7
  ctx.beginPath()
  ctx.ellipse(cx, cy + 20, 9, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function WalkableColony({
  locationSlug, locationName, population,
  entities, pending, ships, locationId, userId, onClose, onEnterBuilding,
}: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Figur-Position in Tile-Koordinaten (float für Bewegung)
  const [figPos, setFigPos] = useState({ col: 4.5, row: 8.5 })
  const [moving, setMoving] = useState(false)
  const [tooltip, setTooltip] = useState<string | null>(null)
  const [nearbyEntity, setNearbyEntity] = useState<TileEntity | null>(null)
  const [viewport, setViewport] = useState({ x: 0, y: 0 })

  // Aus Weltzustand: Straßen, Gebäude, Schiffe
  const streets = getStreetTiles(locationSlug, population, entities, pending, userId, COLS, ROWS)

  // Habitat des Spielers (Startposition)
  const playerHabitat = entities.find(e =>
    e.entity_id === 'habitat' && e.profile_id === userId
  )
  const landingPad = entities.find(e =>
    e.entity_id === 'landing_pad' || e.entity_id === 'docking_bay'
  )
  const hasShipAtLocation = ships.some(s => s.is_active)

  // Figur beim ersten Render auf Habitat setzen
  useEffect(() => {
    if (playerHabitat) {
      setFigPos({ col: playerHabitat.tile_col + 0.5, row: playerHabitat.tile_row + 0.5 })
    }
  }, [])

  // Viewport auf Figur zentrieren
  useEffect(() => {
    const fx = figPos.col * TILE_PX
    const fy = figPos.row * TILE_PX
    setViewport({
      x: Math.max(0, Math.min(CANVAS_W - VP_W, fx - VP_W / 2)),
      y: Math.max(0, Math.min(CANVAS_H - VP_H, fy - VP_H / 2)),
    })
  }, [figPos])

  // Canvas rendern — isometrisch, Painter's Algorithm (hinten nach vorne)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    // Weltraum-Hintergrund
    ctx.fillStyle = '#0a0e18'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    // Sterne (dezent)
    for (let i = 0; i < 40; i++) {
      const sx = (i * 113) % CANVAS_W
      const sy = (i * 71) % (CANVAS_H * 0.4)
      ctx.fillStyle = `rgba(255,255,255,${0.05 + (i%3)*0.05})`
      ctx.beginPath(); ctx.arc(sx, sy, 0.8, 0, Math.PI*2); ctx.fill()
    }

    // Icons je Gebäudetyp
    const icons: Record<string, string> = {
      habitat: '🏠', mine: '⛏', solar: '☀️',
      landing_pad: '🛬', docking_bay: '🛬',
      bank: '🏦', school: '🏫', shipyard: '⚙️',
      warehouse: '📦', admin: '🏛', command_center: '📡',
    }

    // Render-Warteschlange: alle Objekte nach (col+row) sortiert — Painter's Algorithm
    type RenderItem = { depth: number; draw: () => void }
    const queue: RenderItem[] = []

    // 1. Boden-Rauten (Gelände + Straßen)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = ((c * 7 + r * 13) % 6) * 4
        const groundColor = `rgb(${61+v},${52+v},${40+v})`
        const street = streets.find(s => s.col === c && s.row === r)
        const color = street
          ? (street.subtype === 'main' ? C.roadMain : street.subtype === 'crossing' ? C.crossing : C.road)
          : groundColor
        queue.push({ depth: (c + r) * 2 - 1000, draw: () => drawIsoFloor(ctx, c, r, color) })
      }
    }

    // 2. Gebäude (extrudierte Blöcke)
    for (const e of entities) {
      if (e.entity_type !== 'building') continue
      const isOwn   = e.profile_id === userId
      const isState = e.owner_class === 'STATE'
      const isCorp  = !!e.profile_id && !isOwn

      const color = isState ? C.state : isOwn ? C.habitat : isCorp ? C.corp : C.habitat
      const inRange = Math.abs(e.tile_col - figPos.col) < 1.5 && Math.abs(e.tile_row - figPos.row) < 1.5

      queue.push({
        depth: e.tile_col + e.tile_row,
        draw: () => {
          drawIsoBuilding(ctx, e.tile_col, e.tile_row, color, e.entity_id, icons[e.entity_id] ?? '🏗')
          const { x, y } = isoProject(e.tile_col, e.tile_row)
          if (isOwn) {
            ctx.strokeStyle = '#c9a961'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.moveTo(x, y - BLOCK_H - ISO_H)
            ctx.lineTo(x + ISO_W, y - BLOCK_H)
            ctx.lineTo(x, y - BLOCK_H + ISO_H)
            ctx.lineTo(x - ISO_W, y - BLOCK_H)
            ctx.closePath()
            ctx.stroke()
          }
          if (inRange) {
            ctx.fillStyle = 'rgba(255,255,255,0.9)'
            ctx.font = 'bold 8px monospace'
            ctx.textAlign = 'center'
            ctx.fillText('[SPACE]', x, y + ISO_H + 20)
          }
        },
      })
    }

    // 3. Schiff am Pad
    if (landingPad && hasShipAtLocation) {
      queue.push({
        depth: landingPad.tile_col + landingPad.tile_row + 0.5,
        draw: () => {
          const { x, y } = isoProject(landingPad.tile_col, landingPad.tile_row)
          drawShip(ctx, x, y - BLOCK_H - 10)
        },
      })
    }

    // 4. Spieler-Figur
    queue.push({
      depth: figPos.col + figPos.row + 0.3,
      draw: () => {
        const { x, y } = isoProject(figPos.col, figPos.row)
        drawFigure(ctx, x, y, C.figure, 'Du')
      },
    })

    // Sortieren und zeichnen (hinten nach vorne)
    queue.sort((a, b) => a.depth - b.depth)
    for (const item of queue) item.draw()

    // Orientierungs-Kompass
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath(); ctx.arc(CANVAS_W - 30, 30, 16, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = '#c9a961'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('N', CANVAS_W - 30, 34)

  }, [figPos, streets, entities, ships, userId, landingPad, hasShipAtLocation])

  // Inverse Iso-Projektion: Canvas-Pixel → Grid-Koordinaten
  const isoUnproject = useCallback((px: number, py: number) => {
    const dx = px - CANVAS_W / 2
    const dy = py - 60
    const col = (dx / ISO_W + dy / ISO_H) / 2
    const row = (dy / ISO_H - dx / ISO_W) / 2
    return { col, row }
  }, [])

  // Klick auf Canvas → Figur bewegen (isometrisch entprojiziert)
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top)  * scaleY
    const { col, row } = isoUnproject(px, py)
    const clampedCol = Math.max(0, Math.min(COLS - 1, col))
    const clampedRow = Math.max(0, Math.min(ROWS - 1, row))
    setFigPos({ col: clampedCol, row: clampedRow })

    // Klick auf Gebäude → betreten
    const hitEntity = entities.find(en =>
      Math.abs(en.tile_col - clampedCol) < 0.6 && Math.abs(en.tile_row - clampedRow) < 0.6
    )
    if (hitEntity) {
      if (onEnterBuilding) {
        onEnterBuilding(hitEntity)
      } else {
        setTooltip(`▶ ${hitEntity.entity_id}`)
        setTimeout(() => setTooltip(null), 1500)
      }
    }
  }, [entities, userId, isoUnproject])

  // Keyboard-Navigation
  useEffect(() => {
    const STEP = 0.5
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === ' ' || e.key === 'Enter') {
        const near = entities.find(en =>
          Math.abs(en.tile_col - figPos.col) < 1.5 &&
          Math.abs(en.tile_row - figPos.row) < 1.5
        )
        if (near) {
          if (onEnterBuilding) {
            onEnterBuilding(near)
          } else {
            setTooltip(`▶ ${near.entity_id}`)
            setTimeout(() => setTooltip(null), 1500)
          }
        }
        e.preventDefault()
        return
      }
      setFigPos(p => {
        const next = { ...p }
        if (e.key === 'ArrowUp'    || e.key === 'w') next.row = Math.max(0, p.row - STEP)
        if (e.key === 'ArrowDown'  || e.key === 's') next.row = Math.min(ROWS - 1, p.row + STEP)
        if (e.key === 'ArrowLeft'  || e.key === 'a') next.col = Math.max(0, p.col - STEP)
        if (e.key === 'ArrowRight' || e.key === 'd') next.col = Math.min(COLS - 1, p.col + STEP)
        return next
      })
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      borderRadius: 8,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.5rem 1rem', background: '#070b14',
        borderBottom: '1px solid #1d2a3d', flexShrink: 0,
      }}>
        <div>
          <span style={{ color: '#c9a961', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700 }}>
            ◈ {locationName.toUpperCase()} — KOLONIEANSICHT
          </span>
          <span style={{ color: '#3a4e5a', fontSize: '0.65rem', marginLeft: '1rem', fontFamily: 'monospace' }}>
            Bevölkerung: {population.toLocaleString()}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ color: '#3a4e5a', fontSize: '0.62rem', fontFamily: 'monospace' }}>
            WASD / Pfeiltasten bewegen · SPACE/ENTER betritt Gebäude in Reichweite · ESC beenden
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #1d2a3d',
            color: '#5a6b7a', borderRadius: 6, padding: '3px 10px',
            cursor: 'pointer', fontSize: '0.75rem',
          }}>ESC</button>
        </div>
      </div>

      {/* Canvas-Viewport (scrollt mit Figur) */}
      <div ref={containerRef} style={{
        flex: 1, overflow: 'hidden', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          position: 'relative',
          width: VP_W, height: VP_H,
          overflow: 'hidden',
          border: '1px solid #1d2a3d',
          boxShadow: '0 0 60px rgba(0,0,0,0.8)',
        }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onClick={handleCanvasClick}
            style={{
              display: 'block',
              cursor: 'crosshair',
              transform: `translate(${-viewport.x}px, ${-viewport.y}px)`,
              transition: 'transform 0.2s ease',
            }}
          />
          {/* Tooltip */}
          {tooltip && (
            <div style={{
              position: 'absolute', bottom: 16, left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(7,11,20,0.9)', border: '1px solid #1d2a3d',
              color: '#c9a961', padding: '4px 12px', borderRadius: 8,
              fontSize: '0.72rem', fontFamily: 'monospace',
              pointerEvents: 'none',
            }}>
              {tooltip}
            </div>
          )}
          {/* Vignette */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.5) 100%)',
          }} />
        </div>
      </div>

      {/* Status-Bar */}
      <div style={{
        padding: '0.4rem 1rem', background: '#070b14',
        borderTop: '1px solid #1d2a3d', flexShrink: 0,
        display: 'flex', gap: '1.5rem', alignItems: 'center',
      }}>
        <span style={{ color: '#3a4e5a', fontFamily: 'monospace', fontSize: '0.62rem' }}>
          POS {Math.round(figPos.col)},{Math.round(figPos.row)}
        </span>
        {landingPad && (
          <span style={{ color: '#3a4e5a', fontFamily: 'monospace', fontSize: '0.62rem' }}>
            RAUMHAFEN: {hasShipAtLocation ? '🛸 Schiff angedockt' : 'Leer'}
          </span>
        )}
        <span style={{ color: '#3a4e5a', fontFamily: 'monospace', fontSize: '0.62rem' }}>
          {streets.length} Straßen-Tiles · {entities.length} Gebäude
        </span>
      </div>
    </div>
  )
}
