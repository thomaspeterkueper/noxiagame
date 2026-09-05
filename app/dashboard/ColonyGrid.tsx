'use client'

// app/dashboard/ColonyGrid.tsx
// Erstellt:     31.05.2026
// Aktualisiert: 05.09.2026 — Scanner-Fokus gehört dem Grid statt Dashboard-DOM-Bridges
// Version:      5.25.0

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
        {msg && <div style={{ color: '#e05050', fontSize: '0.7rem', marginBottom: '0.5rem' }}>{msg}</div>}
        {loading && <div style={{ color: '#9e9485', fontSize: '0.72rem', padding: '0.75rem 0' }}>Lade verfügbare Bauoptionen …</div>}
        {!loading && items.length === 0 && !msg && <div style={{ color: '#9e9485', fontSize: '0.72rem', padding: '0.75rem 0' }}>Für dieses Feld sind aktuell keine Bauoptionen verfügbar.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
          {[...items].sort((a, b) => {
            const aHint = journeyBuildHints.includes(a.key) ? 0 : 1
            const bHint = journeyBuildHints.includes(b.key) ? 0 : 1
            if (aHint !== bHint) return aHint - bHint
            const aCost = a.displayCost ?? a.cost
            const bCost = b.displayCost ?? b.cost
            const aAfford = credits >= aCost ? 0 : 1
            const bAfford = credits >= bCost ? 0 : 1
            return aAfford - bAfford
          }).map(item => {
            const shownCost = item.displayCost ?? item.cost
            const knowledgeLocked = !!item.knowledgeLocked
            const siteBlocked = !!item.siteBlocked
            const canAfford = credits >= shownCost
            const canBuildNow = canAfford && !knowledgeLocked && !siteBlocked
            const prodText = item.production?.length
              ? item.production.map(p => `+${p.amount} ${RES_DE[p.resource] ?? p.resource}/Tick`).join(' · ')
              : ''
            return (
              <div key={item.key} style={{
                background: journeyBuildHints.includes(item.key) ? 'rgba(201,169,97,0.08)' : '#ffffff',
                border: `1px solid ${journeyBuildHints.includes(item.key) ? '#c9a961' : canBuildNow ? '#ddd6c8' : '#ece8e0'}`,
                borderRadius: '6px', padding: '0.6rem 0.75rem',
                opacity: siteBlocked ? 0.6 : 1,
                boxShadow: journeyBuildHints.includes(item.key) ? '0 0 8px rgba(201,169,97,0.3)' : 'none',
              }}>
                {journeyBuildHints.includes(item.key) && <div style={{ fontSize: '0.52rem', color: '#c9a961', fontWeight: 700, letterSpacing: '2px', marginBottom: '3px' }}>▶ EMPFOHLEN</div>}
                <button disabled={building || !canBuildNow} onClick={() => startBuild(item.key)} style={{
                  display: 'block', width: '100%', background: 'transparent', border: 'none', padding: 0,
                  color: canBuildNow ? '#1a1a18' : '#9e9485',
                  cursor: canBuildNow ? 'pointer' : 'default', textAlign: 'left', fontSize: '0.75rem',
                }}>
                  <div style={{ fontWeight: 700, marginBottom: '2px' }}>{item.name}</div>
                  <div style={{ fontSize: '0.65rem', color: canBuildNow ? '#5a5248' : '#9e9485' }}>
                    {shownCost.toLocaleString('de')} Cr · {item.buildTimeTicks} Tick(s)
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
  const [scannerFocus, setScannerFocus] = useState<{ r: number; c: number } | null>(null)
  const gridScrollRef                 = useRef<HTMLDivElement>(null)
  const handledScannerFocusRef        = useRef<string | null>(null)
  const isPanning                     = useRef(false)
  const panStart                      = useRef({ x: 0, y: 0, scrollX: 0, scrollY: 0 })

  useEffect(() => {
    const syncScannerFocus = () => {
      const raw = new URLSearchParams(window.location.search).get('focus')
      if (!raw) {
        setScannerFocus(null)
        handledScannerFocusRef.current = null
        return
      }
      const match = raw.match(/^(\d+),(\d+)$/)
      if (!match) {
        setScannerFocus(null)
        handledScannerFocusRef.current = null
        return
      }
      const r = Number(match[1])
      const c = Number(match[2])
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) {
        setScannerFocus(null)
        handledScannerFocusRef.current = null
        return
      }
      setScannerFocus({ r, c })
      handledScannerFocusRef.current = null
    }

    syncScannerFocus()
    window.addEventListener('popstate', syncScannerFocus)
    return () => window.removeEventListener('popstate', syncScannerFocus)
  }, [slug])

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

  useEffect(() => {
    if (!scannerFocus || grid.length === 0) return
    const focusKey = `${slug}:${scannerFocus.r},${scannerFocus.c}`
    if (handledScannerFocusRef.current === focusKey) return
    const scroller = gridScrollRef.current
    if (!scroller) return

    handledScannerFocusRef.current = focusKey
    const raf = requestAnimationFrame(() => {
      const centerX = (scannerFocus.c + 0.5) * tileSize * zoom
      const centerY = (scannerFocus.r + 0.5) * tileSize * zoom
      scroller.scrollTo({
        left: Math.max(0, centerX - scroller.clientWidth / 2),
        top: Math.max(0, centerY - scroller.clientHeight / 2),
        behavior: 'smooth',
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [scannerFocus, grid.length, slug, tileSize, zoom])

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
      const isScannerFocus = scannerFocus?.r === r && scannerFocus?.c === c
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
          {isScannerFocus && (
            <span style={{ position: 'absolute', inset: 2, zIndex: 35, pointerEvents: 'none', border: '3px solid #d9c27b', borderRadius: 3, boxShadow: '0 0 12px rgba(217,194,123,.9)', animation: 'noxia-scanner-focus-pulse 1.25s ease-in-out infinite' }}>
              <span style={{ position: 'absolute', top: 2, right: 2, padding: '1px 4px', borderRadius: 3, background: 'rgba(8,19,26,.9)', color: '#f0d47c', font: '800 8px/1.4 monospace', letterSpacing: '.08em' }}>SCAN</span>
            </span>
          )}
        </div>
      )
    }))
  }, [grid, selectedTile, scannerFocus, entities, pending, anomaly, userId, entityInfo, handleTileClick, entityAt, sellingAt, slug, population, populationMax, tileSize, highlightEntityIds])

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
  // Der begehbare Scanner-Mikroscene braucht ein Vollbild-Overlay (wie ShipWalkable);
  // alle anderen Gebäude-Interieurs bleiben im 460px-Modal.
  const scannerScene = !!interiorEntity && interiorEntity.entity_id === 'scanner' && interiorEntity.profile_id === userId
  const openSellForSelected = () => {
    setShowLanding(false); setShowSchool(false); setShowBank(false); setShowAdmin(false)
    setShowSellPanel(true)
  }

  return (
    <div style={{ background: '#f4f2ed', borderRadius: '12px', padding: '1rem', boxShadow: '0 4px 8px rgba(0,0,0,0.08)' }}>
      <BuildingSpriteStyles />
      <style>{`@keyframes noxia-anomaly { 0%,100%{opacity:.45;transform:scale(0.85)} 50%{opacity:1;transform:scale(1.1)} } @keyframes noxia-spin { to { transform: rotate(360deg) } } @keyframes noxia-hint { 0%,100%{opacity:.5;box-shadow:0 0 6px rgba(201,169,97,0.5)} 50%{opacity:1;box-shadow:0 0 16px rgba(201,169,97,0.95)} } @keyframes noxia-scanner-focus-pulse { 0%,100%{opacity:.68;box-shadow:0 0 7px rgba(217,194,123,.65)} 50%{opacity:1;box-shadow:0 0 16px rgba(217,194,123,1)} }`}</style>

      {showLanding && <LandingOverlay currentLocation={slug} locations={allLocations} cargo={cargo} shipRange={shipRange} currentTick={currentTick} inTransit={inTransit} onTravel={dest => onTravel?.(dest)} onClose={() => { setShowLanding(false); setSelectedTile(null) }} canSell={canSellSelected} onSellClick={openSellForSelected} />}
      {showSchool && <SchoolOverlay locationSlug={slug} colonyContext={{ locationName: name, population, waterStock: locationResources.find(r => r.resource === 'water')?.stock ?? 0, waterCons: locationResources.find(r => r.resource === 'water')?.consumption ?? Math.ceil(population / 100), credits }} onClose={() => { setShowSchool(false); setSelectedTile(null) }} onKnowledgeEarned={(pts: number, total: number) => console.log(`+${pts} Wissenspunkte → ${total}`)} canSell={canSellSelected} onSellClick={openSellForSelected} />}
      {showBank && <BankOverlay locationSlug={slug} locationName={name} credits={credits} onClose={() => { setShowBank(false); setSelectedTile(null) }} onCreditsChanged={() => onChanged?.()} gates={gates} canSell={canSellSelected} onSellClick={openSellForSelected} />}
      {showAdmin && <AdminOverlay locationSlug={slug} onClose={() => { setShowAdmin(false); setSelectedTile(null) }} userId={userId} canSell={canSellSelected} onSellClick={openSellForSelected} />}

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
          <style>{'.grid-pan-container::-webkit-scrollbar { display: none }'}</style>
          {interiorEntity && (
            <div style={{
              position: scannerScene ? 'fixed' : 'absolute', inset: 0,
              zIndex: scannerScene ? 2000 : 200,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} onClick={e => e.target === e.currentTarget && setInteriorEntity(null)}>
              <div style={scannerScene ? undefined : { width: 460 }}>
                <BuildingInterior
                  entity={interiorEntity as any}
                  userId={userId}
                  locationResources={locationResources as any}
                  credits={credits}
                  population={population}
                  hasShipyard={entities.some((e: any) => e.entity_id === 'shipyard')}
                  currentTick={currentTick}
                  shipRange={shipRange}
                  currentLocationSlug={slug}
                  onClose={() => setInteriorEntity(null)}
                  onAction={kind => { if (kind && kind !== 'navigation') { onInteriorAction?.(kind); setInteriorEntity(null) } }}
                />
              </div>
            </div>
          )}
          {showWalking && (
            <WalkableColony
              locationSlug={slug}
              locationName={name}
              population={population}
              entities={entities as any}
              pending={pending}
              ships={[]}
              locationId={''}
              userId={userId}
              onClose={() => setShowWalking(false)}
              onEnterBuilding={e => { setInteriorEntity(e as any); setShowWalking(false) }}
            />
          )}
          <button
            onClick={() => setShowWalking(true)}
            style={{
              position: 'absolute', top: 6, left: 6, zIndex: 10,
              background: 'rgba(248,245,238,0.92)', border: '1px solid #ddd6c8',
              borderRadius: 8, padding: '3px 10px', cursor: 'pointer',
              fontSize: '0.68rem', color: '#2a4e7a', fontWeight: 700,
            }}
          >
            🚶 Betreten
          </button>
          <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 10, display: 'flex', gap: 4, background: 'rgba(248,245,238,0.92)', border: '1px solid #ddd6c8', borderRadius: 8, padding: '3px 6px', alignItems: 'center' }}>
            <button onClick={() => setZoom(z => Math.min(2.0, z + 0.15))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0 4px', color: '#2a4e7a', fontWeight: 700 }}>+</button>
            <span style={{ fontSize: '0.62rem', color: '#6b6357', fontFamily: 'monospace', minWidth: 32, textAlign: 'center' as const }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.15))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0 4px', color: '#2a4e7a', fontWeight: 700 }}>−</button>
            <button onClick={() => setZoom(1.0)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.6rem', padding: '0 4px', color: '#9e9485' }}>↺</button>
          </div>
          <div
            ref={gridScrollRef}
            className="grid-pan-container"
            onMouseDown={handlePanStart}
            onMouseMove={handlePanMove}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}
            style={{
              cursor: 'grab',
              overflow: 'scroll',
              maxHeight: 'calc(100vh - 280px)',
              border: '2px solid #2a4e7a',
              borderRadius: '6px',
              background: '#f4f2ed',
              scrollbarWidth: 'none' as any,
              msOverflowStyle: 'none' as any,
            }}>
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${COLS * tileSize}px`, height: `${ROWS * tileSize}px`, transition: 'transform 0.15s ease' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${tileSize}px)`, gridAutoRows: `${tileSize}px`, gap: 0, width: `${COLS * tileSize}px` }}>
                {gridElements}
              </div>
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
