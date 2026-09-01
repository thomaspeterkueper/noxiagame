'use client'

// app/dashboard/ColonyGrid.tsx
// Erstellt:     31.05.2026
// Aktualisiert: 01.09.2026 — Raster-Tiles folgen der kanonischen 64px Gridgröße
// Version:      5.24.1

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useGameStore } from '@/lib/store/gameStore'
import { BUILDINGS } from '@/lib/game/buildings/index'
import { TileSVG } from '@/lib/grid/TileSVG'
import { BuildingSVG, BuildingSpriteStyles } from '@/lib/grid/BuildingSVG'
import { generateGrid, gridTypes, anomalyAt, isBuildable, NPC_ENTITY } from '@/lib/grid/generateGrid'
import SellPanel from './SellPanel'
import BuildingOverlay from '@/components/game/BuildingOverlay'
import { buildOverlayForBuilding } from '@/lib/game/buildings/overlays'
import type { BuildingContext } from '@/lib/game/buildings/types'
import AdminOverlay from './AdminOverlay'
import LandingOverlay from './LandingOverlay'
import SchoolOverlay from './SchoolOverlay'
import WalkableColony from './WalkableColony'
import BuildingInterior from './BuildingInterior'
import BankOverlay from './BankOverlay'

function TileDisplay({ tileType, slug, size }: { tileType: string; slug: string; size: number }) {
  const [src, setSrc] = useState(`/images/grid/${slug}/${tileType}.webp`)
  const [useSVG, setUseSVG] = useState(false)
  if (useSVG) return <TileSVG type={tileType} planet={slug} />
  return (
    <img
      src={src}
      width={size}
      height={size}
      style={{ display: 'block', width: size, height: size, objectFit: 'cover' }}
      onError={() => {
        if (src.endsWith('.webp')) setSrc(`/images/grid/${slug}/${tileType}.png`)
        else setUseSVG(true)
      }}
    />
  )
}

const WORLD_COLS = 32
const WORLD_ROWS = 24
const COLS = WORLD_COLS
const ROWS = WORLD_ROWS
const TILE_SIZE = 64
const RES_DE: Record<string, string> = { metal: 'Metall', energy: 'Energie', water: 'Wasser' }

export interface TileEntity {
  id: string; profile_id: string | null; is_state_owned?: boolean
  actor_id?: string | null; owner_class?: string; owner_id?: string
  entity_type: string; entity_id: string; tile_level: number
  tile_row: number; tile_col: number; username?: string
  asking_price?: number | null
  lease_price?:   number | null
  occupant_id?:   string | null
  actor_name?:    string | null
}
export interface PendingBuild {
  buildable_id: string; tile_row: number; tile_col: number; status: string
}
export interface EntityEconomy {
  ertragswert: number; produktion: number | null
  ressource: string | null; resourceSellPrice: number | null
}
export interface ColonyTax {
  tax_property: number; tax_transaction: number; tax_landing: number
}
interface ColonyGridProps {
  slug: string; name: string; population: number; populationMax: number
  isSupplied: boolean; userId: string; entities?: TileEntity[]
  pending?: PendingBuild[]; tax?: ColonyTax
  entityInfo?: Record<string, EntityEconomy>
  locationResources?: { resource: string; stock: number; consumption: number }[]
  credits?: number
  allLocations?: { slug: string; name: string; population: number }[]
  cargo?: Record<string, number>; shipRange?: number; currentTick?: number
  inTransit?: boolean; onTravel?: (dest: string) => void
  gates?:           Record<string, boolean>
  onOpenShipyard?: () => void; onOpenWarehouse?: () => void; onChanged?: () => void
  onInteriorAction?: (kind: 'market'|'shipyard'|'navigation'|'ship'|'parts'|null) => void
  tileSize?: number
  highlightEntityIds?: string[]
}
interface TooltipInfo {
  r: number; c: number; x: number; y: number
  entity?: TileEntity; isOwn: boolean; isState: boolean; isCorp: boolean
  isSelling: boolean; tileType: string; eco?: EntityEconomy
}

type BuildOption = {
  key: string
  name: string
  cost: number
  displayCost?: number
  buildTimeTicks: number
  populationBonus?: number
  production?: { resource: string; amount: number }[]
  allowedLocations?: string[] | null
  knowledgeLocked?: boolean
  siteBlocked?: boolean
  requiredUnlock?: string | null
  requiredLabel?: string | null
  learningUrl?: string | null
}

const TileTooltip = React.memo(function TileTooltip({ info }: { info: TooltipInfo }) {
  const name = info.entity
    ? (BUILDINGS[info.entity.entity_id]?.name ?? info.entity.entity_id)
    : info.tileType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080
  const TW = 210; const TH = 160
  const flipX = info.x + TW > vw - 20
  const flipY = info.y + TH > vh - 20

  const borderColor = info.isOwn ? 'rgba(201,169,97,0.65)'
    : info.isState ? 'rgba(90,174,255,0.5)'
    : info.entity ? 'rgba(224,80,80,0.45)' : 'rgba(42,78,122,0.35)'
  const nameColor = info.isOwn ? '#8a6a00'
    : info.isState ? '#1a4e8a' : info.entity ? '#b52a2a' : '#2a4e7a'

  return (
    <div style={{
      position: 'fixed',
      left: flipX ? undefined : info.x + 6,
      right: flipX ? `calc(100vw - ${info.x}px + 6px)` : undefined,
      top: flipY ? undefined : info.y,
      bottom: flipY ? `calc(100vh - ${info.y}px)` : undefined,
      zIndex: 9999, background: '#f8f5ee',
      border: `1px solid ${borderColor}`, borderRadius: '7px',
      padding: '8px 11px', minWidth: '150px', maxWidth: `${TW}px`,
      boxShadow: '0 4px 20px rgba(0,0,0,0.18)', pointerEvents: 'none',
      fontFamily: "'Courier Prime', monospace",
    }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: nameColor, marginBottom: '4px' }}>{name}</div>
      {info.entity && (
        <div style={{ fontSize: '0.65rem', color: '#5a6a7a', marginBottom: '3px' }}>
          {info.isOwn ? '🔑 Dein Gebäude' : info.isState ? '🏛 Staatlich' : `👤 ${ (info.entity as any).actor_name ?? info.entity.username ?? 'Anderer Pilot'}`}
          {info.isSelling && <span style={{ color: '#e8702a', marginLeft: '6px' }}>· wird verkauft</span>}
        </div>
      )}
      {info.isOwn && info.eco?.produktion != null && info.eco.ressource && (
        <>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
          <div style={{ fontSize: '0.68rem', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <span style={{ color: '#5a7a8a' }}>Produktion</span>
            <span style={{ color: '#6fcf97' }}>+{info.eco.produktion} {RES_DE[info.eco.ressource] ?? info.eco.ressource}/Tick</span>
          </div>
        </>
      )}
      {!info.entity && (
        <div style={{ fontSize: '0.65rem', color: '#3a5a6a', marginTop: '2px' }}>
          {isBuildable(info.tileType) ? '✅ Bebaubar' : info.tileType.replace(/_/g, ' ')}
        </div>
      )}
      {info.entity && (
        <div style={{ fontSize: '0.58rem', color: '#3a5a7a', marginTop: '5px' }}>
          {info.isOwn ? 'Klicken für Details & Verkauf' : info.isState ? '🏛 Staatlich — nicht bebaubar' : info.isCorp ? '🏢 Corporation — nicht bebaubar' : `👤 ${info.entity?.username ?? 'Anderer Spieler'} — nicht bebaubar`}
        </div>
      )}
    </div>
  )
})

const GridMinimap = React.memo(function GridMinimap({
  COLS, ROWS, entities, pending, userId,
}: { COLS: number; ROWS: number; entities: TileEntity[]; pending: PendingBuild[]; userId: string }) {
  const W = 120; const H = Math.round(W * ROWS / COLS)
  const tw = W / COLS; const th = H / ROWS
  return (
    <div style={{ background: 'rgba(2,4,8,0.72)', borderRadius: '8px', border: '1px solid rgba(42,78,122,0.6)', padding: '6px', pointerEvents: 'none' }}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        {Array.from({ length: ROWS }).flatMap((_, r) => Array.from({ length: COLS }).map((__, c) => (
          <rect key={`bg-${r}-${c}`} x={c * tw} y={r * th} width={tw - 0.5} height={th - 0.5} fill="rgba(255,255,255,0.02)" rx={0.5} />
        )))}
        {entities.filter(e => e.profile_id === userId && e.tile_row != null).map(e => (
          <rect key={`own-${e.id}`} x={e.tile_col * tw + 1} y={e.tile_row * th + 1} width={tw - 2} height={th - 2} fill="#c9a961" rx={1} />
        ))}
        {entities.filter(e => e.is_state_owned && e.tile_row != null).map(e => (
          <rect key={`state-${e.id}`} x={e.tile_col * tw + 1} y={e.tile_row * th + 1} width={tw - 2} height={th - 2} fill="#2a6ab5" rx={1} />
        ))}
        {entities.filter(e => !e.is_state_owned && e.profile_id && e.profile_id !== userId && e.tile_row != null).map(e => (
          <rect key={`other-${e.id}`} x={e.tile_col * tw + 1} y={e.tile_row * th + 1} width={tw - 2} height={th - 2} fill="#5a7a9a" rx={1} />
        ))}
        {pending.filter(p => p.tile_row != null).map((p, i) => (
          <rect key={`pend-${i}`} x={p.tile_col * tw + 1} y={p.tile_row * th + 1} width={tw - 2} height={th - 2} fill="#d08020" rx={1} />
        ))}
      </svg>
      <div style={{ fontSize: '0.45rem', color: '#5a7a9a', textAlign: 'center', marginTop: '2px', letterSpacing: '0.5px' }}>
        🟡 eigen &nbsp; 🔵 staat &nbsp; 🟠 bau
      </div>
    </div>
  )
})

function BuildPopup({ tileRow, tileCol, tileType, locationSlug, onClose, onBuildStarted, journeyBuildHints = [] }: {
  tileRow: number; tileCol: number; tileType: string; locationSlug: string
  onClose: () => void; onBuildStarted: (newCredits?: number) => void
  journeyBuildHints?: string[]
}) {
  const { credits } = useGameStore()
  const [building, setBuilding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [items, setItems] = useState<BuildOption[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadOptions() {
      setLoading(true); setMsg(null)
      try {
        const sb = (await import('@/lib/supabase/client')).createClient()
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { if (!cancelled) setMsg('Bitte melde dich erneut an.'); return }
        const qs = new URLSearchParams({
          location: locationSlug,
          tileRow: String(tileRow),
          tileCol: String(tileCol),
          tileType,
        })
        const res = await fetch(`/api/game/build/options?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await res.json()
        if (!res.ok || data.error) { if (!cancelled) setMsg(data.error ?? 'Bauoptionen konnten nicht geladen werden.'); return }
        if (!cancelled) setItems(Array.isArray(data.buildable) ? data.buildable : [])
      } catch {
        if (!cancelled) setMsg('Netzwerkfehler. Bitte erneut versuchen.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadOptions()
    return () => { cancelled = true }
  }, [locationSlug, tileRow, tileCol, tileType])

  async function startBuild(buildableId: string) {
    setBuilding(true); setMsg(null)
    try {
      const sb = (await import('@/lib/supabase/client')).createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { setMsg('Bitte melde dich erneut an.'); return }
      const res = await fetch(
        `/api/game/build?action=start&buildableId=${encodeURIComponent(buildableId)}&location=${encodeURIComponent(locationSlug)}&tileRow=${tileRow}&tileCol=${tileCol}&tileLevel=0`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      )
      const data = await res.json()
      if (!res.ok || data.error) { setMsg(data.error ?? 'Bau konnte nicht gestartet werden.'); return }
      onBuildStarted(data.newCredits ?? data.credits ?? credits); onClose()
    } catch { setMsg('Netzwerkfehler. Bitte erneut versuchen.') }
    finally { setBuilding(false) }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 2200, background: 'rgba(2,4,8,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: 'min(700px, 95vw)', maxHeight: '88vh', background: '#f8f5ee', border: '1px solid #ddd6c8', borderRadius: '12px', boxShadow: '0 12px 48px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', padding: '1rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ color: '#2a4e7a', fontWeight: 700, fontSize: '0.85rem' }}>🏗️ Gebäude bauen — Kachel ({tileRow}, {tileCol})</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ fontSize: '0.62rem', color: '#6b6357', marginBottom: '0.6rem' }}>Standort: {locationSlug} · Feld: {tileType.replace(/_/g, ' ')}</div>
        {msg && <div style={{ fontSize: '0.68rem', color: '#b52a2a', marginBottom: '0.55rem' }}>{msg}</div>}
        <div style={{ overflowY: 'auto', display: 'grid', gap: '0.55rem' }}>
          {loading && <div style={{ color: '#5a6878', fontSize: '0.72rem' }}>Lade Bauoptionen …</div>}
          {!loading && items.length === 0 && !msg && <div style={{ color: '#5a6878', fontSize: '0.72rem' }}>Keine Gebäude für dieses Feld verfügbar.</div>}
          {items.map(item => {
            const knowledgeLocked = !!item.knowledgeLocked
            const blocked = knowledgeLocked || !!item.siteBlocked
            const prodText = item.production?.map(p => `+${p.amount} ${RES_DE[p.resource] ?? p.resource}/Tick`).join(' · ')
            return (
              <div key={item.key} style={{ border: '1px solid #ddd6c8', borderRadius: 8, padding: '0.7rem', background: blocked ? '#efebe2' : '#fffdf8' }}>
                <button disabled={blocked || building} onClick={() => startBuild(item.key)} style={{ width: '100%', textAlign: 'left', border: 0, background: 'transparent', cursor: blocked ? 'not-allowed' : 'pointer', padding: 0, opacity: blocked ? 0.68 : 1 }}>
                  <div style={{ fontWeight: 700, color: '#2a4e7a', fontSize: '0.75rem' }}>{item.name}</div>
                  <div style={{ marginTop: '0.25rem', color: '#6b6357', fontSize: '0.64rem' }}>
                    {item.displayCost ?? item.cost} cr · {item.buildTimeTicks} Ticks
                    {prodText && ` · ${prodText}`}
                    {!!item.populationBonus && ` · +${item.populationBonus} Kapazität`}
                  </div>
                </button>
                {knowledgeLocked && item.learningUrl && (
                  <a href={item.learningUrl} style={{ display: 'inline-block', marginTop: '0.45rem', color: '#8a6a00', fontSize: '0.7rem', fontWeight: 700, textDecoration: 'none' }}>
                    Jetzt lernen →
                  </a>
                )}
                {knowledgeLocked && item.requiredLabel && (
                  <div style={{ marginTop: '0.2rem', color: '#6b6357', fontSize: '0.62rem' }}>Benötigt: {item.requiredLabel}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function ColonyGrid({
  slug, name, population, populationMax, isSupplied,
  userId, entities = [], pending = [], tax, entityInfo,
  locationResources = [], credits = 0, highlightEntityIds = [] as string[],
  allLocations = [], cargo = {}, shipRange = 55, currentTick = 0,
  inTransit = false, onTravel, onOpenShipyard, onOpenWarehouse, onChanged, onInteriorAction, tileSize: externalTileSize, gates = {},
}: ColonyGridProps) {
  const { loadFromServer, invalidate } = useGameStore()
  const [grid, setGrid] = useState<string[][]>([])
  const [anomaly, setAnomaly] = useState<{ r: number; c: number } | null>(null)
  const [selectedTile, setSelectedTile] = useState<{ r: number; c: number; type: string } | null>(null)
  const [showBuildPopup, setShowBuildPopup] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showSchool, setShowSchool] = useState(false)
  const [showLanding, setShowLanding] = useState(false)
  const [showSellPanel, setShowSellPanel] = useState(false)
  const [showBuildingOverlay, setShowBuildingOverlay] = useState(false)
  const [showBank, setShowBank] = useState(false)
  const [showWalking, setShowWalking]     = useState(false)
  const [interiorEntity, setInteriorEntity] = useState<TileEntity | null>(null)
  const [zoom, setZoom]               = useState(1.0)
  const gridScrollRef                 = useRef<HTMLDivElement>(null)
  const isPanning                     = useRef(false)
  const panStart                      = useRef({ x: 0, y: 0, scrollX: 0, scrollY: 0 })

  useEffect(() => {
    const el = gridScrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom(z => Math.min(2.0, Math.max(0.3, +(z - e.deltaY * 0.001).toFixed(2))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button,a,input,select')) return
    isPanning.current = false
    panStart.current = {
      x: e.clientX, y: e.clientY,
      scrollX: e.currentTarget.scrollLeft,
      scrollY: e.currentTarget.scrollTop,
    }
    e.currentTarget.dataset.panPending = '1'
  }

  const handlePanMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (!el.dataset.panPending && !isPanning.current) return
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    if (el.dataset.panPending && Math.abs(dx) + Math.abs(dy) < 4) return
    if (el.dataset.panPending) {
      delete el.dataset.panPending
      isPanning.current = true
      el.style.cursor = 'grabbing'
    }
    if (isPanning.current) {
      el.scrollLeft = panStart.current.scrollX - dx
      el.scrollTop  = panStart.current.scrollY - dy
    }
  }

  const handlePanEnd = (e: React.MouseEvent<HTMLDivElement>) => {
    delete e.currentTarget.dataset.panPending
    if (!isPanning.current) return
    isPanning.current = false
    e.currentTarget.style.cursor = 'grab'
  }

  const [hoveredTile, setHoveredTile] = useState<TooltipInfo | null>(null)
  const tileSize = externalTileSize ?? TILE_SIZE
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const cellGrid = generateGrid(slug, population, entities, pending, userId, WORLD_COLS, WORLD_ROWS)
    setGrid(gridTypes(cellGrid))
    setAnomaly(anomalyAt(cellGrid))
  }, [slug, population, populationMax, entities, pending, userId])

  const entityMap = useMemo(() => {
    const map = new Map<string, TileEntity>()
    entities.forEach(e => {
      if (e.tile_row != null && e.tile_col != null && e.entity_type === 'building') map.set(`${e.tile_row},${e.tile_col}`, e)
    })
    return map
  }, [entities])

  const sellingMap = useMemo(() => {
    const map = new Map<string, boolean>()
    pending.forEach(p => {
      if (p.tile_row != null && p.tile_col != null && p.status === 'selling') map.set(`${p.tile_row},${p.tile_col}`, true)
    })
    return map
  }, [pending])

  const entityAt = useCallback((r: number, c: number) => entityMap.get(`${r},${c}`), [entityMap])
  const sellingAt = useCallback((r: number, c: number) => sellingMap.get(`${r},${c}`) ?? false, [sellingMap])

  const handleTileClick = useCallback((r: number, c: number, tileType: string) => {
    setSelectedTile({ r, c, type: tileType })
    const ent = entityAt(r, c)
    if (ent?.entity_id === 'admin') { setShowAdmin(true); return }
    if (ent?.entity_id === 'school') { setShowSchool(true); return }
    if (ent?.entity_id === 'bank') { setShowBank(true); return }
    if (ent?.entity_id === 'landing_pad') { setShowLanding(true); return }
    if (ent?.entity_id === 'shipyard') { onOpenShipyard?.(); return }
    if (ent?.entity_id === 'warehouse') { onOpenWarehouse?.(); return }
    if (ent?.entity_id === 'market') { onOpenWarehouse?.(); return }
    const overlayBuildings = ['mine', 'solar', 'habitat', 'ice_drill', 'water_recycler', 'scanner']
    if (ent && overlayBuildings.includes(ent.entity_id)) { setShowBuildingOverlay(true); return }
    if (ent && ent.profile_id === userId) { setShowSellPanel(true); return }
    if (ent) return
    if (isBuildable(tileType)) { setShowBuildPopup(true); return }
  }, [entityAt, onOpenShipyard, onOpenWarehouse, userId])

  const gridElements = useMemo(() => {
    if (grid.length === 0) return null
    return grid.flatMap((row, r) => row.map((tileType, c) => {
      const isSelected = selectedTile?.r === r && selectedTile?.c === c
      const canBuild = isBuildable(tileType)
      const entity = entityAt(r, c)
      const isOwn = !!entity?.profile_id && entity.profile_id === userId
      const isSelling = sellingAt(r, c)
      const isAnom = anomaly?.r === r && anomaly?.c === c
      const isHint = !!entity && highlightEntityIds.includes(entity.entity_id)
      const isNPC   = !!entity?.actor_id
      const isState = entity?.owner_class === 'STATE'
      const isCorp  = false
      const interactive = canBuild || !!entity || isAnom
      let ownerShadow = 'none'
      if (entity) {
        if (isState) ownerShadow = 'inset 0 0 0 2px #5aaeff, 0 0 5px rgba(90,174,255,0.55)'
        else if (isOwn) ownerShadow = 'inset 0 0 0 2px #c9a961, 0 0 5px rgba(201,169,97,0.55)'
        else ownerShadow = 'inset 0 0 0 2px #e05050, 0 0 4px rgba(224,80,80,0.45)'
      }
      if (isSelected && !isState) ownerShadow = 'inset 0 0 0 2px #c9a961, 0 0 8px #c9a961'

      return (
        <div key={`${r}-${c}`}
          onClick={() => handleTileClick(r, c, tileType)}
          onMouseEnter={e => {
            if (interactive) { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.zIndex = '10' }
            if (hoverTimer.current) clearTimeout(hoverTimer.current)
            const tRect = e.currentTarget.getBoundingClientRect()
            hoverTimer.current = setTimeout(() => {
              setHoveredTile({ r, c, x: tRect.right, y: tRect.top, entity: entity ?? undefined, isOwn, isState, isCorp, isSelling: sellingAt(r, c), tileType, eco: entity ? entityInfo?.[entity.id] : undefined })
            }, 280)
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = '1'
            if (hoverTimer.current) clearTimeout(hoverTimer.current)
            setHoveredTile(null)
          }}
          style={{ position: 'relative', width: tileSize, height: tileSize, cursor: interactive ? 'pointer' : 'default', boxShadow: ownerShadow, boxSizing: 'border-box', flexShrink: 0, opacity: isSelling ? 0.45 : 1, filter: isSelling ? 'grayscale(0.7)' : 'none', transition: 'transform 0.15s ease, z-index 0s' }}
        >
          {(() => {
            // Persistente Straßen-Infrastruktur (entity_id='road', STATE) wird als
            // Fahrweg-Tile gezeichnet, nicht als Gebäude (ADR-strassen-infrastruktur).
            if (entity?.entity_id && entity.entity_id !== 'road') return <BuildingSVG entityId={entity.entity_id} planet={slug} occupancy={populationMax > 0 ? population / populationMax : 0} owned={isOwn} size={tileSize} />
            const npcEid = NPC_ENTITY[tileType]
            if (npcEid) return <BuildingSVG entityId={npcEid} planet={slug} occupancy={populationMax > 0 ? population / populationMax : 0} owned={false} size={tileSize} />
            if (tileType.startsWith('building_') && tileType !== 'building_construction') return <BuildingSVG entityId={tileType.replace('building_', '')} planet={slug} occupancy={populationMax > 0 ? population / populationMax : 0} owned={false} size={tileSize} />
            if (tileType.startsWith('road')) return <TileSVG type={tileType} planet={slug} />
            return <TileDisplay tileType={tileType} slug={slug} size={tileSize} />
          })()}
          {isAnom && (
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ width: '46%', height: '46%', borderRadius: '50%', background: 'radial-gradient(circle, #c9a0f0 0%, #8a5bc0 55%, transparent 72%)', boxShadow: '0 0 8px #b48ce8', animation: 'noxia-anomaly 2.6s ease-in-out infinite' }} />
            </span>
          )}
          {isHint && (
            <span style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ position: 'absolute', inset: 2, borderRadius: 4, border: '2px solid #c9a961', boxShadow: '0 0 10px rgba(201,169,97,0.8), inset 0 0 6px rgba(201,169,97,0.2)', animation: 'noxia-hint 1.8s ease-in-out infinite' }} />
              <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#c9a961', background: 'rgba(0,0,0,0.7)', borderRadius: 3, padding: '1px 4px', letterSpacing: '0.05em', lineHeight: 1.2, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>TAP</span>
            </span>
          )}
        </div>
      )
    }))
  }, [grid, selectedTile, entities, pending, anomaly, userId, entityInfo, handleTileClick, entityAt, sellingAt, slug, population, populationMax, tileSize, highlightEntityIds])

  if (grid.length === 0) return (
    <div style={{ background: '#f4f2ed', borderRadius: '12px', padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: '#5a6878' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid #2a4e7a', borderTopColor: '#b99b6b', borderRadius: '50%', animation: 'noxia-spin 1s linear infinite' }} />
        <div style={{ fontSize: '0.8rem' }}>Lade Kolonie …</div>
      </div>
    </div>
  )

  const selectedEnt = selectedTile ? entityAt(selectedTile.r, selectedTile.c) : null
  const canSellSelected = !!selectedEnt && selectedEnt.profile_id === userId && !selectedEnt.is_state_owned
  const openSellForSelected = () => {
    setShowLanding(false); setShowSchool(false); setShowBank(false); setShowAdmin(false)
    setShowSellPanel(true)
  }

  return (
    <div style={{ background: '#f4f2ed', borderRadius: '12px', padding: '1rem', boxShadow: '0 4px 8px rgba(0,0,0,0.08)' }}>
      <BuildingSpriteStyles />
      <style>{`@keyframes noxia-anomaly { 0%,100%{opacity:.45;transform:scale(0.85)} 50%{opacity:1;transform:scale(1.1)} } @keyframes noxia-spin { to { transform: rotate(360deg) } } @keyframes noxia-hint { 0%,100%{opacity:.5;box-shadow:0 0 6px rgba(201,169,97,0.5)} 50%{opacity:1;box-shadow:0 0 16px rgba(201,169,97,0.95)} }`}</style>

      {showLanding && <LandingOverlay currentLocation={slug} locations={allLocations} cargo={cargo} shipRange={shipRange} currentTick={currentTick} inTransit={inTransit} onTravel={dest => onTravel?.(dest)} onClose={() => { setShowLanding(false); setSelectedTile(null) }} canSell={canSellSelected} onSellClick={openSellForSelected} />}
      {showSchool && <SchoolOverlay locationSlug={slug} colonyContext={{ locationName: name, population, waterStock: locationResources.find(r => r.resource === 'water')?.stock ?? 0, waterCons: locationResources.find(r => r.resource === 'water')?.consumption ?? Math.ceil(population / 100), credits }} onClose={() => { setShowSchool(false); setSelectedTile(null) }} onKnowledgeEarned={(pts: number, total: number) => console.log(`+${pts} Wissenspunkte → ${total}`)} canSell={canSellSelected} onSellClick={openSellForSelected} />}
      {showBank && <BankOverlay locationSlug={slug} locationName={name} credits={credits} onClose={() => { setShowBank(false); setSelectedTile(null) }} onCreditsChanged={() => onChanged?.()} canSell={canSellSelected} onSellClick={openSellForSelected} />}
      {showAdmin && <AdminOverlay locationSlug={slug} locationName={name} userId={userId} onClose={() => { setShowAdmin(false); setSelectedTile(null) }} canSell={canSellSelected} onSellClick={openSellForSelected} />}
      {showBuildPopup && selectedTile && <BuildPopup tileRow={selectedTile.r} tileCol={selectedTile.c} tileType={selectedTile.type} locationSlug={slug} onClose={() => setShowBuildPopup(false)} onBuildStarted={() => { invalidate(); loadFromServer(); onChanged?.() }} />}
      {showSellPanel && selectedEnt && <SellPanel entity={selectedEnt} tax={tax} onClose={() => { setShowSellPanel(false); setSelectedTile(null) }} onChanged={() => { invalidate(); loadFromServer(); onChanged?.() }} />}
      {showBuildingOverlay && selectedEnt && (() => {
        const def = BUILDINGS[selectedEnt.entity_id]
        if (!def) return null
        const ctx: BuildingContext = {
          locationSlug: slug,
          locationName: name,
          population,
          populationMax,
          isSupplied,
          resourceStock: Object.fromEntries(locationResources.map(r => [r.resource, r.stock])),
          entity: selectedEnt,
          economy: entityInfo?.[selectedEnt.id],
        }
        return <BuildingOverlay title={def.name} model={buildOverlayForBuilding(selectedEnt.entity_id, ctx)} onClose={() => { setShowBuildingOverlay(false); setSelectedTile(null) }} />
      })()}
      {interiorEntity && <BuildingInterior entity={interiorEntity} locationSlug={slug} onClose={() => setInteriorEntity(null)} onAction={onInteriorAction} />}
      {showWalking && <WalkableColony slug={slug} entities={entities} onClose={() => setShowWalking(false)} onEnterBuilding={entity => { setShowWalking(false); setInteriorEntity(entity) }} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
        <div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2a4e7a' }}>{name}</div>
          <div style={{ fontSize: '0.62rem', color: '#6b6357' }}>{population.toLocaleString('de-DE')} / {populationMax.toLocaleString('de-DE')} Einwohner</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button onClick={() => setZoom(z => Math.max(0.3, +(z - 0.15).toFixed(2)))} style={{ border: '1px solid #cfc7b8', background: '#fffdf8', borderRadius: 6, padding: '0.25rem 0.5rem', cursor: 'pointer' }}>−</button>
          <span style={{ fontSize: '0.62rem', color: '#5a6878', minWidth: 42, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, +(z + 0.15).toFixed(2)))} style={{ border: '1px solid #cfc7b8', background: '#fffdf8', borderRadius: 6, padding: '0.25rem 0.5rem', cursor: 'pointer' }}>+</button>
          <button onClick={() => setZoom(1)} style={{ border: '1px solid #cfc7b8', background: '#fffdf8', borderRadius: 6, padding: '0.25rem 0.45rem', cursor: 'pointer', fontSize: '0.6rem' }}>100%</button>
          <button onClick={() => setShowWalking(true)} style={{ border: '1px solid #cfc7b8', background: '#fffdf8', borderRadius: 6, padding: '0.25rem 0.55rem', cursor: 'pointer', fontSize: '0.6rem' }}>🚶 Erkunden</button>
        </div>
      </div>

      <div
        ref={gridScrollRef}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        style={{ overflow: 'auto', maxHeight: '72vh', cursor: 'grab', borderRadius: 8, border: '1px solid #ddd6c8', background: '#ddd6c8' }}
      >
        <div style={{ width: COLS * tileSize * zoom, height: ROWS * tileSize * zoom, position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${tileSize}px)`, gridTemplateRows: `repeat(${ROWS}, ${tileSize}px)`, width: COLS * tileSize, height: ROWS * tileSize, transform: `scale(${zoom})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
            {gridElements}
          </div>
        </div>
      </div>

      <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 50 }}>
        <GridMinimap COLS={COLS} ROWS={ROWS} entities={entities} pending={pending} userId={userId} />
      </div>
      {hoveredTile && <TileTooltip info={hoveredTile} />}
    </div>
  )
}
