'use client'

import { useEffect, useMemo, useState } from 'react'
import { useGameStore, type LocationSlug, type ResourceType } from '@/lib/store/gameStore'
import { getToken } from '@/lib/supabase/auth'
import ShackletonSurfaceMap, { type MoonSurfaceEntity } from '@/app/moon/ShackletonSurfaceMap'
import BuildingInterior from './BuildingInterior'
import BuildingOverlayShell from './BuildingOverlayShell'
import ShipyardOverlay from './ShipyardOverlay'
import SolarSystem from './SolarSystem'
import SpaceportOverlay from './SpaceportOverlay'
import SurfaceLogisticsOverlay from './SurfaceLogisticsOverlay'
import WarehouseOverlay from './WarehouseOverlay'

const NASA_LOLA_SHACKLETON = 'https://svs.gsfc.nasa.gov/vis/a000000/a004200/a004289/lro_south_pole_print.jpg'
type Props = { locations: any[]; prices: any[]; orders: any[] }
const INTERIOR_ALIAS: Record<string, string> = { landing_pad_moon: 'landing_pad', surface_workshop: 'shipyard', surface_comms: 'command_center' }

export default function DashboardMoonSurface({ locations, prices, orders }: Props) {
  const location=useGameStore(s=>s.location),credits=useGameStore(s=>s.credits),cargo=useGameStore(s=>s.cargo),cargoMax=useGameStore(s=>s.cargoMax),shipTypeId=useGameStore(s=>s.shipTypeId),shipRange=useGameStore(s=>s.shipRange),buy=useGameStore(s=>s.buy),sell=useGameStore(s=>s.sell),loadFromServer=useGameStore(s=>s.loadFromServer)
  const [interiorEntity,setInteriorEntity]=useState<MoonSurfaceEntity|null>(null),[spaceportEntity,setSpaceportEntity]=useState<MoonSurfaceEntity|null>(null),[navigationOpen,setNavigationOpen]=useState(false),[shipyardOpen,setShipyardOpen]=useState(false),[warehouseOpen,setWarehouseOpen]=useState(false),[logisticsOpen,setLogisticsOpen]=useState(false),[tick,setTick]=useState(0)
  const moonLocation=useMemo(()=>locations.find((item:any)=>item.slug==='moon')??null,[locations]),moonOrders=useMemo(()=>orders.filter((item:any)=>item.locations?.slug==='moon'),[orders])
  useEffect(()=>{if(location!=='moon')return;let cancelled=false;fetch('/api/game/world',{cache:'no-store'}).then(r=>r.json()).then(p=>{if(!cancelled)setTick(Number(p?.stats?.tickNumber??0))}).catch(()=>{});return()=>{cancelled=true}},[location])
  if(location!=='moon')return null

  const openWorldObject=(entity:MoonSurfaceEntity)=>{const id=entity.entity_id??'';if(id==='landing_pad_moon'){setSpaceportEntity(entity);return}if(id==='warehouse'){setWarehouseOpen(true);return}if(id==='surface_workshop'){setShipyardOpen(true);return}if(id==='surface_comms'){setNavigationOpen(true);return}if(id==='rover_yard'){setLogisticsOpen(true);return}setInteriorEntity(entity)}
  const handleInteriorAction=(kind:'market'|'shipyard'|'navigation'|'ship'|'parts'|null)=>{if(kind==='market')setWarehouseOpen(true);if(kind==='shipyard'||kind==='parts'||kind==='ship')setShipyardOpen(true);if(kind==='navigation')setNavigationOpen(true);if(kind)setInteriorEntity(null)}
  const currentResources=moonLocation?.location_resources??[],spaceportName=spaceportEntity?.name??spaceportEntity?.entity_id??'Lande- und Cargo-Zone'
  const interiorName=interiorEntity?.name??interiorEntity?.entity_id??'Anlage'

  return <section className="noxia-dashboard-moon-surface" aria-label="Mondoberfläche Shackleton">
    <div className="moon-context-label"><strong>LRO / LOLA · Shackleton</strong><span>LRO-Bild = visueller Kontext · LOLA-Höhen/ENU = metrische Wahrheit</span></div>
    <ShackletonSurfaceMap onOpenWorldObject={openWorldObject}/>

    {spaceportEntity&&<SpaceportOverlay buildingTypeId="landing_pad_moon" buildingName={spaceportName} onClose={()=>setSpaceportEntity(null)} onOpenNavigation={()=>{setSpaceportEntity(null);setNavigationOpen(true)}} onOpenMaintenance={()=>{setSpaceportEntity(null);setShipyardOpen(true)}} onOpenCargo={()=>{setSpaceportEntity(null);setWarehouseOpen(true)}}/>}

    {navigationOpen&&<BuildingOverlayShell eyebrow="GEBÄUDE · NAVIGATION" title="Shackleton Navigation" subtitle="Sonnensystem, Reichweite und Flugplanung" onClose={()=>setNavigationOpen(false)} width={1080}><div className="navigation-body"><SolarSystem currentTick={tick} shipRange={shipRange} currentLocation="moon"/></div></BuildingOverlayShell>}

    <ShipyardOverlay open={shipyardOpen} onClose={()=>setShipyardOpen(false)} currentShipTypeId={shipTypeId??'freighter_mk1'} credits={credits} onBuyShip={async type=>{const token=await getToken();const response=await fetch(`/api/game/ships?action=buy&shipTypeId=${encodeURIComponent(type)}`,{headers:{Authorization:`Bearer ${token}`}});const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.error??'Schiffskauf fehlgeschlagen');await loadFromServer();setShipyardOpen(false)}}/>

    {warehouseOpen&&<WarehouseOverlay locationSlug={'moon' as LocationSlug} locationName={moonLocation?.name??'Shackleton'} prices={prices} resources={currentResources} orders={moonOrders} cargo={cargo as Record<ResourceType,number>} cargoMax={cargoMax} credits={credits} onTrade={async(resource,mode,amount,price)=>(mode==='buy'?await buy(resource,price,amount):await sell(resource,price,amount)).ok} onFulfillOrder={async(orderId,agreedReward)=>{const token=await getToken();const response=await fetch(`/api/game/orders?action=fulfill&orderId=${encodeURIComponent(orderId)}&agreedReward=${Math.round(agreedReward)}`,{headers:{Authorization:`Bearer ${token}`}});const payload=await response.json();if(payload.ok)await loadFromServer();return Boolean(payload.ok)}} onClose={()=>setWarehouseOpen(false)}/>} 

    {logisticsOpen&&<SurfaceLogisticsOverlay locationSlug="moon" locationName="Shackleton · Roverhof" onClose={()=>setLogisticsOpen(false)}/>} 

    {interiorEntity&&<BuildingOverlayShell eyebrow="GEBÄUDE · INNENRAUM" title={interiorName} subtitle="Personen, Räume und gebäudespezifische Funktionen" onClose={()=>setInteriorEntity(null)} width={1020}><BuildingInterior entity={{...interiorEntity,entity_id:INTERIOR_ALIAS[interiorEntity.entity_id??'']??interiorEntity.entity_id??'unknown',entity_type:'building',tile_row:0,tile_col:0,profile_id:interiorEntity.profile_id??null,owner_class:interiorEntity.owner_class??'STATE'} as any} userId="" locationResources={currentResources as any} credits={credits} population={Number(moonLocation?.population??0)} hasShipyard={Boolean(moonLocation?.has_shipyard)} currentTick={tick} shipRange={shipRange} currentLocationSlug="moon" onClose={()=>setInteriorEntity(null)} onAction={handleInteriorAction}/></BuildingOverlayShell>}

    <style jsx>{`
      .noxia-dashboard-moon-surface{position:fixed;top:var(--noxia-topbar-h,44px);right:0;bottom:0;left:0;z-index:1000;overflow:hidden;background:#070b0f url('${NASA_LOLA_SHACKLETON}') center 32%/cover fixed no-repeat;overscroll-behavior:contain}
      .noxia-dashboard-moon-surface::before{content:'';position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;pointer-events:none;background:linear-gradient(180deg,rgba(5,9,13,.22),rgba(5,9,13,.62));z-index:0}
      .moon-context-label{position:fixed;z-index:2;left:18px;bottom:calc(var(--noxia-cockpit-clearance,76px) + 10px);display:flex;flex-direction:column;gap:2px;padding:7px 10px;border:1px solid rgba(189,213,225,.2);border-radius:8px;background:rgba(5,12,18,.72);backdrop-filter:blur(8px);color:#d7e3e8;font:10px/1.25 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;pointer-events:none}.moon-context-label strong{color:#d7b96e;letter-spacing:.08em}.moon-context-label span{color:#8ea2ad}.navigation-body{min-height:520px;background:#070b14;border-radius:8px;overflow:hidden}
      .noxia-dashboard-moon-surface :global(.earth-shell){position:relative;z-index:1;height:100%;min-height:0;overflow:hidden;background:transparent!important}
      .noxia-dashboard-moon-surface :global(.earth-map){background:linear-gradient(145deg,rgba(26,29,29,.28),rgba(5,8,9,.38)),url('${NASA_LOLA_SHACKLETON}') center 48%/cover no-repeat!important;border-color:rgba(196,205,202,.35)!important;box-shadow:inset 0 0 90px rgba(0,0,0,.34),0 16px 45px rgba(0,0,0,.28)!important}
      .noxia-dashboard-moon-surface :global(.earth-map svg){background:transparent!important}
      .noxia-dashboard-moon-surface :global(.earth-map svg>rect:first-of-type){fill:transparent!important}
      .noxia-dashboard-moon-surface :global(.earth-map svg>g>rect:first-child){opacity:.16!important}
      .noxia-dashboard-moon-surface :global(.earth-map svg>g>g:first-of-type rect){opacity:.34!important;mix-blend-mode:multiply}
      .noxia-dashboard-moon-surface :global(.earth-lower-card),.noxia-dashboard-moon-surface :global(.earth-foot){display:none!important}
    `}</style>
  </section>
}
