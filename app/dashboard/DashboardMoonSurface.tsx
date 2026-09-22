'use client'

import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useGameStore, type LocationSlug, type ResourceType } from '@/lib/store/gameStore'
import { getToken } from '@/lib/supabase/auth'
import ShackletonSurfaceMap from '@/app/moon/ShackletonSurfaceMap'
import BuildingInterior from './BuildingInterior'
import ShipyardOverlay from './ShipyardOverlay'
import SolarSystem from './SolarSystem'
import SpaceportOverlay from './SpaceportOverlay'
import WarehouseOverlay from './WarehouseOverlay'

const NASA_LOLA_SHACKLETON = 'https://svs.gsfc.nasa.gov/vis/a000000/a004200/a004289/lro_south_pole_print.jpg'

type MoonEntity = {
  id: string
  entity_id?: string | null
  name?: string | null
  status?: string | null
  ownerLabel?: string | null
  profile_id?: string | null
  owner_class?: string | null
}

type Props = {
  locations: any[]
  prices: any[]
  orders: any[]
}

const INTERIOR_ALIAS: Record<string, string> = {
  landing_pad_moon: 'landing_pad',
  surface_workshop: 'shipyard',
  surface_comms: 'command_center',
}

function actionLabel(entityId: string) {
  if (entityId === 'landing_pad_moon') return 'Raumhafen'
  if (entityId === 'warehouse') return 'Warenhaus'
  if (entityId === 'surface_workshop') return 'Werkstatt'
  if (entityId === 'surface_comms') return 'Navigation'
  if (entityId === 'rover_yard') return 'Logistik'
  return 'Betreten'
}

export default function DashboardMoonSurface({ locations, prices, orders }: Props) {
  const location = useGameStore(state => state.location)
  const credits = useGameStore(state => state.credits)
  const cargo = useGameStore(state => state.cargo)
  const cargoMax = useGameStore(state => state.cargoMax)
  const shipTypeId = useGameStore(state => state.shipTypeId)
  const shipRange = useGameStore(state => state.shipRange)
  const buy = useGameStore(state => state.buy)
  const sell = useGameStore(state => state.sell)
  const loadFromServer = useGameStore(state => state.loadFromServer)

  const [entities, setEntities] = useState<MoonEntity[]>([])
  const [selectedEntity, setSelectedEntity] = useState<MoonEntity | null>(null)
  const [interiorEntity, setInteriorEntity] = useState<MoonEntity | null>(null)
  const [spaceportOpen, setSpaceportOpen] = useState(false)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [shipyardOpen, setShipyardOpen] = useState(false)
  const [warehouseOpen, setWarehouseOpen] = useState(false)
  const [tick, setTick] = useState(0)

  const moonLocation = useMemo(() => locations.find((item: any) => item.slug === 'moon') ?? null, [locations])
  const moonOrders = useMemo(() => orders.filter((item: any) => item.locations?.slug === 'moon'), [orders])

  useEffect(() => {
    if (location !== 'moon') return
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        if (!token) return
        const response = await fetch('/api/game/build/spatial?location=moon', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const payload = await response.json()
        if (!cancelled && response.ok) setEntities(Array.isArray(payload.entities) ? payload.entities : [])
      } catch {}
    })()
    return () => { cancelled = true }
  }, [location])

  useEffect(() => {
    if (location !== 'moon') return
    let cancelled = false
    fetch('/api/game/world', { cache: 'no-store' })
      .then(response => response.json())
      .then(payload => { if (!cancelled) setTick(Number(payload?.stats?.tickNumber ?? 0)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [location])

  if (location !== 'moon') return null

  const getMapSvg = () => document.querySelector<SVGSVGElement>('.noxia-dashboard-moon-surface .earth-map svg')

  const zoomMap = (direction: 'in' | 'out') => {
    const svg = getMapSvg()
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    svg.dispatchEvent(new WheelEvent('wheel', {
      deltaY: direction === 'in' ? -220 : 220,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      bubbles: true,
      cancelable: true,
    }))
  }

  const centerMap = () => {
    document.querySelector<HTMLButtonElement>('.noxia-dashboard-moon-surface .earth-focus')?.click()
  }

  const selectFromMap = (event: MouseEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null
    const button = target?.closest('[role="button"][aria-label$=" auswählen"]')
    if (!button) return
    const label = button.getAttribute('aria-label')?.replace(/\s+auswählen$/, '').trim()
    if (!label) return
    const entity = entities.find(item => item.name === label || item.entity_id === label)
    if (entity) setSelectedEntity(entity)
  }

  const openPrimaryAction = () => {
    const entityId = selectedEntity?.entity_id ?? ''
    if (!selectedEntity) return
    if (entityId === 'landing_pad_moon') { setSpaceportOpen(true); return }
    if (entityId === 'warehouse') { setWarehouseOpen(true); return }
    if (entityId === 'surface_workshop') { setShipyardOpen(true); return }
    if (entityId === 'surface_comms') { setNavigationOpen(true); return }
    if (entityId === 'rover_yard') {
      document.querySelector<HTMLElement>('.noxia-dashboard-moon-surface .earth-lower-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setInteriorEntity(selectedEntity)
  }

  const openInterior = (entity: MoonEntity) => {
    setInteriorEntity(entity)
  }

  const handleInteriorAction = (kind: 'market' | 'shipyard' | 'navigation' | 'ship' | 'parts' | null) => {
    if (kind === 'market') setWarehouseOpen(true)
    if (kind === 'shipyard' || kind === 'parts' || kind === 'ship') setShipyardOpen(true)
    if (kind === 'navigation') setNavigationOpen(true)
    if (kind) setInteriorEntity(null)
  }

  const currentResources = moonLocation?.location_resources ?? []
  const selectedId = selectedEntity?.entity_id ?? ''
  const selectedName = selectedEntity?.name ?? selectedEntity?.entity_id ?? 'Mondanlage'

  return (
    <section className="noxia-dashboard-moon-surface" aria-label="Mondoberfläche Shackleton" onClickCapture={selectFromMap}>
      <div className="moon-context-label">
        <strong>LRO / LOLA · Shackleton</strong>
        <span>NASA-Terrainkontext · lokales ENU-Netz bleibt metrisch separat</span>
      </div>

      <div className="moon-map-controls" aria-label="Mondkarten-Steuerung">
        <button type="button" onClick={centerMap}>Zentrieren</button>
        <button type="button" aria-label="Hineinzoomen" onClick={() => zoomMap('in')}>+</button>
        <button type="button" aria-label="Herauszoomen" onClick={() => zoomMap('out')}>−</button>
      </div>

      <ShackletonSurfaceMap />

      {selectedEntity && (
        <aside className="moon-building-actions" aria-label={`Aktionen für ${selectedName}`}>
          <div>
            <small>GEBÄUDEAKTIONEN</small>
            <strong>{selectedName}</strong>
          </div>
          <button type="button" onClick={openPrimaryAction}>{actionLabel(selectedId)} öffnen →</button>
          {!['landing_pad_moon', 'warehouse', 'surface_workshop', 'surface_comms', 'rover_yard'].includes(selectedId) && (
            <button type="button" className="secondary" onClick={() => openInterior(selectedEntity)}>Anlage betreten</button>
          )}
          {selectedId === 'surface_workshop' && (
            <button type="button" className="secondary" onClick={() => setWarehouseOpen(true)}>Materiallager</button>
          )}
          {selectedId === 'landing_pad_moon' && (
            <button type="button" className="secondary" onClick={() => setNavigationOpen(true)}>Navigation</button>
          )}
        </aside>
      )}

      {spaceportOpen && (
        <SpaceportOverlay
          buildingTypeId="landing_pad_moon"
          buildingName={selectedName}
          onClose={() => setSpaceportOpen(false)}
          onOpenNavigation={() => { setSpaceportOpen(false); setNavigationOpen(true) }}
          onOpenMaintenance={() => { setSpaceportOpen(false); setShipyardOpen(true) }}
          onOpenCargo={() => { setSpaceportOpen(false); setWarehouseOpen(true) }}
        />
      )}

      {navigationOpen && (
        <div className="moon-modal" onClick={event => event.target === event.currentTarget && setNavigationOpen(false)}>
          <div className="moon-navigation-panel">
            <div className="moon-modal-head"><strong>🧭 Navigation · Shackleton</strong><button onClick={() => setNavigationOpen(false)}>×</button></div>
            <SolarSystem currentTick={tick} shipRange={shipRange} currentLocation="moon" />
          </div>
        </div>
      )}

      <ShipyardOverlay
        open={shipyardOpen}
        onClose={() => setShipyardOpen(false)}
        currentShipTypeId={shipTypeId ?? 'freighter_mk1'}
        credits={credits}
        onBuyShip={async type => {
          const token = await getToken()
          const response = await fetch(`/api/game/ships?action=buy&shipTypeId=${encodeURIComponent(type)}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const payload = await response.json()
          if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Schiffskauf fehlgeschlagen')
          await loadFromServer()
          setShipyardOpen(false)
        }}
      />

      {warehouseOpen && (
        <WarehouseOverlay
          locationSlug={'moon' as LocationSlug}
          locationName={moonLocation?.name ?? 'Shackleton'}
          prices={prices}
          resources={currentResources}
          orders={moonOrders}
          cargo={cargo as Record<ResourceType, number>}
          cargoMax={cargoMax}
          credits={credits}
          onTrade={async (resource, mode, amount, price) => {
            const result = mode === 'buy' ? await buy(resource, price, amount) : await sell(resource, price, amount)
            return result.ok
          }}
          onFulfillOrder={async (orderId, agreedReward) => {
            const token = await getToken()
            const response = await fetch(`/api/game/orders?action=fulfill&orderId=${encodeURIComponent(orderId)}&agreedReward=${Math.round(agreedReward)}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            const payload = await response.json()
            if (payload.ok) await loadFromServer()
            return Boolean(payload.ok)
          }}
          onClose={() => setWarehouseOpen(false)}
        />
      )}

      {interiorEntity && (
        <div className="moon-modal" onClick={event => event.target === event.currentTarget && setInteriorEntity(null)}>
          <div className="moon-interior-panel">
            <BuildingInterior
              entity={{
                ...interiorEntity,
                entity_id: INTERIOR_ALIAS[interiorEntity.entity_id ?? ''] ?? interiorEntity.entity_id ?? 'unknown',
                entity_type: 'building',
                tile_row: 0,
                tile_col: 0,
                profile_id: interiorEntity.profile_id ?? null,
                owner_class: interiorEntity.owner_class ?? 'STATE',
              } as any}
              userId=""
              locationResources={currentResources as any}
              credits={credits}
              population={Number(moonLocation?.population ?? 0)}
              hasShipyard={Boolean(moonLocation?.has_shipyard)}
              currentTick={tick}
              shipRange={shipRange}
              currentLocationSlug="moon"
              onClose={() => setInteriorEntity(null)}
              onAction={handleInteriorAction}
            />
          </div>
        </div>
      )}

      <style jsx>{`
        .noxia-dashboard-moon-surface {
          position: fixed;
          top: var(--noxia-topbar-h, 44px);
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 1000;
          overflow: auto;
          background: #070b0f url('${NASA_LOLA_SHACKLETON}') center 32% / cover fixed no-repeat;
          overscroll-behavior: contain;
        }
        .noxia-dashboard-moon-surface::before {
          content: '';
          position: fixed;
          inset: var(--noxia-topbar-h, 44px) 0 0;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(5,9,13,.62), rgba(5,9,13,.85) 78%, rgba(5,9,13,.94));
          z-index: 0;
        }
        .moon-context-label {
          position: fixed;
          z-index: 2;
          left: 18px;
          bottom: calc(var(--noxia-cockpit-clearance, 76px) + 10px);
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 7px 10px;
          border: 1px solid rgba(189,213,225,.2);
          border-radius: 8px;
          background: rgba(5,12,18,.72);
          backdrop-filter: blur(8px);
          color: #d7e3e8;
          font: 10px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          pointer-events: none;
        }
        .moon-context-label strong { color: #d7b96e; letter-spacing: .08em; }
        .moon-context-label span { color: #8ea2ad; }
        .moon-map-controls {
          position: fixed;
          z-index: 2290;
          top: calc(var(--noxia-topbar-h, 44px) + 14px);
          left: 318px;
          display: flex;
          gap: 6px;
          pointer-events: auto;
        }
        .moon-map-controls button {
          min-width: 34px;
          height: 34px;
          border: 1px solid #506b73;
          border-radius: 7px;
          background: rgba(245,242,232,.95);
          color: #17313c;
          font: 800 11px system-ui,sans-serif;
          cursor: pointer;
          box-shadow: 0 2px 10px rgba(12,27,34,.18);
        }
        .moon-map-controls button:first-child { padding:0 12px; }
        .moon-map-controls button:hover { background:#fffaf0; border-color:#9b7a2c; }
        .moon-building-actions {
          position: fixed;
          z-index: 2290;
          right: 18px;
          bottom: calc(var(--noxia-cockpit-clearance, 76px) + 12px);
          width: min(330px, calc(100vw - 36px));
          display: grid;
          gap: 7px;
          padding: 10px;
          border: 1px solid #6b8590;
          border-radius: 10px;
          background: rgba(248,246,238,.96);
          color: #17313c;
          box-shadow: 0 14px 38px rgba(0,0,0,.28);
          backdrop-filter: blur(8px);
        }
        .moon-building-actions div { display:grid; gap:2px; }
        .moon-building-actions small { color:#8d702c; font:800 9px/1.2 ui-monospace,monospace; letter-spacing:.12em; }
        .moon-building-actions strong { font-size:14px; }
        .moon-building-actions button { border:1px solid #416675; border-radius:7px; background:#173f4e; color:#fff; padding:8px 10px; font-size:10px; font-weight:800; cursor:pointer; }
        .moon-building-actions button.secondary { background:#fffdf4; color:#284853; border-color:#a9b8b7; }
        .moon-modal { position:fixed; inset:0; z-index:2400; display:grid; place-items:center; padding:1rem; background:rgba(2,7,12,.86); }
        .moon-navigation-panel,.moon-interior-panel { width:min(760px,96vw); max-height:92vh; overflow:auto; border:1px solid #40596a; border-radius:14px; background:#eef1ed; box-shadow:0 18px 60px rgba(0,0,0,.5); }
        .moon-navigation-panel { padding:1rem; background:#070b14; }
        .moon-modal-head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px; color:#d7b96e; font:800 11px/1.2 ui-monospace,monospace; }
        .moon-modal-head button { border:1px solid #314756; border-radius:6px; background:transparent; color:#9cb0bb; padding:3px 9px; cursor:pointer; }
        .noxia-dashboard-moon-surface :global(.moon-shell) {
          position: relative;
          z-index: 1;
          min-height: 100%;
          box-sizing: border-box;
          padding-bottom: calc(var(--noxia-cockpit-clearance, 76px) + 24px);
          background: transparent !important;
        }
        .noxia-dashboard-moon-surface :global(.hero),
        .noxia-dashboard-moon-surface :global(.map-card),
        .noxia-dashboard-moon-surface :global(.jobs-card),
        .noxia-dashboard-moon-surface :global(.chain-card) {
          backdrop-filter: blur(7px);
        }
        .noxia-dashboard-moon-surface :global(.map-card),
        .noxia-dashboard-moon-surface :global(.jobs-card),
        .noxia-dashboard-moon-surface :global(.chain-card) {
          background: rgba(10,19,25,.8) !important;
        }
        .noxia-dashboard-moon-surface :global(.map-card svg) {
          background: linear-gradient(160deg, #0c1418, #050a0d) !important;
        }
        .noxia-dashboard-moon-surface :global(.map-card svg > rect:first-of-type) {
          fill: rgba(8,15,20,.6) !important;
        }
        .noxia-dashboard-moon-surface :global(.map-card svg > rect:nth-of-type(2)) {
          opacity: .3 !important;
        }
        .noxia-dashboard-moon-surface :global(.earth-map svg g[role='button'] > rect:nth-of-type(2)) {
          fill-opacity: .04 !important;
          stroke-opacity: .28 !important;
        }
        .noxia-dashboard-moon-surface :global(.earth-map svg g[role='button'] > ellipse) {
          opacity: .14 !important;
        }
        @media(max-width:760px){
          .moon-map-controls{left:auto;right:82px}
          .moon-map-controls button:first-child{display:none}
        }
      `}</style>
    </section>
  )
}
