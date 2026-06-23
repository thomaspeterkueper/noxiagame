// app/dashboard/ColonyGrid.tsx
// Erstellt:     31.05.2026
// Aktualisiert: 23.06.2026 10:55 — ResizeObserver Fix + warehouse/market Klick
//   21.06.2026 – showLanding State, onOpenShipyard/Warehouse/onChanged Props
//   15.06.2026 – Anomalie-Marker, BuildingSVG, Straßen
//   07.06.2026 – tile_entities, Eigentum, Gebäude-Verkauf, Steuer-Sidebar
// Version:      3.9.2
//
// Kachelgrid pro Kolonie (12×8):
// - Terrain seed-basiert deterministisch
// - Bestand aus tile_entities (mit id + profile_id → Eigentum + Verkauf)
// - Laufende Vorgänge aus player_builds (Baustelle / „wird verkauft")
// - Klick auf bebaubare Kachel → Build-Popup
// - Klick auf eigenes Gebäude → SellPanel mit Marktbewertung

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useGameStore } from '@/lib/store/gameStore'
import { BUILDINGS } from '@/lib/game/buildings/index'
import { TileSVG } from '@/lib/grid/TileSVG'
import { BuildingSVG, BuildingSpriteStyles } from '@/lib/grid/BuildingSVG'
import { generateGrid, gridTypes, anomalyAt, isBuildable, NPC_ENTITY, COLS, ROWS } from '@/lib/grid/generateGrid'
import SellPanel from './SellPanel'
import AdminOverlay from './AdminOverlay'
import LandingOverlay from './LandingOverlay'
import SchoolOverlay from './SchoolOverlay'
import BankOverlay from './BankOverlay'

function TileDisplay({ tileType, slug }: { tileType: string; slug: string }) {
  const [src, setSrc] = useState(`/images/grid/${slug}/${tileType}.webp`)
  const [useSVG, setUseSVG] = useState(false)

  if (useSVG) return <TileSVG type={tileType} planet={slug} />

  return (
    <img
      src={src}
      width={44} height={44}
      style={{ display: 'block' }}
      onError={() => {
        if (src.endsWith('.webp')) setSrc(`/images/grid/${slug}/${tileType}.png`)
        else setUseSVG(true)
      }}
    />
  )
}

const TILE_SIZE_MIN = 44
const TILE_SIZE_MAX = 80

// ── Typen für Bestand + Vorgänge ──────────────────────────────

export interface TileEntity {
  id:             string
  profile_id:     string | null
  is_state_owned?: boolean
  entity_type:    string
  entity_id:      string
  tile_level:     number
  tile_row:       number
  tile_col:       number
  username?:      string
}

export interface PendingBuild {
  buildable_id: string
  tile_row:     number
  tile_col:     number
  status:       string
}

// ── Build-Popup ───────────────────────────────────────────────

function BuildPopup({
  tileRow, tileCol, locationSlug, onClose, onBuildStarted
}: {
  tileRow:        number
  tileCol:        number
  locationSlug:   string
  onClose:        () => void
  onBuildStarted: (newCredits: number) => void
}) {
  const { credits } = useGameStore()
  const [building, setBuilding] = useState(false)
  const [msg, setMsg]           = useState<string | null>(null)

  const items = Object.entries(BUILDINGS).filter(([, b]) => !b.planned)

  async function startBuild(buildableId: string) {
    setBuilding(true); setMsg(null)
    const token = (await import('@/lib/supabase/client')).createClient()
    const { data: { session } } = await token.auth.getSession()
    const jwt = session?.access_token ?? ''
    const res = await fetch(
      `/api/game/build?action=start&buildableId=${buildableId}&location=${locationSlug}&tileRow=${tileRow}&tileCol=${tileCol}&tileLevel=0`,
      { headers: { Authorization: `Bearer ${jwt}` } }
    )
    const data = await res.json()
    setBuilding(false)
    if (data.error) { setMsg(data.error); return }
    onBuildStarted(data.credits ?? credits)
    onClose()
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(10,20,32,0.97)',
      borderRadius: '10px',
      display: 'flex', flexDirection: 'column',
      padding: '1rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ color: '#b99b6b', fontWeight: 700, fontSize: '0.85rem' }}>
          🏗️ Gebäude bauen — Kachel ({tileRow}, {tileCol})
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
      </div>
      {msg && <div style={{ color: '#e05050', fontSize: '0.7rem', marginBottom: '0.5rem' }}>{msg}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
        {items.map(([id, item]) => {
          const canAfford = credits >= item.cost
          return (
            <button key={id} disabled={building || !canAfford}
              onClick={() => startBuild(id)}
              style={{
                background: canAfford ? 'rgba(42,78,122,0.5)' : 'rgba(30,40,55,0.5)',
                border: `1px solid ${canAfford ? '#2a4e7a' : '#2a3a4a'}`,
                borderRadius: '6px', padding: '0.6rem 0.75rem',
                color: canAfford ? '#cdd6e0' : '#4a5a6a',
                cursor: canAfford ? 'pointer' : 'not-allowed',
                textAlign: 'left', fontSize: '0.75rem',
              }}>
              <div style={{ fontWeight: 700, marginBottom: '2px' }}>{item.name}</div>
              <div style={{ fontSize: '0.65rem', color: canAfford ? '#8a9ab0' : '#3a4a5a' }}>
                {item.cost.toLocaleString('de')} Cr · {item.buildTimeTicks} Tick(s)
                {item.produces && ` · +${item.produces.amount} ${item.produces.resource}/Tick`}
                {item.populationBonus && ` · +${item.populationBonus} Kapazität`}
              </div>
            </button>
          )
        })}
      </div>

      {Object.values(BUILDINGS).filter(b => b.planned).length > 0 && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '0.6rem', color: '#5a6878', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            In Entwicklung
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {Object.values(BUILDINGS).filter(b => b.planned).map(p => (
              <div key={p.id} style={{
                fontSize: '0.6rem', background: 'rgba(255,255,255,0.03)',
                border: '1px solid #2a3a4a', borderRadius: '4px',
                padding: '0.15rem 0.4rem', color: '#4a5a6a',
                cursor: 'default', opacity: 0.7,
              }}>
                {p.name}
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.58rem', color: '#465668', marginTop: '0.5rem', lineHeight: 1.4 }}>
            Diese Gebäude sind in Vorbereitung und bald verfügbar.
          </div>
        </div>
      )}
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────


const RES_DE: Record<string, string> = {
  metal: 'Metall', energy: 'Energie', water: 'Wasser',
}

// ── TileTooltip ──────────────────────────────────────────────────────────────
interface TooltipInfo {
  r: number; c: number
  x: number; y: number   // viewport-Koordinaten (fixed positioning)
  entity?:    TileEntity
  isOwn:      boolean
  isState:    boolean
  isSelling:  boolean
  tileType:   string
  eco?:       EntityEconomy
}

function TileTooltip({ info, COLS }: { info: TooltipInfo; COLS: number }) {
  const name = info.entity
    ? (BUILDINGS[info.entity.entity_id]?.name ?? info.entity.entity_id)
    : info.tileType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  const flipX = info.c >= COLS - 3
  const flipY = info.r >= 6
  // info.x = viewport right edge of tile, info.y = viewport top of tile

  const borderColor = info.isOwn
    ? 'rgba(201,169,97,0.65)'
    : info.isState
      ? 'rgba(90,174,255,0.5)'
      : info.entity
        ? 'rgba(224,80,80,0.45)'
        : 'rgba(42,78,122,0.35)'

  const nameColor = info.isOwn
    ? '#c9a961'
    : info.isState ? '#5aaeff'
    : info.entity  ? '#e8a0a0'
    : '#8ab0d0'

  return (
    <div style={{
      position:      'fixed',
      left:          flipX ? undefined : info.x + 6,
      right:         flipX ? `calc(100vw - ${info.x}px + 50px)` : undefined,
      top:           flipY ? undefined : info.y,
      bottom:        flipY ? `calc(100vh - ${info.y}px)` : undefined,
      zIndex:        9999,
      background:    'rgba(6,14,24,0.97)',
      border:        `1px solid ${borderColor}`,
      borderRadius:  '7px',
      padding:       '8px 11px',
      minWidth:      '150px',
      maxWidth:      '210px',
      boxShadow:     '0 4px 20px rgba(0,0,0,0.7)',
      pointerEvents: 'none',
      fontFamily:    "'Courier Prime', monospace",
    }}>
      {/* Name */}
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: nameColor, marginBottom: '4px' }}>
        {name}
      </div>

      {/* Eigentümer */}
      {info.entity && (
        <div style={{ fontSize: '0.65rem', color: '#7a8a9a', marginBottom: info.isOwn ? '5px' : '0' }}>
          {info.isOwn
            ? '🔑 Dein Gebäude'
            : info.isState
              ? '🏛 Staatlich'
              : `👤 ${info.entity.username ?? 'Anderer Pilot'}`}
          {info.isSelling && <span style={{ color: '#e8702a', marginLeft: '6px' }}>· wird verkauft</span>}
        </div>
      )}

      {/* Eigene: Produktion */}
      {info.isOwn && info.eco?.produktion != null && info.eco.ressource && (
        <>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '5px 0' }} />
          <div style={{ fontSize: '0.68rem', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#5a7a8a' }}>Produktion</span>
            <span style={{ color: '#6fcf97' }}>+{info.eco.produktion} {RES_DE[info.eco.ressource] ?? info.eco.ressource}/Tick</span>
          </div>
        </>
      )}

      {/* Leere Kachel */}
      {!info.entity && (
        <div style={{ fontSize: '0.65rem', color: '#3a5a6a', marginTop: '2px' }}>
          {isBuildable(info.tileType) ? '✅ Bebaubar' : info.tileType.replace(/_/g, ' ')}
        </div>
      )}

      {/* Hinweis */}
      {info.entity && (
        <div style={{ fontSize: '0.58rem', color: '#3a5a7a', marginTop: '5px' }}>
          {info.isOwn ? 'Klicken für Details & Verkauf' : info.isState ? 'Staatliches Gebäude' : 'Fremdes Gebäude'}
        </div>
      )}
    </div>
  )
}


export interface EntityEconomy {
  ertragswert:       number
  produktion:        number | null
  ressource:         string | null
  resourceSellPrice: number | null
}

export interface ColonyTax {
  tax_property:    number
  tax_transaction: number
  tax_landing:     number
}

interface ColonyGridProps {
  slug:              string
  name:              string
  population:        number
  populationMax:     number
  isSupplied:        boolean
  userId:            string
  entities?:         TileEntity[]
  pending?:          PendingBuild[]
  tax?:              ColonyTax
  entityInfo?:       Record<string, EntityEconomy>
  locationResources?: { resource: string; stock: number; consumption: number }[]
  credits?:          number
  allLocations?:     { slug: string; name: string; population: number }[]
  cargo?:            Record<string, number>
  shipRange?:        number
  currentTick?:      number
  inTransit?:        boolean
  onTravel?:         (dest: string) => void
  onOpenShipyard?:   () => void
  onOpenWarehouse?:  () => void
  onChanged?:        () => void
}


// ── GridMinimap ──────────────────────────────────────────────────────────────
// Leichte SVG-Übersicht: Gebäude als farbige Punkte, kein generateGrid nötig.
// Sitzt als position:absolute rechts unten im Grid.
function GridMinimap({
  COLS, ROWS, tileSize, entities, pending, userId, slug,
}: {
  COLS: number; ROWS: number; tileSize: number
  entities: any[]; pending: any[]; userId: string; slug: string
}) {
  const W = 120; const H = Math.round(W * ROWS / COLS)
  const tw = W / COLS; const th = H / ROWS

  return (
    <div style={{
      position: 'absolute', bottom: 8, right: 8,
      background: 'rgba(2,4,8,0.72)', borderRadius: '6px',
      border: '1px solid rgba(42,78,122,0.6)',
      padding: '4px', pointerEvents: 'none',
    }}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        {/* Raster andeuten */}
        {Array.from({ length: ROWS }).map((_, r) =>
          Array.from({ length: COLS }).map((__, c) => (
            <rect key={`${r}-${c}`}
              x={c * tw} y={r * th} width={tw - 0.5} height={th - 0.5}
              fill="rgba(255,255,255,0.02)" rx={0.5}
            />
          ))
        )}
        {/* Eigene Gebäude: Gold */}
        {entities.filter(e => e.profile_id === userId && e.tile_row != null).map(e => (
          <rect key={e.id}
            x={e.tile_col * tw + 1} y={e.tile_row * th + 1}
            width={tw - 2} height={th - 2}
            fill="#c9a961" rx={1}
          />
        ))}
        {/* Staatliche Gebäude: Blau */}
        {entities.filter(e => e.is_state_owned && e.tile_row != null).map(e => (
          <rect key={e.id}
            x={e.tile_col * tw + 1} y={e.tile_row * th + 1}
            width={tw - 2} height={th - 2}
            fill="#2a6ab5" rx={1}
          />
        ))}
        {/* Fremde Gebäude: Grau */}
        {entities.filter(e => !e.is_state_owned && e.profile_id && e.profile_id !== userId && e.tile_row != null).map(e => (
          <rect key={e.id}
            x={e.tile_col * tw + 1} y={e.tile_row * th + 1}
            width={tw - 2} height={th - 2}
            fill="#5a7a9a" rx={1}
          />
        ))}
        {/* Baustellen: Orange */}
        {pending.filter(p => p.tile_row != null).map((p, i) => (
          <rect key={i}
            x={p.tile_col * tw + 1} y={p.tile_row * th + 1}
            width={tw - 2} height={th - 2}
            fill="#d08020" rx={1}
          />
        ))}
      </svg>
      <div style={{ fontSize: '0.45rem', color: '#5a7a9a', textAlign: 'center', marginTop: '2px', letterSpacing: '0.5px' }}>
        🟡 eigen &nbsp; 🔵 staat &nbsp; 🟠 bau
      </div>
    </div>
  )
}

export default function ColonyGrid({
  slug, name, population, populationMax, isSupplied,
  userId, entities = [], pending = [], tax, entityInfo,
  locationResources = [], credits = 0,
  allLocations = [], cargo = {}, shipRange = 55, currentTick = 0, inTransit = false, onTravel, onOpenShipyard, onOpenWarehouse, onChanged,
}: ColonyGridProps) {
  const { loadFromServer, invalidate } = useGameStore()

  // Responsives Grid: Kachelgröße an Container anpassen
  React.useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      if (w > 0) {
        const size = Math.min(TILE_SIZE_MAX, Math.max(TILE_SIZE_MIN, Math.floor(w / COLS)))
        setTileSize(size)
      }
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])
  const [grid, setGrid]               = useState<string[][]>([])
  const [anomaly, setAnomaly]         = useState<{ r: number; c: number } | null>(null)
  const [selectedTile, setSelectedTile] = useState<{ r: number; c: number; type: string } | null>(null)
  const [showBuildPopup, setShowBuildPopup] = useState(false)
  const [showAdmin, setShowAdmin]           = useState(false)
  const [showSchool, setShowSchool]         = useState(false)
  const [showLanding, setShowLanding]       = useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [tileSize, setTileSize]             = useState(TILE_SIZE_MIN)
  const [showBank, setShowBank]             = useState(false)
  const [buildHover, setBuildHover]         = useState(false)
  const [hoveredTile, setHoveredTile]       = useState<TooltipInfo | null>(null)
  const hoverTimer                          = useRef<ReturnType<typeof setTimeout> | null>(null)
  const popPercent = Math.round((population / Math.max(1, populationMax)) * 100)
  const popColor = popPercent > 80
    ? 'linear-gradient(90deg, #e8702a, #e74c3c)'
    : popPercent > 60
      ? 'linear-gradient(90deg, #f5d742, #e8702a)'
      : isSupplied
        ? 'linear-gradient(90deg, #6fcf97, #27ae60)'
        : 'linear-gradient(90deg, #e74c3c, #c0392b)'

  useEffect(() => {
    const cellGrid = generateGrid(slug, population, entities, pending, userId)
    setGrid(gridTypes(cellGrid))
    setAnomaly(anomalyAt(cellGrid))
  }, [slug, population, populationMax, entities, pending])

  function entityAt(r: number, c: number): TileEntity | undefined {
    return entities.find(e =>
      e.tile_row === r && e.tile_col === c && e.entity_type === 'building'
    )
  }

  function sellingAt(r: number, c: number): boolean {
    return pending.some(p => p.tile_row === r && p.tile_col === c && p.status === 'selling')
  }

  function handleTileClick(r: number, c: number, tileType: string) {
    setSelectedTile({ r, c, type: tileType })
    const ent = entityAt(r, c)
    if (ent?.entity_id === 'admin')       { setShowAdmin(true);    return }
    if (ent?.entity_id === 'school')      { setShowSchool(true);   return }
    if (ent?.entity_id === 'bank')        { setShowBank(true);     return }
    if (ent?.entity_id === 'landing_pad') { setShowLanding(true);  return }
    if (ent?.entity_id === 'shipyard')    { onOpenShipyard?.();    return }
    if (ent?.entity_id === 'warehouse')   { onOpenWarehouse?.();   return }
    if (ent?.entity_id === 'market')      { onOpenWarehouse?.();   return }
    if (isBuildable(tileType)) setShowBuildPopup(true)
  }

  // Ladezustand
  if (grid.length === 0) return (
    <div style={{
      background: '#f4f2ed', borderRadius: '12px', padding: '2rem',
      display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: '#5a6878' }}>
        <div style={{
          width: '36px', height: '36px',
          border: '3px solid #2a4e7a', borderTopColor: '#b99b6b',
          borderRadius: '50%', animation: 'noxia-spin 1s linear infinite',
        }} />
        <div style={{ fontSize: '0.8rem' }}>Lade Kolonie …</div>
      </div>
    </div>
  )

  const selectedEntity = selectedTile ? entityAt(selectedTile.r, selectedTile.c) : undefined
  const ownSelected    = selectedEntity && selectedEntity.profile_id === userId
  const isAnomaly      = anomaly && selectedTile?.r === anomaly.r && selectedTile?.c === anomaly.c

  return (
    <div style={{ background: '#f4f2ed', borderRadius: '12px', padding: '1rem', boxShadow: '0 4px 8px rgba(0,0,0,0.08)' }}>
      <BuildingSpriteStyles />
      <style>{`
        @keyframes noxia-anomaly { 0%,100%{opacity:.45;transform:scale(0.85)} 50%{opacity:1;transform:scale(1.1)} }
        @keyframes noxia-spin    { to { transform: rotate(360deg) } }
      `}</style>

      {/* Landing-Overlay */}
      {showLanding && (
        <LandingOverlay
          currentLocation={slug}
          locations={allLocations}
          cargo={cargo}
          shipRange={shipRange}
          currentTick={currentTick}
          inTransit={inTransit}
          onTravel={(dest) => { onTravel?.(dest) }}
          onClose={() => { setShowLanding(false); setSelectedTile(null) }}
        />
      )}

      {/* Schul-Overlay */}
      {showSchool && (
        <SchoolOverlay
          locationSlug={slug}
          colonyContext={{
            locationName: name,
            population,
            waterStock:   (locationResources.find(r => r.resource === 'water')?.stock ?? 0),
            waterCons:    (locationResources.find(r => r.resource === 'water')?.consumption ?? Math.ceil(population / 100)),
            credits,
          }}
          onClose={() => { setShowSchool(false); setSelectedTile(null) }}
          onKnowledgeEarned={(pts, total) => {
            console.log(`+${pts} Wissenspunkte → ${total} gesamt`)
          }}
        />
      )}

      {/* Bank-Overlay */}
      {showBank && (
        <BankOverlay
          locationSlug={slug}
          locationName={name}
          credits={credits}
          onClose={() => { setShowBank(false); setSelectedTile(null) }}
          onCreditsChanged={() => { onChanged?.() }}
        />
      )}

      {/* Admin-Overlay */}
      {showAdmin && (
        <AdminOverlay
          locationSlug={slug}
          onClose={() => { setShowAdmin(false); setSelectedTile(null) }}
        />
      )}

      {/* Build-Popup */}
      {showBuildPopup && selectedTile && (
        <BuildPopup
          tileRow={selectedTile.r}
          tileCol={selectedTile.c}
          locationSlug={slug}
          onClose={() => { setShowBuildPopup(false); setSelectedTile(null) }}
          onBuildStarted={async () => { await loadFromServer(); invalidate('builds') }}
        />
      )}

      {/* Grid */}
      {/* Outer wrapper: containerRef misst die volle verfügbare Breite */}
      <div ref={containerRef} style={{ width: '100%' }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {hoveredTile && <TileTooltip info={hoveredTile} COLS={COLS} />}
          <GridMinimap
            COLS={COLS} ROWS={ROWS} tileSize={tileSize}
            entities={entities} pending={pending ?? []}
            userId={userId} slug={slug}
          />
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, ${tileSize}px)`,
            gap: 0,
            border: '2px solid #2a4e7a',
            borderRadius: '6px',
            overflow: 'hidden',
            width: `${COLS * tileSize}px`,
          }}>
        {grid.flatMap((row, r) =>
          row.map((tileType, c) => {
            const isSelected = selectedTile?.r === r && selectedTile?.c === c
            const canBuild   = isBuildable(tileType)
            const entity     = entityAt(r, c)
            const isOwn      = entity?.profile_id !== null && entity?.profile_id === userId
            const isSelling  = sellingAt(r, c)
            const isAnom     = anomaly?.r === r && anomaly?.c === c
            const isState    = entity?.is_state_owned || entity?.profile_id === null

            let ownerShadow = 'none'
            if (entity) {
              if (isState)      ownerShadow = 'inset 0 0 0 3px #5aaeff, 0 0 7px #5aaeff'
              else if (isOwn)   ownerShadow = 'inset 0 0 0 3px #c9a961, 0 0 7px rgba(201,169,97,0.7)'
              else              ownerShadow = 'inset 0 0 0 2px #e05050, 0 0 5px rgba(224,80,80,0.5)'
            }
            if (isSelected && !isState) {
              ownerShadow = 'inset 0 0 0 3px #c9a961, 0 0 12px #c9a961'
            }

            const interactive = canBuild || !!entity || isAnom

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => handleTileClick(r, c, tileType)}
                onMouseEnter={e => {
                  if (interactive) {
                    e.currentTarget.style.transform = 'scale(1.08)'
                    e.currentTarget.style.zIndex = '10'
                  }
                  if (hoverTimer.current) clearTimeout(hoverTimer.current)
                  // getBoundingClientRect SOFORT lesen — currentTarget ist nach setTimeout null
                  const tRect = e.currentTarget.getBoundingClientRect()
                  hoverTimer.current = setTimeout(() => {
                    setHoveredTile({
                      r, c,
                      x: tRect.right,
                      y: tRect.top,
                      entity:    entity ?? undefined,
                      isOwn, isState,
                      isSelling: sellingAt(r, c),
                      tileType,
                      eco:       entity ? entityInfo?.[entity.id] : undefined,
                    })
                  }, 280)
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.zIndex = '1'
                  if (hoverTimer.current) clearTimeout(hoverTimer.current)
                  setHoveredTile(null)
                }}
                style={{
                  position: 'relative',
                  width:    tileSize,
                  height:   tileSize,
                  cursor:   interactive ? 'pointer' : 'default',
                  boxShadow: ownerShadow,
                  boxSizing: 'border-box',
                  flexShrink: 0,
                  opacity:  isSelling ? 0.45 : 1,
                  filter:   isSelling ? 'grayscale(0.7)' : 'none',
                  transition: 'transform 0.15s ease, z-index 0s',
                }}
              >
                {(() => {
                  const npcEid = NPC_ENTITY[tileType]
                  const isBuildingTile =
                    npcEid !== undefined ||
                    (tileType.startsWith('building_') && tileType !== 'building_construction')
                  if (isBuildingTile) {
                    const eid = entity?.entity_id ?? npcEid ?? tileType.replace('building_', '')
                    return (
                      <BuildingSVG
                        entityId={eid}
                        planet={slug}
                        occupancy={populationMax > 0 ? population / populationMax : 0}
                        owned={false}
                        size={tileSize}
                      />
                    )
                  }
                  if (tileType.startsWith('road')) return <TileSVG type={tileType} planet={slug} />
                  return <TileDisplay tileType={tileType} slug={slug} />
                })()}
                {isAnom && (
                  <span style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                  }}>
                    <span style={{
                      width: '46%', height: '46%', borderRadius: '50%',
                      background: 'radial-gradient(circle, #c9a0f0 0%, #8a5bc0 55%, transparent 72%)',
                      boxShadow: '0 0 8px #b48ce8',
                      animation: 'noxia-anomaly 2.6s ease-in-out infinite',
                    }} />
                  </span>
                )}
              </div>
            )
          })
        )}
          </div>
        </div>


      </div>


    </div>
  )
}
