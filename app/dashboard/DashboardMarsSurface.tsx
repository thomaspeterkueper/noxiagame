'use client'

// app/dashboard/DashboardMarsSurface.tsx
// Aktualisiert: 27.10.2026 — gilt für jeden Ort auf der Marsoberfläche, nicht nur den Tharsis Hub (isMarsSurfaceSite); Titel, Terrain-Sync und Innenraum nach aktuellem Ort, Tharsis-Korridore nur am Tharsis Hub
// Version:      1.1.0

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
import { useGameStore } from '@/lib/store/gameStore'
import { useGameModeStore } from '@/lib/store/gameModeStore'
import { useColonyStateStore } from '@/lib/store/colonyStateStore'
import { getToken } from '@/lib/supabase/auth'
import PlanetarySurfaceMap, { type PlanetarySurfaceEntity } from '@/app/components/PlanetarySurfaceMap'
import PlanetaryWalkableSurface from '@/app/components/PlanetaryWalkableSurface'
import SurfaceContextBadge from '@/app/components/SurfaceContextBadge'
import BuildingInterior from './BuildingInterior'
import BuildingOverlayShell from './BuildingOverlayShell'
import { THARSIS_HUB_SURFACE_CORRIDORS } from '@/lib/game/seeds/tharsisHubSurfaceCorridors'
import { isMarsSurfaceSite } from '@/lib/game/locationBody'
import { WORLD_MAP_LOCATIONS } from '@/lib/worldlab/bodies'

// Neue Weltkarte auf dem Mars (06.11.2026): dieselbe Zeichenmaschine wie die Erde.
// Daneben bleibt die bisherige begehbare Oberfläche; die Wahl merkt sich der Browser.
const BodyWorld = dynamic(() => import('@/app/world-lab/BodyWorld'), { ssr: false })
const BODY_VIEW_KEY = 'noxia-body-view-v1'

export default function DashboardMarsSurface(){
  const location=useGameStore(state=>state.location)
  const credits=useGameStore(state=>state.credits)
  const shipRange=useGameStore(state=>state.shipRange)
  const mode=useGameModeStore(state=>state.mode)
  const enterPlanning=useGameModeStore(state=>state.enterPlanning)
  const locations=useColonyStateStore(state=>state.locations)
  const userId=useColonyStateStore(state=>state.userId)
  const [interiorEntity,setInteriorEntity]=useState<PlanetarySurfaceEntity|null>(null)
  const entities=useColonyStateStore(state=>state.entities)
  const residents=useColonyStateStore(state=>state.residents)
  // Zuletzt gewählte Ansicht je Ort; ohne Wahl die bisherige Oberfläche (sie hat schon MOLA-Gelände).
  const storedBodyView=useSyncExternalStore(()=>()=>{},()=>{try{return window.localStorage.getItem(BODY_VIEW_KEY+':'+location)}catch{return null}},()=>null)
  const [chosenBodyView,setChosenBodyView]=useState<Record<string,'scene'|'world'>>({})
  const bodyView:'scene'|'world'=chosenBodyView[location]??(storedBodyView==='world'?'world':'scene')
  const chooseBodyView=(view:'scene'|'world')=>{setChosenBodyView(current=>({...current,[location]:view}));try{window.localStorage.setItem(BODY_VIEW_KEY+':'+location,view)}catch{/* ohne Speicher */}}
  const worldMapBody=WORLD_MAP_LOCATIONS[location]

  const marsLocation=useMemo(()=>locations.find(item=>item.slug===location)??null,[locations,location])
  // Tharsis Hub (slug 'mars') oder ein weiterer Ort auf der Marsoberfläche, z. B. Mishkan Avi.
  const active=location==='mars'||isMarsSurfaceSite(marsLocation)
  const isTharsis=location==='mars'
  const siteTitle=isTharsis?'Tharsis Hub':String((marsLocation as any)?.name??location)
  const corridors=isTharsis?THARSIS_HUB_SURFACE_CORRIDORS:[]
  const currentResources=Array.isArray(marsLocation?.location_resources)?marsLocation.location_resources:[]

  useEffect(()=>{
    if(!active)return
    let cancelled=false
    ;(async()=>{
      try{
        const token=await getToken()
        if(!token||cancelled)return
        await fetch('/api/game/build/spatial/terrain-sync',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({location})})
      }catch{}
    })()
    return()=>{cancelled=true}
  },[location,active])

  useEffect(()=>{setInteriorEntity(null)},[location])

  if(!active)return null

  const openWorldObject=(entity:PlanetarySurfaceEntity)=>setInteriorEntity(entity)
  const interiorName=interiorEntity?.name??interiorEntity?.entity_id??'Mars-Anlage'

  const interiorOverlay=interiorEntity&&<BuildingOverlayShell eyebrow="MARS · INNENRAUM" title={interiorName} subtitle="Persistentes Weltgebäude · gemeinsamer Interior-Pfad" onClose={()=>setInteriorEntity(null)} width={1020}>
      <BuildingInterior
        entity={{...interiorEntity,entity_type:'building',tile_row:0,tile_col:0,profile_id:interiorEntity.profile_id??null,owner_class:interiorEntity.owner_class??'STATE'} as any}
        userId={userId??''}
        locationResources={currentResources as any}
        credits={credits}
        population={Number(marsLocation?.population??0)}
        hasShipyard={Boolean((marsLocation as any)?.has_shipyard)}
        currentTick={0}
        shipRange={shipRange}
        currentLocationSlug={location}
        onClose={()=>setInteriorEntity(null)}
      />
    </BuildingOverlayShell>

  if(mode==='colony'&&worldMapBody&&bodyView==='world')return <>
    <BodyWorld
      locationSlug={location}
      body={worldMapBody}
      residents={residents}
      // Keine Seed-Fahrwege: Der Seed-Wegeplan (tharsisHubSeed) passt nicht zu den Gebäudelagen
      // in der Datenbank (z. B. Medical Core Seed 14/16, Datenbank −170/170 m). Wege folgen mit echten Daten.
      onLeave={()=>chooseBodyView('scene')}
      onEnterBuilding={id=>{const entity=entities.find(item=>(item as {id?:string}).id===id);if(entity)setInteriorEntity(entity as unknown as PlanetarySurfaceEntity)}}
    />
    {interiorOverlay}
  </>

  if(mode==='colony')return <>
    {worldMapBody&&<button className="noxia-body-view-toggle" onClick={()=>chooseBodyView('world')} style={{position:'fixed',zIndex:2270,left:14,bottom:24,border:'1px solid #d9a46a',borderRadius:7,background:'#4a2616e6',color:'#fff1e2',font:'700 13px system-ui',padding:'10px 16px',cursor:'pointer',boxShadow:'0 4px 14px rgba(0,0,0,.25)'}}>◇ Neue Weltkarte</button>}
    <PlanetaryWalkableSurface
      locationSlug={location}
      body="mars"
      title={siteTitle}
      corridors={corridors}
      onOpenWorldObject={openWorldObject}
      onClose={enterPlanning}
    />
    {interiorOverlay}
  </>

  return <section className="noxia-dashboard-mars-surface" aria-label={"Marsoberfläche "+siteTitle}>
    <SurfaceContextBadge title={"MOLA · "+siteTitle} detail="planetozentrischer Mars-Frame · MOLA-Terrain · gemeinsamer Planetary-Surface-Renderer"/>
    <PlanetarySurfaceMap
      locationSlug={location}
      body="mars"
      mapLabel={"Spielbare Mars-Karte ("+siteTitle+")"}
      terrainLabel="MGS / MOLA"
      minimumWorldSpanM={700}
      corridors={corridors}
      onOpenWorldObject={openWorldObject}
    />
    {interiorOverlay}
    {isTharsis&&<div className="mars-migration-note">Tharsis-Wege und Gebäude laufen jetzt über dieselbe metrische planetare Surface-Geometrie.</div>}
    <style jsx>{`
      .noxia-dashboard-mars-surface{position:fixed;top:var(--noxia-topbar-h,44px);right:0;bottom:0;left:0;z-index:1000;overflow:hidden;background:#170d09;overscroll-behavior:contain}
      .noxia-dashboard-mars-surface::before{content:'';position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;pointer-events:none;background:radial-gradient(circle at 45% 32%,rgba(142,82,57,.18),transparent 48%),linear-gradient(180deg,#25130d,#100906 76%);z-index:0}
      .noxia-dashboard-mars-surface :global(.planetary-shell){position:relative;z-index:1;height:100%;min-height:0;overflow:hidden}
      .mars-migration-note{position:fixed;z-index:3;left:18px;bottom:calc(var(--noxia-cockpit-clearance,76px) + 10px);padding:7px 10px;border:1px solid rgba(220,146,98,.2);border-radius:8px;background:rgba(32,16,10,.78);color:#c89a7c;font:9px/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;pointer-events:none}
    `}</style>
  </section>
}
