'use client'

import { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '@/lib/store/gameStore'
import { useGameModeStore } from '@/lib/store/gameModeStore'
import { useColonyStateStore } from '@/lib/store/colonyStateStore'
import { getToken } from '@/lib/supabase/auth'
import PlanetarySurfaceMap, { type PlanetarySurfaceEntity } from '@/app/components/PlanetarySurfaceMap'
import PlanetaryWalkableSurface from '@/app/components/PlanetaryWalkableSurface'
import SurfaceContextBadge from '@/app/components/SurfaceContextBadge'
import BuildingInterior from './BuildingInterior'
import BuildingOverlayShell from './BuildingOverlayShell'

export default function DashboardMarsSurface(){
  const location=useGameStore(state=>state.location)
  const credits=useGameStore(state=>state.credits)
  const shipRange=useGameStore(state=>state.shipRange)
  const mode=useGameModeStore(state=>state.mode)
  const enterPlanning=useGameModeStore(state=>state.enterPlanning)
  const locations=useColonyStateStore(state=>state.locations)
  const userId=useColonyStateStore(state=>state.userId)
  const [interiorEntity,setInteriorEntity]=useState<PlanetarySurfaceEntity|null>(null)

  const marsLocation=useMemo(()=>locations.find(item=>item.slug==='mars')??null,[locations])
  const currentResources=Array.isArray(marsLocation?.location_resources)?marsLocation.location_resources:[]

  useEffect(()=>{
    if(location!=='mars')return
    let cancelled=false
    ;(async()=>{
      try{
        const token=await getToken()
        if(!token||cancelled)return
        await fetch('/api/game/build/spatial/terrain-sync',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({location:'mars'})})
      }catch{}
    })()
    return()=>{cancelled=true}
  },[location])

  useEffect(()=>{if(location!=='mars')setInteriorEntity(null)},[location])

  if(location!=='mars')return null

  const openWorldObject=(entity:PlanetarySurfaceEntity)=>setInteriorEntity(entity)
  const interiorName=interiorEntity?.name??interiorEntity?.entity_id??'Mars-Anlage'

  if(mode==='colony')return <>
    <PlanetaryWalkableSurface
      locationSlug="mars"
      body="mars"
      title="Tharsis Hub"
      onOpenWorldObject={openWorldObject}
      onClose={enterPlanning}
    />
    {interiorEntity&&<BuildingOverlayShell eyebrow="MARS · INNENRAUM" title={interiorName} subtitle="Persistentes Weltgebäude · gemeinsamer Interior-Pfad" onClose={()=>setInteriorEntity(null)} width={1020}>
      <BuildingInterior
        entity={{...interiorEntity,entity_type:'building',tile_row:0,tile_col:0,profile_id:interiorEntity.profile_id??null,owner_class:interiorEntity.owner_class??'STATE'} as any}
        userId={userId??''}
        locationResources={currentResources as any}
        credits={credits}
        population={Number(marsLocation?.population??0)}
        hasShipyard={Boolean((marsLocation as any)?.has_shipyard)}
        currentTick={0}
        shipRange={shipRange}
        currentLocationSlug="mars"
        onClose={()=>setInteriorEntity(null)}
      />
    </BuildingOverlayShell>}
  </>

  return <section className="noxia-dashboard-mars-surface" aria-label="Marsoberfläche Tharsis">
    <SurfaceContextBadge title="MOLA · Tharsis Hub" detail="planetozentrischer Mars-Frame · MOLA-Terrain · gemeinsamer Planetary-Surface-Renderer"/>
    <PlanetarySurfaceMap
      locationSlug="mars"
      body="mars"
      mapLabel="Spielbare Mars-Karte (Tharsis Hub)"
      terrainLabel="MGS / MOLA"
      minimumWorldSpanM={700}
      onOpenWorldObject={openWorldObject}
    />
    {interiorEntity&&<BuildingOverlayShell eyebrow="MARS · INNENRAUM" title={interiorName} subtitle="Persistentes Weltgebäude · gemeinsamer Interior-Pfad" onClose={()=>setInteriorEntity(null)} width={1020}>
      <BuildingInterior
        entity={{...interiorEntity,entity_type:'building',tile_row:0,tile_col:0,profile_id:interiorEntity.profile_id??null,owner_class:interiorEntity.owner_class??'STATE'} as any}
        userId={userId??''}
        locationResources={currentResources as any}
        credits={credits}
        population={Number(marsLocation?.population??0)}
        hasShipyard={Boolean((marsLocation as any)?.has_shipyard)}
        currentTick={0}
        shipRange={shipRange}
        currentLocationSlug="mars"
        onClose={()=>setInteriorEntity(null)}
      />
    </BuildingOverlayShell>}
    <div className="mars-migration-note">Legacy-Straßentiles werden nicht mehr als eigener Spielraum verwendet; begehbare Wege und Gebäude kommen aus derselben planetaren Surface-Geometrie.</div>
    <style jsx>{`
      .noxia-dashboard-mars-surface{position:fixed;top:var(--noxia-topbar-h,44px);right:0;bottom:0;left:0;z-index:1000;overflow:hidden;background:#170d09;overscroll-behavior:contain}
      .noxia-dashboard-mars-surface::before{content:'';position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;pointer-events:none;background:radial-gradient(circle at 45% 32%,rgba(142,82,57,.18),transparent 48%),linear-gradient(180deg,#25130d,#100906 76%);z-index:0}
      .noxia-dashboard-mars-surface :global(.planetary-shell){position:relative;z-index:1;height:100%;min-height:0;overflow:hidden}
      .mars-migration-note{position:fixed;z-index:3;left:18px;bottom:calc(var(--noxia-cockpit-clearance,76px) + 10px);padding:7px 10px;border:1px solid rgba(220,146,98,.2);border-radius:8px;background:rgba(32,16,10,.78);color:#c89a7c;font:9px/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;pointer-events:none}
    `}</style>
  </section>
}
