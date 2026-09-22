'use client'

import { useEffect, useMemo, useState } from 'react'
import { useGameStore, type LocationSlug, type ResourceType } from '@/lib/store/gameStore'
import { getToken } from '@/lib/supabase/auth'
import ShackletonSurfaceMap, { type MoonSurfaceEntity } from '@/app/moon/ShackletonSurfaceMap'
import BuildingInterior from './BuildingInterior'
import ShipyardOverlay from './ShipyardOverlay'
import SolarSystem from './SolarSystem'
import SpaceportOverlay from './SpaceportOverlay'
import WarehouseOverlay from './WarehouseOverlay'

const NASA_LOLA_SHACKLETON = 'https://svs.gsfc.nasa.gov/vis/a000000/a004200/a004289/lro_south_pole_print.jpg'

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

  const [interiorEntity, setInteriorEntity] = useState<MoonSurfaceEntity | null>(null)
  const [spaceportEntity, setSpaceportEntity] = useState<MoonSurfaceEntity | null>(null)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [shipyardOpen, setShipyardOpen] = useState(false)
  const [warehouseOpen, setWarehouseOpen] = useState(false)
  const [tick, setTick] = useState(0)

  const moonLocation = useMemo(() => locations.find((item: any) => item.slug === 'moon') ?? null, [locations])
  const moonOrders = useMemo(() => orders.filter((item: any) => item.locations?.slug === 'moon'), [orders])

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

  const openWorldObject = (entity: MoonSurfaceEntity) => {
    const entityId = entity.entity_id ?? ''
    if (entityId === 'landing_pad_moon') { setSpaceportEntity(entity); return }
    if (entityId === 'warehouse') { setWarehouseOpen(true); return }
    if (entityId === 'surface_workshop') { setShipyardOpen(true); return }
    if (entityId === 'surface_comms') { setNavigationOpen(true); return }
    if (entityId === 'rover_yard') {
      document.querySelector<HTMLElement>('.noxia-dashboard-moon-surface .earth-lower-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setInteriorEntity(entity)
  }

  const handleInteriorAction = (kind: 'market' | 'shipyard' | 'navigation' | 'ship' | 'parts' | null) => {
    if (kind === 'market') setWarehouseOpen(true)
    if (kind === 'shipyard' || kind === 'parts' || kind === 'ship') setShipyardOpen(true)
    if (kind === 'navigation') setNavigationOpen(true)
    if (kind) setInteriorEntity(null)
  }

  const currentResources = moonLocation?.location_resources ?? []
  const spaceportName = spaceportEntity?.name ?? spaceportEntity?.entity_id ?? 'Lande- und Cargo-Zone'

  return <section className="noxia-dashboard-moon-surface" aria-label="Mondoberfläche Shackleton">
    <div className="moon-context-label"><strong>LRO / LOLA · Shackleton</strong><span>NASA-Terrainkontext · lokales ENU-Netz bleibt metrisch separat</span></div>
    <ShackletonSurfaceMap onOpenWorldObject={openWorldObject} />

    {spaceportEntity && <SpaceportOverlay buildingTypeId="landing_pad_moon" buildingName={spaceportName} onClose={() => setSpaceportEntity(null)} onOpenNavigation={() => { setSpaceportEntity(null); setNavigationOpen(true) }} onOpenMaintenance={() => { setSpaceportEntity(null); setShipyardOpen(true) }} onOpenCargo={() => { setSpaceportEntity(null); setWarehouseOpen(true) }} />}

    {navigationOpen && <div className="moon-modal" onClick={event => event.target === event.currentTarget && setNavigationOpen(false)}><div className="moon-navigation-panel"><div className="moon-modal-head"><strong>🧭 Navigation · Shackleton</strong><button type="button" onClick={() => setNavigationOpen(false)}>×</button></div><SolarSystem currentTick={tick} shipRange={shipRange} currentLocation="moon" /></div></div>}

    <ShipyardOverlay open={shipyardOpen} onClose={() => setShipyardOpen(false)} currentShipTypeId={shipTypeId ?? 'freighter_mk1'} credits={credits} onBuyShip={async type => {
      const token = await getToken()
      const response = await fetch(`/api/game/ships?action=buy&shipTypeId=${encodeURIComponent(type)}`, { headers: { Authorization: `Bearer ${token}` } })
      const payload = await response.json()
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Schiffskauf fehlgeschlagen')
      await loadFromServer()
      setShipyardOpen(false)
    }} />

    {warehouseOpen && <WarehouseOverlay locationSlug={'moon' as LocationSlug} locationName={moonLocation?.name ?? 'Shackleton'} prices={prices} resources={currentResources} orders={moonOrders} cargo={cargo as Record<ResourceType, number>} cargoMax={cargoMax} credits={credits} onTrade={async (resource, mode, amount, price) => {
      const result = mode === 'buy' ? await buy(resource, price, amount) : await sell(resource, price, amount)
      return result.ok
    }} onFulfillOrder={async (orderId, agreedReward) => {
      const token = await getToken()
      const response = await fetch(`/api/game/orders?action=fulfill&orderId=${encodeURIComponent(orderId)}&agreedReward=${Math.round(agreedReward)}`, { headers: { Authorization: `Bearer ${token}` } })
      const payload = await response.json()
      if (payload.ok) await loadFromServer()
      return Boolean(payload.ok)
    }} onClose={() => setWarehouseOpen(false)} />}

    {interiorEntity && <div className="moon-modal" onClick={event => event.target === event.currentTarget && setInteriorEntity(null)}><div className="moon-interior-panel"><BuildingInterior entity={{ ...interiorEntity, entity_id: INTERIOR_ALIAS[interiorEntity.entity_id ?? ''] ?? interiorEntity.entity_id ?? 'unknown', entity_type: 'building', tile_row: 0, tile_col: 0, profile_id: interiorEntity.profile_id ?? null, owner_class: interiorEntity.owner_class ?? 'STATE' } as any} userId="" locationResources={currentResources as any} credits={credits} population={Number(moonLocation?.population ?? 0)} hasShipyard={Boolean(moonLocation?.has_shipyard)} currentTick={tick} shipRange={shipRange} currentLocationSlug="moon" onClose={() => setInteriorEntity(null)} onAction={handleInteriorAction} /></div></div>}

    <style jsx>{`
      .noxia-dashboard-moon-surface{position:fixed;top:var(--noxia-topbar-h,44px);right:0;bottom:0;left:0;z-index:1000;overflow:auto;background:#070b0f url('${NASA_LOLA_SHACKLETON}') center 32%/cover fixed no-repeat;overscroll-behavior:contain}.noxia-dashboard-moon-surface::before{content:'';position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;pointer-events:none;background:linear-gradient(180deg,rgba(5,9,13,.38),rgba(5,9,13,.78));z-index:0}.moon-context-label{position:fixed;z-index:2;left:18px;bottom:calc(var(--noxia-cockpit-clearance,76px) + 10px);display:flex;flex-direction:column;gap:2px;padding:7px 10px;border:1px solid rgba(189,213,225,.2);border-radius:8px;background:rgba(5,12,18,.72);backdrop-filter:blur(8px);color:#d7e3e8;font:10px/1.25 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;pointer-events:none}.moon-context-label strong{color:#d7b96e;letter-spacing:.08em}.moon-context-label span{color:#8ea2ad}.moon-modal{position:fixed;inset:0;z-index:2400;display:grid;place-items:center;padding:1rem;background:rgba(2,7,12,.86)}.moon-navigation-panel,.moon-interior-panel{width:min(960px,96vw);max-height:94vh;overflow:auto;border:1px solid #40596a;border-radius:14px;background:#eef1ed;box-shadow:0 18px 60px rgba(0,0,0,.5)}.moon-navigation-panel{padding:1rem;background:#070b14}.moon-modal-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;color:#d7b96e;font:800 11px/1.2 ui-monospace,monospace}.moon-modal-head button{border:1px solid #314756;border-radius:6px;background:transparent;color:#9cb0bb;padding:3px 9px;cursor:pointer}.noxia-dashboard-moon-surface :global(.earth-shell){position:relative;z-index:1}
    `}</style>
  </section>
}
