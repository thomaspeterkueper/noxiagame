'use client'

import { useEffect, useMemo } from 'react'
import { simulateColonyTick } from '@/lib/game/colonySimulation'
import { useGameStore } from '@/lib/store/gameStore'
import { useGameModeStore } from '@/lib/store/gameModeStore'
import { useColonyStateStore } from '@/lib/store/colonyStateStore'
import WalkableColony from './WalkableColony'
import ColonyConversationLayer from './ColonyConversationLayer'
import ColonyHudOverlay, { ColonyHudStyles } from './ColonyHudOverlay'

const chrome=<style>{`
.noxia-primary-colony{position:fixed;z-index:900;left:0;right:0;top:72px;bottom:0;overflow:hidden;background:#081019;box-shadow:0 -8px 30px rgba(7,14,23,.18)}
.noxia-primary-loading{position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(circle at 50% 44%,#182635 0,#0b151f 42%,#071019 100%);color:#dbe7ed;font-family:monospace}
.noxia-primary-loading>div{text-align:center}.noxia-primary-loading b{display:block;color:#f1d57a;font-size:15px;letter-spacing:.12em}.noxia-primary-loading span{display:block;margin-top:8px;color:#7890a2;font-size:10px;letter-spacing:.08em}
.noxia-return-colony{position:fixed;z-index:1180;left:50%;top:78px;transform:translateX(-50%);border:1px solid #2c78b6;border-radius:7px;background:#08243b;color:#e7f3fb;font:700 11px system-ui;padding:7px 11px;cursor:pointer}
.noxia-interior{position:absolute;inset:0;z-index:130;background:linear-gradient(180deg,#05101c33,#05101cd9),url('/assets/buildings/habitat/mars/interior-main.webp') center/cover no-repeat;color:#edf5fa;font-family:system-ui}.noxia-interior-head{position:absolute;left:18px;right:18px;top:18px;display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border:1px solid #38546c;border-radius:9px;background:#071421e8}.noxia-interior-head small{display:block;color:#79a6c7;font-size:9px;letter-spacing:.14em}.noxia-interior-head b{font-size:17px}.noxia-interior-head button{border:1px solid #3976a5;border-radius:7px;background:#0a3150;color:#fff;padding:8px 12px;font-weight:800;cursor:pointer}.noxia-interior-card{position:absolute;left:22px;bottom:22px;width:280px;padding:14px;border:1px solid #35536c;border-radius:9px;background:#071421e8}.noxia-interior-card h3{margin:0 0 7px}.noxia-interior-card p{margin:0;color:#b7c8d4;font-size:11px;line-height:1.55}
@media(max-width:900px){.noxia-primary-colony{top:72px}}
`}</style>

export default function DashboardPrimaryColony(){
 const location=useGameStore(s=>s.location)
 const mode=useGameModeStore(s=>s.mode),interiorBuildingId=useGameModeStore(s=>s.interiorBuildingId),enterColony=useGameModeStore(s=>s.enterColony),enterPlanning=useGameModeStore(s=>s.enterPlanning),enterInterior=useGameModeStore(s=>s.enterInterior),resetForLocation=useGameModeStore(s=>s.resetForLocation)
 const userId=useColonyStateStore(s=>s.userId),locations=useColonyStateStore(s=>s.locations),entities=useColonyStateStore(s=>s.entities),builds=useColonyStateStore(s=>s.builds),residents=useColonyStateStore(s=>s.residents),loading=useColonyStateStore(s=>s.loading),error=useColonyStateStore(s=>s.error),refresh=useColonyStateStore(s=>s.refresh)

 useEffect(()=>{resetForLocation()},[location,resetForLocation])
 useEffect(()=>{
   let live=true
   refresh(location)
   const timer=setInterval(()=>{if(live)refresh(location,{background:true})},30000)
   return()=>{live=false;clearInterval(timer)}
 },[location,refresh])

 const current=locations.find(l=>l.slug===location)
 const isStation=current?.location_type==='station'||location==='prometheus'
 const localEntities=useMemo(()=>!current?[]:entities.filter((e:any)=>e.locations?.slug===location||e.location_id===current.id),[entities,current,location])
 const localBuilds=useMemo(()=>!current?[]:builds.filter((b:any)=>b.locations?.slug===location||b.location_id===current.id),[builds,current,location])
 const interior=useMemo(()=>mode==='interior'&&interiorBuildingId?localEntities.find((b:any)=>b.id===interiorBuildingId)??null:null,[mode,interiorBuildingId,localEntities])
 const simulation=useMemo(()=>simulateColonyTick(
   Array.isArray(current?.location_resources) ? current.location_resources as any[] : [],
   localEntities,
   current?.population ?? 0,
 ),[current?.location_resources,current?.population,localEntities])

 useEffect(()=>{if(mode==='interior'&&current&&userId&&!interior)enterColony()},[mode,current,userId,interior,enterColony])

 if(isStation)return null
 if(mode==='planning')return <>{chrome}<button className="noxia-return-colony" onClick={enterColony}>◈ Zur Kolonie</button></>
 if(loading||!current||!userId)return <>{chrome}<div className="noxia-primary-colony"><div className="noxia-primary-loading"><div><b>NOXIA · {location.toUpperCase()}</b><span>{error?'SYNCHRONISIERUNG WIRD ERNEUT VERSUCHT …':'KOLONIE WIRD SYNCHRONISIERT …'}</span></div></div></div></>

 if(mode==='interior'&&interior)return <>{chrome}<div className="noxia-primary-colony"><div className="noxia-interior"><div className="noxia-interior-head"><div><small>INNENRAUM · {current.name??location}</small><b>{interior.entity_id==='habitat'?'Habitat · Gemeinschaftsmodul':'Anlageninnenraum'}</b></div><button onClick={enterColony}>← Zur Kolonie</button></div><div className="noxia-interior-card"><h3>{interior.entity_id==='habitat'?'Persönliche Ebene':'Technischer Innenraum'}</h3><p>{interior.entity_id==='habitat'?'Aufenthalt, Pflanzen, Arbeitsplätze und Bewohner machen die Kolonie hier als Lebensraum erfahrbar.':'Diese Anlage nutzt vorerst den gemeinsamen Innenraum-Fallback; eigene technische Innenräume folgen als Asset-Slices.'}</p></div></div></div></>

 return <>{chrome}<ColonyHudStyles/><div className="noxia-primary-colony"><WalkableColony locationSlug={location} locationName={current.name??location} population={current.population??0} entities={localEntities as any} pending={localBuilds} residents={residents} ships={[]} locationId={current.id} userId={userId} onClose={enterPlanning} onEnterBuilding={b=>enterInterior(b.id)}/><ColonyConversationLayer locationSlug={location} population={current.population??0} entities={localEntities as any} pending={localBuilds} residents={residents} userId={userId}/><ColonyHudOverlay builds={localBuilds} simulation={simulation}/></div></>
}
