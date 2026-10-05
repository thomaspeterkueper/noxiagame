'use client'

import { useEffect, useMemo, useState } from 'react'
import { useGameStore, type LocationSlug, type ResourceType } from '@/lib/store/gameStore'
import { getToken } from '@/lib/supabase/auth'
import { useGameModeStore } from '@/lib/store/gameModeStore'
import PlanetaryWalkableSurface from '@/app/components/PlanetaryWalkableSurface'
import { deriveStickneyFleetMapMarkers } from '@/lib/game/vehicles/stickneyFleetMotion'
import { deriveSurfaceScienceObjects } from '@/lib/game/science/surfaceScience'
import PlanetarySurfaceMap, { type MobileSurfaceObject, type PlanetarySurfaceEntity, type PreparedCorridor } from '@/app/components/PlanetarySurfaceMap'
import SurfaceContextBadge from '@/app/components/SurfaceContextBadge'
import SurfaceScienceLayerPanel from '@/app/components/SurfaceScienceLayerPanel'
import {
  PHOBOS_BASE_ALPHA_LOGISTICS,
  PHOBOS_BASE_ALPHA_NODES,
} from '@/lib/game/seeds/phobosBaseAlphaSeed'
import BuildingInterior from './BuildingInterior'
import BuildingOverlayShell from './BuildingOverlayShell'
import PhobosModuleWorkshopPanel from './PhobosModuleWorkshopPanel'
import PhobosRobotFleetPanel from './PhobosRobotFleetPanel'
import ShipyardOverlay from './ShipyardOverlay'
import SolarSystem from './SolarSystem'
import SpaceportOverlay from './SpaceportOverlay'
import SurfaceLogisticsOverlay from './SurfaceLogisticsOverlay'
import WarehouseOverlay from './WarehouseOverlay'

type Props = { locations: any[]; prices: any[]; orders: any[] }
type ProspectMarker = { id:string; resourceType:string; xM:number; yM:number; tier:string|null; confidence:string|null; provenance?:string|null; discoveredAt?:string|null; sampledAt?:string|null }
const INTERIOR_ALIAS: Record<string, string> = { landing_pad_phobos: 'landing_pad', surface_workshop: 'shipyard', surface_comms: 'command_center' }

const PHOBOS_CORRIDORS: PreparedCorridor[] = (() => {
  const nodes = new Map(PHOBOS_BASE_ALPHA_NODES.map(node => [node.id, node]))
  const seen = new Set<string>()
  return PHOBOS_BASE_ALPHA_LOGISTICS.flatMap((edge, index) => {
    const from = nodes.get(edge.from), to = nodes.get(edge.to)
    if (!from || !to) return []
    const physicalKey = [edge.from, edge.to].sort().join('::')
    if (seen.has(physicalKey)) return []
    seen.add(physicalKey)
    const enclosed = edge.corridor === 'pressurized-corridor' || edge.corridor === 'cargo-transfer-link'
    return [{ id:`phobos-corridor-${index}`, kind:enclosed?'hardened-road':'prepared-track', points:[{xM:from.xM,yM:from.yM},{xM:to.xM,yM:to.yM}] }]
  })
})()

const scienceAccent=(value:string)=>value==='engineering'?'#b18adf':value==='direct'?'#e6a04b':value==='sampled'?'#61d6c4':'#d7b55d'

export default function DashboardPhobosSurface({ locations, prices, orders }: Props) {
  const location=useGameStore(s=>s.location),credits=useGameStore(s=>s.credits),cargo=useGameStore(s=>s.cargo),cargoMax=useGameStore(s=>s.cargoMax),shipTypeId=useGameStore(s=>s.shipTypeId),shipRange=useGameStore(s=>s.shipRange),buy=useGameStore(s=>s.buy),sell=useGameStore(s=>s.sell),loadFromServer=useGameStore(s=>s.loadFromServer)
  const mode=useGameModeStore(s=>s.mode),enterPlanning=useGameModeStore(s=>s.enterPlanning)
  const [interiorEntity,setInteriorEntity]=useState<PlanetarySurfaceEntity|null>(null),[dockEntity,setDockEntity]=useState<PlanetarySurfaceEntity|null>(null),[navigationOpen,setNavigationOpen]=useState(false),[shipyardOpen,setShipyardOpen]=useState(false),[warehouseOpen,setWarehouseOpen]=useState(false),[logisticsOpen,setLogisticsOpen]=useState(false),[tick,setTick]=useState(0)
  const [fleetRobots,setFleetRobots]=useState<any[]>([]),[fleetJobs,setFleetJobs]=useState<any[]>([]),[fleetProspects,setFleetProspects]=useState<ProspectMarker[]>([]),[fleetSamples,setFleetSamples]=useState<any[]>([]),[fleetDrillJobs,setFleetDrillJobs]=useState<any[]>([]),[fleetNow,setFleetNow]=useState(()=>Date.now())
  const [selectedRobotId,setSelectedRobotId]=useState<string|null>(null),[scienceLayerEnabled,setScienceLayerEnabled]=useState(true),[selectedScienceId,setSelectedScienceId]=useState<string|null>(null)
  const phobosLocation=useMemo(()=>locations.find((item:any)=>item.slug==='phobos')??null,[locations]),phobosOrders=useMemo(()=>orders.filter((item:any)=>item.locations?.slug==='phobos'),[orders])
  useEffect(()=>{if(location!=='phobos')return;let cancelled=false;fetch('/api/game/world',{cache:'no-store'}).then(r=>r.json()).then(p=>{if(!cancelled)setTick(Number(p?.stats?.tickNumber??0))}).catch(()=>{});return()=>{cancelled=true}},[location])
  useEffect(()=>{if(location!=='phobos')return;let cancelled=false;(async()=>{try{const token=await getToken();if(!token||cancelled)return;await fetch('/api/game/build/spatial/terrain-sync',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({location:'phobos'})})}catch{}})();return()=>{cancelled=true}},[location])
  useEffect(()=>{if(location!=='phobos')return;let cancelled=false;const loadSurfaceScience=async()=>{if(document.visibilityState!=='visible')return;try{const token=await getToken();if(!token||cancelled)return;const headers={Authorization:`Bearer ${token}`};const responses=await Promise.all([fetch('/api/game/phobos/pilot-extraction',{headers}),fetch('/api/game/phobos/prospect',{headers}),fetch('/api/game/phobos/sample-analysis',{headers}),fetch('/api/game/phobos/drilling',{headers})]);const payloads=await Promise.all(responses.map(response=>response.json()));if(cancelled)return;const [fleetResponse,prospectResponse,sampleResponse,drillResponse]=responses,[fleetPayload,prospectPayload,samplePayload,drillPayload]=payloads;if(fleetResponse.ok){setFleetRobots(Array.isArray(fleetPayload.robots)?fleetPayload.robots:[]);setFleetJobs(Array.isArray(fleetPayload.jobs)?fleetPayload.jobs:[])}if(prospectResponse.ok)setFleetProspects(Array.isArray(prospectPayload.discoveries)?prospectPayload.discoveries:[]);if(sampleResponse.ok)setFleetSamples(Array.isArray(samplePayload.samples)?samplePayload.samples:[]);if(drillResponse.ok)setFleetDrillJobs(Array.isArray(drillPayload.jobs)?drillPayload.jobs:[])}catch{}};void loadSurfaceScience();const timer=window.setInterval(()=>void loadSurfaceScience(),60000);const onVisibility=()=>{if(document.visibilityState==='visible')void loadSurfaceScience()};document.addEventListener('visibilitychange',onVisibility);return()=>{cancelled=true;window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisibility)}},[location])
  useEffect(()=>{if(location!=='phobos')return;const timer=window.setInterval(()=>setFleetNow(Date.now()),1000);return()=>window.clearInterval(timer)},[location])
  const robotMapObjects=useMemo<MobileSurfaceObject[]>(()=>deriveStickneyFleetMapMarkers(fleetRobots,fleetJobs,fleetNow),[fleetRobots,fleetJobs,fleetNow])
  const scienceObjects=useMemo(()=>deriveSurfaceScienceObjects({prospects:fleetProspects,samples:fleetSamples,drillJobs:fleetDrillJobs,pilotJobs:fleetJobs}),[fleetProspects,fleetSamples,fleetDrillJobs,fleetJobs])
  const scienceMapObjects=useMemo<MobileSurfaceObject[]>(()=>scienceObjects.map(item=>({id:`science:${item.id}`,label:item.label,role:item.evidenceClass,status:item.provenance,phase:`${item.evidenceLabel} · ${item.confidence}`,xM:item.xM,yM:item.yM,accent:scienceAccent(item.evidenceClass)})),[scienceObjects])
  const surfaceMapObjects=useMemo<MobileSurfaceObject[]>(()=>scienceLayerEnabled?[...robotMapObjects,...scienceMapObjects]:robotMapObjects,[robotMapObjects,scienceMapObjects,scienceLayerEnabled])
  if(location!=='phobos')return null

  const openWorldObject=(entity:PlanetarySurfaceEntity)=>{const id=entity.entity_id??'';if(id==='landing_pad_phobos'){setDockEntity(entity);return}if(id==='warehouse'){setWarehouseOpen(true);return}if(id==='surface_workshop'){setShipyardOpen(true);return}if(id==='surface_comms'){setNavigationOpen(true);return}if(id==='rover_yard'){setLogisticsOpen(true);return}setInteriorEntity(entity)}
  const openSurfaceObject=(object:MobileSurfaceObject)=>{if(object.id.startsWith('science:')){setSelectedScienceId(object.id.slice(8));setSelectedRobotId(null);return}setSelectedRobotId(object.id);setSelectedScienceId(null)}
  const handleInteriorAction=(kind:'market'|'shipyard'|'navigation'|'ship'|'parts'|null)=>{if(kind==='market')setWarehouseOpen(true);if(kind==='shipyard'||kind==='parts'||kind==='ship')setShipyardOpen(true);if(kind==='navigation')setNavigationOpen(true);if(kind)setInteriorEntity(null)}
  const currentResources=phobosLocation?.location_resources??[],dockName=dockEntity?.name??dockEntity?.entity_id??'Andock- und Cargo-Zone'
  const interiorName=interiorEntity?.name??interiorEntity?.entity_id??'Anlage'

  if(mode==='colony')return <>
    <PlanetaryWalkableSurface locationSlug="phobos" body="phobos" title="Stickney" corridors={PHOBOS_CORRIDORS} mobileObjects={surfaceMapObjects} onOpenWorldObject={setInteriorEntity} onClose={enterPlanning}/>
    {interiorEntity&&<BuildingOverlayShell eyebrow="GEBÄUDE · INNENRAUM" title={interiorName} subtitle="Gemeinsamer Scene-/Interaction-Zugang" onClose={()=>setInteriorEntity(null)} width={1020}><BuildingInterior entity={{...interiorEntity,entity_id:INTERIOR_ALIAS[interiorEntity.entity_id??'']??interiorEntity.entity_id??'unknown',entity_type:'building',tile_row:0,tile_col:0,profile_id:interiorEntity.profile_id??null,owner_class:interiorEntity.owner_class??'STATE'} as any} userId="" locationResources={currentResources as any} credits={credits} population={Number(phobosLocation?.population??0)} hasShipyard={Boolean(phobosLocation?.has_shipyard)} currentTick={tick} shipRange={shipRange} currentLocationSlug="phobos" onClose={()=>setInteriorEntity(null)} onAction={handleInteriorAction}/></BuildingOverlayShell>}
  </>

  return <section className="noxia-dashboard-phobos-surface" aria-label="Phobos-Oberfläche Stickney">
    <SurfaceContextBadge title="MEX/HRSC · Stickney-Nordrand" detail={`asymmetrisches Druck-/Tether-Netz · gemeinsame Funde · ${scienceObjects.length} wissenschaftliche Objekte`} />
    <PhobosRobotFleetPanel selectedRobotId={selectedRobotId} onSelectedRobotChange={setSelectedRobotId}/>
    <PhobosModuleWorkshopPanel/>
    <SurfaceScienceLayerPanel enabled={scienceLayerEnabled} onToggle={()=>{setScienceLayerEnabled(value=>!value);if(scienceLayerEnabled)setSelectedScienceId(null)}} objects={scienceObjects} selectedId={selectedScienceId} onSelect={setSelectedScienceId} onOpenOperations={()=>setLogisticsOpen(true)}/>
    <PlanetarySurfaceMap locationSlug="phobos" body="phobos" mapLabel="Spielbare Phobos-Karte (Stickney)" terrainLabel="MEX / HRSC DEM" minimumWorldSpanM={480} corridors={PHOBOS_CORRIDORS} mobileObjects={surfaceMapObjects} onOpenMobileObject={openSurfaceObject} onOpenWorldObject={openWorldObject}/>

    {dockEntity&&<SpaceportOverlay buildingTypeId="landing_pad_phobos" buildingName={dockName} onClose={()=>setDockEntity(null)} onOpenNavigation={()=>{setDockEntity(null);setNavigationOpen(true)}} onOpenMaintenance={()=>{setDockEntity(null);setShipyardOpen(true)}} onOpenCargo={()=>{setDockEntity(null);setWarehouseOpen(true)}}/>}
    {navigationOpen&&<BuildingOverlayShell eyebrow="GEBÄUDE · NAVIGATION" title="Stickney Navigation" subtitle="Sonnensystem, Reichweite und Flugplanung" onClose={()=>setNavigationOpen(false)} width={1080}><div className="navigation-body"><SolarSystem currentTick={tick} shipRange={shipRange} currentLocation="phobos"/></div></BuildingOverlayShell>}
    <ShipyardOverlay open={shipyardOpen} onClose={()=>setShipyardOpen(false)} currentShipTypeId={shipTypeId??'freighter_mk1'} credits={credits} onBuyShip={async type=>{const token=await getToken();const response=await fetch(`/api/game/ships?action=buy&shipTypeId=${encodeURIComponent(type)}`,{headers:{Authorization:`Bearer ${token}`}});const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.error??'Schiffskauf fehlgeschlagen');await loadFromServer();setShipyardOpen(false)}}/>
    {warehouseOpen&&<WarehouseOverlay locationSlug={'phobos' as LocationSlug} locationName={phobosLocation?.name??'Stickney'} prices={prices} resources={currentResources} orders={phobosOrders} cargo={cargo as Record<ResourceType,number>} cargoMax={cargoMax} credits={credits} onTrade={async(resource,mode,amount,price)=>(mode==='buy'?await buy(resource,price,amount):await sell(resource,price,amount)).ok} onFulfillOrder={async(orderId,agreedReward)=>{const token=await getToken();const response=await fetch(`/api/game/orders?action=fulfill&orderId=${encodeURIComponent(orderId)}&agreedReward=${Math.round(agreedReward)}`,{headers:{Authorization:`Bearer ${token}`}});const payload=await response.json();if(payload.ok)await loadFromServer();return Boolean(payload.ok)}} onClose={()=>setWarehouseOpen(false)}/>}
    {logisticsOpen&&<SurfaceLogisticsOverlay locationSlug="phobos" locationName="Stickney · Fahrzeughof" onClose={()=>setLogisticsOpen(false)}/>}
    {interiorEntity&&<BuildingOverlayShell eyebrow="GEBÄUDE · INNENRAUM" title={interiorName} subtitle="Personen, Räume und gebäudespezifische Funktionen" onClose={()=>setInteriorEntity(null)} width={1020}><BuildingInterior entity={{...interiorEntity,entity_id:INTERIOR_ALIAS[interiorEntity.entity_id??'']??interiorEntity.entity_id??'unknown',entity_type:'building',tile_row:0,tile_col:0,profile_id:interiorEntity.profile_id??null,owner_class:interiorEntity.owner_class??'STATE'} as any} userId="" locationResources={currentResources as any} credits={credits} population={Number(phobosLocation?.population??0)} hasShipyard={Boolean(phobosLocation?.has_shipyard)} currentTick={tick} shipRange={shipRange} currentLocationSlug="phobos" onClose={()=>setInteriorEntity(null)} onAction={handleInteriorAction}/></BuildingOverlayShell>}

    <style jsx>{`
      .noxia-dashboard-phobos-surface{position:fixed;top:var(--noxia-topbar-h,44px);right:0;bottom:0;left:0;z-index:1000;overflow:hidden;background:#0a0806;overscroll-behavior:contain}
      .noxia-dashboard-phobos-surface::before{content:'';position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;pointer-events:none;background:radial-gradient(circle at 45% 32%,rgba(90,80,66,.14),transparent 48%),linear-gradient(180deg,#100d0a,#070605 76%);z-index:0}
      .navigation-body{min-height:520px;background:#070b14;border-radius:8px;overflow:hidden}
      .noxia-dashboard-phobos-surface :global(.planetary-shell){position:relative;z-index:1;height:100%;min-height:0;overflow:hidden}
      .noxia-dashboard-phobos-surface :global(.planetary-map polyline[stroke="#a59e8b"]){stroke:#d8d1c3;stroke-width:5.5;opacity:.9}
      .noxia-dashboard-phobos-surface :global(.planetary-map polyline[stroke="#8a8577"]){stroke:#b88950;stroke-width:2.2;stroke-dasharray:7 6;opacity:.82}
    `}</style>
  </section>
}
