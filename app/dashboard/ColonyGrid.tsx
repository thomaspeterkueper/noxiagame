// app/dashboard/ColonyGrid.tsx
// Erstellt:     31.05.2026
// Aktualisiert: 19.07.2026 — gates prop: an BankOverlay weitergeben
// Version:      5.9.0

'use client'

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
import BankOverlay from './BankOverlay'

function TileDisplay({ tileType, slug }: { tileType: string; slug: string }) {
  const [src, setSrc] = useState(`/images/grid/${slug}/${tileType}.webp`)
  const [useSVG, setUseSVG] = useState(false)
  if (useSVG) return <TileSVG type={tileType} planet={slug} />
  return (
    <img src={src} width={44} height={44} style={{ display: 'block' }}
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
  onOpenShipyard?: () => void; onOpenWarehouse?: () => void; onChanged?: () => void
  tileSize?: number
  highlightEntityIds?: string[]   // entity_ids die mit goldenem Pulsring markiert werden
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
  buildTimeTicks: number
  populationBonus?: number
  production?: { resource: string; amount: number }[]
  allowedLocations?: string[] | null
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
  const nameColor = info.isOwn ? '#c9a961'
    : info.isState ? '#5aaeff' : info.entity ? '#e8a0a0' : '#8ab0d0'

  return (
    <div style={{
      position: 'fixed',
      left: flipX ? undefined : info.x + 6,
      right: flipX ? `calc(100vw - ${info.x}px + 6px)` : undefined,
      top: flipY ? undefined : info.y,
      bottom: flipY ? `calc(100vh - ${info.y}px)` : undefined,
      zIndex: 9999, background: 'rgba(6,14,24,0.97)',
      border: `1px solid ${borderColor}`, borderRadius: '7px',
      padding: '8px 11px', minWidth: '150px', maxWidth: `${TW}px`,
      boxShadow: '0 4px 20px rgba(0,0,0,0.7)', pointerEvents: 'none',
      fontFamily: "'Courier Prime', monospace",
    }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: nameColor, marginBottom: '4px' }}>{name}</div>
      {info.entity && (
        <div style={{ fontSize: '0.65rem', color: '#7a8a9a', marginBottom: '3px' }}>
          {info.isOwn ? '🔑 Dein Gebäude' : info.isState ? '🏛 Staatlich' : info.isCorp ? '🏢 Corporation' : `👤 ${info.entity.username ?? 'Anderer Pilot'}`}
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
      <div style={{ width: 'min(700px, 95vw)', maxHeight: '88vh', background: 'rgba(10,20,32,0.98)', border: '1px solid rgba(42,78,122,0.75)', borderRadius: '12px', boxShadow: '0 12px 48px rgba(0,0,0,0.72)', display: 'flex', flexDirection: 'column', padding: '1rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ color: '#b99b6b', fontWeight: 700, fontSize: '0.85rem' }}>🏗️ Gebäude bauen — Kachel ({tileRow}, {tileCol})</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ fontSize: '0.62rem', color: '#64748b', marginBottom: '0.6rem' }}>Standort: {locationSlug} · Feld: {tileType.replace(/_/g, ' ')}</div>
        {msg && <div style={{ color: '#e05050', fontSize: '0.7rem', marginBottom: '0.5rem' }}>{msg}</div>}
        {loading && <div style={{ color: '#8a9ab0', fontSize: '0.72rem', padding: '0.75rem 0' }}>Lade verfügbare Bauoptionen …</div>}
        {!loading && items.length === 0 && !msg && <div style={{ color: '#8a9ab0', fontSize: '0.72rem', padding: '0.75rem 0' }}>Für dieses Feld sind aktuell keine Bauoptionen verfügbar.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
          {items.map(item => {
            const canAfford = credits >= item.cost
            const prodText = item.production?.length
              ? item.production.map(p => `+${p.amount} ${RES_DE[p.resource] ?? p.resource}/Tick`).join(' · ')
              : ''
            return (
              <button key={item.key} disabled={building || !canAfford} onClick={() => startBuild(item.key)} style={{
                background: journeyBuildHints.includes(item.key) ? 'rgba(201,169,97,0.15)' : canAfford ? 'rgba(42,78,122,0.5)' : 'rgba(30,40,55,0.5)',
                border: `1px solid ${journeyBuildHints.includes(item.key) ? '#c9a961' : canAfford ? '#2a4e7a' : '#2a3a4a'}`,
                borderRadius: '6px', padding: '0.6rem 0.75rem',
                color: canAfford ? '#cdd6e0' : '#4a5a6a',
                cursor: canAfford ? 'pointer' : 'not-allowed', textAlign: 'left', fontSize: '0.75rem',
                boxShadow: journeyBuildHints.includes(item.key) ? '0 0 8px rgba(201,169,97,0.3)' : 'none',
              }}>
                {journeyBuildHints.includes(item.key) && <div style={{ fontSize: '0.52rem', color: '#c9a961', fontWeight: 700, letterSpacing: '2px', marginBottom: '3px' }}>▶ EMPFOHLEN</div>}
                <div style={{ fontWeight: 700, marginBottom: '2px' }}>{item.name}</div>
                <div style={{ fontSize: '0.65rem', color: canAfford ? '#8a9ab0' : '#3a4a5a' }}>
                  {item.cost.toLocaleString('de')} Cr · {item.buildTimeTicks} Tick(s)
                  {prodText && ` · ${prodText}`}
                  {!!item.populationBonus && ` · +${item.populationBonus} Kapazität`}
                </div>
              </button>
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
  inTransit = false, onTravel, onOpenShipyard, onOpenWarehouse, onChanged, tileSize: externalTileSize,
  gates = {},
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
    // Jede andere besetzte Kachel → nur Info in Sidebar, kein Bauen
    if (ent) return
    // Freie Kachel → Bauen möglich
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
      const isNPC  = !!entity?.actor_id
      const isState = !isNPC && entity?.owner_class === 'STATE'
      const isCorp  = !isNPC && entity?.owner_class === 'CORPORATION'
      const interactive = canBuild || !!entity || isAnom
      let ownerShadow = 'none'
      if (entity) {
        if (isState)  ownerShadow = 'inset 0 0 0 2px #5aaeff, 0 0 5px rgba(90,174,255,0.55)'   // Blau = Staat
        else if (isCorp) ownerShadow = 'inset 0 0 0 2px #e08030, 0 0 5px rgba(224,128,48,0.55)'  // Orange = Corporation
        else if (isOwn) ownerShadow = 'inset 0 0 0 2px #c9a961, 0 0 5px rgba(201,169,97,0.55)'   // Gold = Spieler
        else ownerShadow = 'inset 0 0 0 2px #e05050, 0 0 4px rgba(224,80,80,0.45)'               // Rot = anderer Spieler
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
            if (entity?.entity_id) return <BuildingSVG entityId={entity.entity_id} planet={slug} occupancy={populationMax > 0 ? population / populationMax : 0} owned={isOwn} size={tileSize} />
            const npcEid = NPC_ENTITY[tileType]
            if (npcEid) return <BuildingSVG entityId={npcEid} planet={slug} occupancy={populationMax > 0 ? population / populationMax : 0} owned={false} size={tileSize} />
            if (tileType.startsWith('building_') && tileType !== 'building_construction') return <BuildingSVG entityId={tileType.replace('building_', '')} planet={slug} occupancy={populationMax > 0 ? population / populationMax : 0} owned={false} size={tileSize} />
            if (tileType.startsWith('road')) return <TileSVG type={tileType} planet={slug} />
            return <TileDisplay tileType={tileType} slug={slug} />
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

  return (
    <div style={{ background: '#f4f2ed', borderRadius: '12px', padding: '1rem', boxShadow: '0 4px 8px rgba(0,0,0,0.08)' }}>
      <BuildingSpriteStyles />
      <style>{`@keyframes noxia-anomaly { 0%,100%{opacity:.45;transform:scale(0.85)} 50%{opacity:1;transform:scale(1.1)} } @keyframes noxia-spin { to { transform: rotate(360deg) } } @keyframes noxia-hint { 0%,100%{opacity:.5;box-shadow:0 0 6px rgba(201,169,97,0.5)} 50%{opacity:1;box-shadow:0 0 16px rgba(201,169,97,0.95)} }`}</style>

      {showLanding && <LandingOverlay currentLocation={slug} locations={allLocations} cargo={cargo} shipRange={shipRange} currentTick={currentTick} inTransit={inTransit} onTravel={dest => onTravel?.(dest)} onClose={() => { setShowLanding(false); setSelectedTile(null) }} />}
      {showSchool && <SchoolOverlay locationSlug={slug} colonyContext={{ locationName: name, population, waterStock: locationResources.find(r => r.resource === 'water')?.stock ?? 0, waterCons: locationResources.find(r => r.resource === 'water')?.consumption ?? Math.ceil(population / 100), credits }} onClose={() => { setShowSchool(false); setSelectedTile(null) }} onKnowledgeEarned={(pts: number, total: number) => console.log(`+${pts} Wissenspunkte → ${total}`)} />}
      {showBank && <BankOverlay locationSlug={slug} locationName={name} credits={credits} onClose={() => { setShowBank(false); setSelectedTile(null) }} onCreditsChanged={() => onChanged?.()} gates={gates} />}
      {showAdmin && <AdminOverlay locationSlug={slug} onClose={() => { setShowAdmin(false); setSelectedTile(null) }} />}

      {showBuildingOverlay && selectedTile && (() => {
        const ent = entityAt(selectedTile.r, selectedTile.c)
        if (!ent) return null
        const eco = entityInfo?.[ent.id]
        const stocks: Record<string, number> = {}
        const consumption: Record<string, number> = {}
        for (const r of locationResources ?? []) {
          stocks[r.resource] = r.stock
          consumption[r.resource] = r.consumption
        }
        const production: Record<string, number> = {}
        if (eco?.ressource && eco.produktion) production[eco.ressource] = eco.produktion
        const ctx: BuildingContext = {
          locationSlug: slug,
          locationName: name,
          isOwn:  ent.profile_id === userId,
          isCorp: ent.owner_class === 'CORPORATION',
          production,
          consumption,
          stocks,
          population,
          populationMax,
          credits,
        }
        const overlay = buildOverlayForBuilding(ent.entity_id, ctx)
        const handleAction = (actionId: string) => {
          if (actionId === 'sell_building') {
            setShowBuildingOverlay(false)
            setShowSellPanel(true)
          }
        }
        return <BuildingOverlay overlay={overlay} onClose={() => { setShowBuildingOverlay(false); setSelectedTile(null) }} onAction={handleAction} />
      })()}

      {showSellPanel && selectedTile && (() => {
        const ent = entityAt(selectedTile.r, selectedTile.c)
        if (!ent) return null
        const entName = BUILDINGS[ent.entity_id]?.name ?? ent.entity_id
        return <SellPanel entityId={ent.id} entityName={entName} onSold={async () => { setShowSellPanel(false); setSelectedTile(null); await onChanged?.() }} />
      })()}
      {showBuildPopup && selectedTile && <BuildPopup journeyBuildHints={highlightEntityIds} tileRow={selectedTile.r} tileCol={selectedTile.c} tileType={selectedTile.type} locationSlug={slug} onClose={() => { setShowBuildPopup(false); setSelectedTile(null) }} onBuildStarted={async () => { await loadFromServer(); invalidate('builds') }} />}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
          {hoveredTile && <TileTooltip info={hoveredTile} />}
          <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 280px)', border: '2px solid #2a4e7a', borderRadius: '6px', background: '#f4f2ed' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${tileSize}px)`, gridAutoRows: `${tileSize}px`, gap: 0, width: `${COLS * tileSize}px` }}>
              {gridElements}
            </div>
          </div>
        </div>

        <div style={{ width: '190px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          <div style={{ background: '#fff', border: '1px solid #e0ddd6', borderRadius: '8px', padding: '0.7rem 0.85rem' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.82rem', color: '#1a3a5a', fontWeight: 600, marginBottom: '0.25rem' }}>{name}</div>
            <div style={{ fontSize: '0.62rem', color: '#6a7a8a', marginBottom: '0.4rem' }}>{population.toLocaleString('de')} / {populationMax.toLocaleString('de')} Einw.</div>
            <div style={{ background: '#e8e4dc', height: '4px', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.5rem' }}>
              <div style={{ width: `${Math.min(100, Math.round(population / Math.max(1, populationMax) * 100))}%`, height: '100%', borderRadius: '2px', background: population / Math.max(1, populationMax) > 0.8 ? '#e74c3c' : isSupplied ? '#6fcf97' : '#e8702a' }} />
            </div>
            {locationResources.map(r => {
              const icon = r.resource === 'water' ? '💧' : r.resource === 'energy' ? '⚡' : '⛏️'
              const isLow = r.stock < 50; const isHigh = r.stock > 400
              return (
                <div key={r.resource} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.66rem', marginBottom: '2px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: isLow ? '#e74c3c' : isHigh ? '#6fcf97' : '#f5a623' }} />
                  <span style={{ color: '#4a5a6a' }}>{icon} {r.stock.toLocaleString('de')}t</span>
                </div>
              )
            })}
          </div>

          <GridMinimap COLS={COLS} ROWS={ROWS} entities={entities} pending={pending} userId={userId} />

          <div style={{ background: '#fff', border: '1px solid #e0ddd6', borderRadius: '8px', padding: '0.55rem 0.85rem' }}>
            <div style={{ fontSize: '0.56rem', color: '#8a9ab0', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Legende</div>
            {([['#c9a961','Dein Gebäude'],['#5aaeff','Staatlich'],['#e05050','NPC / Fremd'],['#d08020','Im Bau']] as [string,string][]).map(([color, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6rem', color: '#4a5a6a', marginBottom: '2px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '2px', background: color, flexShrink: 0 }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
