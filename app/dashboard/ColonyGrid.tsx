// app/dashboard/ColonyGrid.tsx
// Erstellt:     31.05.2026
// Aktualisiert: 21.06.2026 — TileTooltip: Hover-Info (Name, Eigentümer, Produktion)
//   21.06.2026 – showLanding State, onOpenShipyard/Warehouse/onChanged Props
//   15.06.2026 – Anomalie-Marker, BuildingSVG, Straßen
//   07.06.2026 – tile_entities, Eigentum, Gebäude-Verkauf, Steuer-Sidebar
// Version:      3.4.0
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
import { BUILDABLE_ITEMS, PLANNED_BUILDINGS } from '@/lib/game/config'
import { TileSVG } from '@/lib/grid/TileSVG'
import { BuildingSVG, BuildingSpriteStyles } from '@/lib/grid/BuildingSVG'
import { generateGrid, gridTypes, anomalyAt, isBuildable, NPC_ENTITY, COLS, ROWS } from '@/lib/grid/generateGrid'
import SellPanel from './SellPanel'
import AdminOverlay from './AdminOverlay'
import LandingOverlay from './LandingOverlay'
import SchoolOverlay from './SchoolOverlay'

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

const TILE_SIZE = 44

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

  const items = Object.entries(BUILDABLE_ITEMS)

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

      {PLANNED_BUILDINGS.length > 0 && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '0.6rem', color: '#5a6878', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            In Entwicklung
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {PLANNED_BUILDINGS.map(p => (
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

const BUILDING_NAMES: Record<string, string> = {
  mine: 'Mine', solar: 'Solarfeld', habitat: 'Habitat',
  scanner: 'Scanner', admin: 'Verwaltung',
  school: 'Akademie', ice_drill: 'Eisbohrung', water_recycler: 'Wasserrecycler',
  landing_pad: 'Landeplatz', shipyard: 'Werft',
}

const RES_DE: Record<string, string> = {
  metal: 'Metall', energy: 'Energie', water: 'Wasser',
}

// ── TileTooltip ──────────────────────────────────────────────────────────────
interface TooltipInfo {
  r: number; c: number
  x: number; y: number   // px relativ zum Grid-Container
  entity?:    TileEntity
  isOwn:      boolean
  isState:    boolean
  isSelling:  boolean
  tileType:   string
  eco?:       EntityEconomy
}

function TileTooltip({ info, COLS }: { info: TooltipInfo; COLS: number }) {
  const name = info.entity
    ? (BUILDING_NAMES[info.entity.entity_id] ?? info.entity.entity_id)
    : info.tileType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  const flipX = info.c >= COLS - 3
  const flipY = info.r >= 6

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
      position:      'absolute',
      left:          flipX ? undefined : info.x + 50,
      right:         flipX ? (COLS * 44 - info.x - 4) : undefined,
      top:           flipY ? undefined : info.y,
      bottom:        flipY ? (8 * 44 - info.y + 4) : undefined,
      zIndex:        100,
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

export default function ColonyGrid({
  slug, name, population, populationMax, isSupplied,
  userId, entities = [], pending = [], tax, entityInfo,
  locationResources = [], credits = 0,
  allLocations = [], cargo = {}, shipRange = 55, currentTick = 0, inTransit = false, onTravel, onOpenShipyard, onOpenWarehouse, onChanged,
}: ColonyGridProps) {
  const { loadFromServer, invalidate } = useGameStore()
  const [grid, setGrid]               = useState<string[][]>([])
  const [anomaly, setAnomaly]         = useState<{ r: number; c: number } | null>(null)
  const [selectedTile, setSelectedTile] = useState<{ r: number; c: number; type: string } | null>(null)
  const [showBuildPopup, setShowBuildPopup] = useState(false)
  const [showAdmin, setShowAdmin]           = useState(false)
  const [showSchool, setShowSchool]         = useState(false)
  const [showLanding, setShowLanding]       = useState(false)
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
    if (ent?.entity_id === 'landing_pad') { setShowLanding(true);  return }
    if (ent?.entity_id === 'shipyard')    { onOpenShipyard?.();    return }
    if (isBuildable(tileType)) setShowBuildPopup(true)
  }

  // Ladezustand
  if (grid.length === 0) return (
    <div style={{
      background: '#1a2a3a', borderRadius: '12px', padding: '2rem',
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
    <div style={{ background: '#1a2a3a', borderRadius: '12px', padding: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
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

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b99b6b', textTransform: 'uppercase', letterSpacing: '3px' }}>{name}</div>
          <div style={{ fontSize: '0.55rem', color: '#8a9ab0', marginTop: '2px' }}>{slug.toUpperCase()} SECTOR</div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.3)', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.65rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#8a9ab0', fontSize: '0.5rem' }}>POP</div>
            <div style={{ color: '#fff', fontWeight: 700 }}>{population.toLocaleString('de')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#8a9ab0', fontSize: '0.5rem' }}>AUSLASTUNG</div>
            <div style={{ color: popPercent > 80 ? '#e8702a' : '#6fcf97', fontWeight: 700 }}>{popPercent}%</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#8a9ab0', fontSize: '0.5rem' }}>STATUS</div>
            <div style={{ color: isSupplied ? '#6fcf97' : '#e74c3c', fontWeight: 700 }}>{isSupplied ? '🟢' : '🔴'}</div>
          </div>
        </div>
      </div>

      {/* Grid links · Info-Sidebar rechts */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>

        {/* Kachelgrid */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {hoveredTile && <TileTooltip info={hoveredTile} COLS={COLS} />}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, ${TILE_SIZE}px)`,
            gap: 0,
            border: '2px solid #2a4e7a',
            borderRadius: '6px',
            overflow: 'hidden',
            width: `${COLS * TILE_SIZE}px`,
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
                  hoverTimer.current = setTimeout(() => {
                    const gridEl = e.currentTarget.parentElement?.parentElement
                    const rect   = gridEl?.getBoundingClientRect()
                    const tRect  = e.currentTarget.getBoundingClientRect()
                    const x = rect ? tRect.left - rect.left : c * 44
                    const y = rect ? tRect.top  - rect.top  : r * 44
                    setHoveredTile({
                      r, c, x, y,
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
                  width:    TILE_SIZE,
                  height:   TILE_SIZE,
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
                        size={TILE_SIZE}
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

        {/* Info-Sidebar rechts neben dem Grid */}
        <div style={{
          flex: 1, minWidth: '240px', alignSelf: 'stretch',
          padding: '0.85rem 1rem',
          background: 'rgba(0,0,0,0.3)', borderRadius: '6px',
          fontSize: '0.75rem',
        }}>
          {!selectedTile || showBuildPopup ? (
            /* EmptyState */
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              height: '100%', minHeight: '180px',
              color: '#5a6878', textAlign: 'center', gap: '0.5rem',
            }}>
              <div style={{ fontSize: '2rem', opacity: 0.25 }}>🏗️</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 500 }}>Kachel anklicken</div>
              <div style={{ fontSize: '0.6rem', maxWidth: '180px', lineHeight: 1.6, opacity: 0.7 }}>
                Eigene Gebäude (Goldrand) lassen sich hier bewerten und verkaufen.
              </div>
            </div>
          ) : (
            <>
              {/* Titel + Close */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <div style={{ color: isAnomaly ? '#b48ce8' : '#b99b6b', fontWeight: 700, fontSize: '0.85rem' }}>
                    {isAnomaly
                      ? '✨ Anomalie'
                      : selectedEntity
                        ? (BUILDING_NAMES[selectedEntity.entity_id] ?? selectedEntity.entity_id)
                        : selectedTile.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  <div style={{ color: '#8a9ab0', marginTop: '0.2rem', fontSize: '0.68rem' }}>
                    {isAnomaly
                      ? 'Unbekanntes Phänomen'
                      : selectedEntity
                        ? (ownSelected ? '🔑 Dein Gebäude' : `👤 ${selectedEntity.username ?? 'Anderer Pilot'}`)
                        : sellingAt(selectedTile.r, selectedTile.c)
                          ? '💰 Wird verkauft …'
                          : isBuildable(selectedTile.type) ? '✅ Bebaubar' : '🚫 Nicht bebaubar'}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTile(null)}
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '0.7rem', flexShrink: 0 }}
                >✕</button>
              </div>

              {/* Koordinaten */}
              <div style={{
                fontSize: '0.58rem', color: '#5a6878',
                background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.5rem',
                borderRadius: '4px', display: 'inline-block', marginBottom: '0.6rem',
              }}>
                📍 Kachel ({selectedTile.r}, {selectedTile.c})
              </div>

              {/* Bauen-Button */}
              {isBuildable(selectedTile.type) && !selectedEntity && (
                <button
                  onClick={() => setShowBuildPopup(true)}
                  onMouseEnter={() => setBuildHover(true)}
                  onMouseLeave={() => setBuildHover(false)}
                  style={{
                    marginTop: '0.25rem', marginBottom: '0.5rem',
                    width: '100%',
                    background: buildHover
                      ? 'linear-gradient(135deg, #3a5e8a, #2a4a6a)'
                      : 'linear-gradient(135deg, #2a4e7a, #1a3a5a)',
                    color: '#fff', border: 'none',
                    padding: '0.6rem 0.75rem', borderRadius: '6px',
                    fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                    boxShadow: buildHover
                      ? '0 4px 12px rgba(42,78,122,0.45)'
                      : '0 2px 8px rgba(42,78,122,0.3)',
                    transform: buildHover ? 'translateY(-1px)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  🏗️ Gebäude bauen
                </button>
              )}

              {/* Wirtschaftsdaten eigenes Gebäude */}
              {ownSelected && selectedEntity && (() => {
                const eco     = entityInfo?.[selectedEntity.id]
                const taxProp = tax?.tax_property ?? 0
                const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0.35rem', borderRadius: '4px', marginBottom: '2px' }
                return (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.7rem', lineHeight: 1.7 }}>
                    <div style={{ fontSize: '0.58rem', color: '#5a6878', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem' }}>
                      📊 Wirtschaft
                    </div>
                    {eco?.produktion != null && eco.ressource && (
                      <div style={{ ...row, background: 'rgba(47,158,68,0.06)' }}>
                        <span style={{ color: '#8a9ab0' }}>Produktion</span>
                        <span style={{ color: '#6fcf97', fontWeight: 500 }}>+{eco.produktion} {RES_DE[eco.ressource] ?? eco.ressource}/Tick</span>
                      </div>
                    )}
                    <div style={{ ...row, background: taxProp > 0 ? 'rgba(232,112,42,0.06)' : 'transparent' }}>
                      <span style={{ color: '#8a9ab0' }}>Haltekosten</span>
                      <span style={{ color: taxProp > 0 ? '#e8702a' : '#5a6878', fontWeight: taxProp > 0 ? 500 : 400 }}>
                        {taxProp > 0 ? `−${taxProp.toLocaleString('de-DE')} Cr/Tick` : 'keine'}
                      </span>
                    </div>
                    {taxProp > 0 && (
                      <div style={{ color: '#5a6878', fontSize: '0.58rem', marginTop: '3px', lineHeight: 1.4, padding: '0.15rem 0.35rem' }}>
                        Grundsteuer dieser Kolonie · fällt an, solange du das Gebäude hältst
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Verkaufs-UI für eigene Gebäude */}
              {ownSelected && (
                <SellPanel
                  key={selectedEntity!.id}
                  entityId={selectedEntity!.id}
                  entityName={BUILDING_NAMES[selectedEntity!.entity_id] ?? selectedEntity!.entity_id}
                  onSold={async () => { await loadFromServer(); invalidate('builds') }}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Bevölkerungsbalken */}
      <div style={{ marginTop: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: '#5a6878', marginBottom: '0.3rem' }}>
          <span>Bevölkerung</span>
          <span>{population.toLocaleString('de')} / {populationMax.toLocaleString('de')} · {popPercent}% Auslastung</span>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.35)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{
            width: `${popPercent}%`, height: '100%',
            background: popColor,
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            borderRadius: '3px',
          }} />
        </div>
      </div>
    </div>
  )
}
