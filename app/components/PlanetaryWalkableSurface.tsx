'use client'
// Aktualisiert: 28.10.2026 — Laufweg für die Verhaltensaufzeichnung; 27.10.2026: Klick auf freie Fläche zeigt Bauhinweis mit Weg in die Bauplanung; WASD läuft bis an die Wand statt ganz stehenzubleiben
// Version:      1.2.0

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { reportPlayerPosition } from '@/lib/telemetry/playerActivity'
import { useColonyStateStore, type ColonyResident } from '@/lib/store/colonyStateStore'
import { buildPlanetaryLocalScene } from '@/lib/game/spatial/planetaryLocalScene'
import { buildSurfaceDecor } from '@/lib/game/spatial/surfaceDecor'
import { PEBBLE_ZOOM, SurfaceTerrainLayer, TERRAIN_PALETTES } from '@/app/components/SurfaceTerrainLayer'
import { getBuildingVisual } from '@/lib/game/buildings/visuals'
import {
  advanceAlongLocalSceneRoute,
  isInsidePressurizedSpace,
  isLocalScenePointWalkable,
  isPressurizedBuilding,
  pressurizedBuildingAt,
  type LocalSceneMovementRules,
  type LocalSceneOutfit,
  localSceneInteractionDistance,
  localSceneInteractions,
  resolveLocalSceneStep,
  routeAcrossLocalScene,
} from '@/lib/game/spatial/localSceneRuntime'
import type { PreparedCorridor, PlanetarySurfaceEntity, MobileSurfaceObject } from '@/app/components/PlanetarySurfaceMap'
import { WALKABLE_VIEW, WalkableActor, WalkableObject, WalkablePlayer, WalkableRoute, WalkableSurfaceSvg, projectSurfacePoint as iso, surfaceBuildingTop as buildingTop, surfacePathD as pathD, surfacePointsAttr as attrs } from '@/app/components/WalkableSurfaceRenderer'

type SpatialPayload={
  frame?:{body?:string;origin_status?:string|null;terrain_dataset_id?:string|null}|null
  entities?:PlanetarySurfaceEntity[]
  builds?:PlanetarySurfaceEntity[]
  error?:string
}
type Props={
  locationSlug:string
  body:string
  title:string
  corridors?:PreparedCorridor[]
  mobileObjects?:MobileSurfaceObject[]
  onOpenWorldObject?:(entity:PlanetarySurfaceEntity)=>void
  onOpenMobileObject?:(object:MobileSurfaceObject)=>void
  onClose:()=>void
}
type Point={xM:number;yM:number}

const VIEW_W=1200
const VIEW_H=760
const ISO_X=.95
const ISO_Y=.48
/** Fundament der Gebäude in Bildpunkten (die Gebäude stehen auf dem Boden, nicht auf schwebenden Kästen). */
const FOUNDATION_H=3
/** Gelände reicht so weit um die Mitte (m). */
const TERRAIN_EXTENT_M=650
const ZOOM_MIN=.8,ZOOM_MAX=2.6
const isPad=(entityId:string|null|undefined)=>/landing_pad/.test(entityId??'')
/** Kabel zwischen Gebäudearten (nur wenn beide stehen). */
const CABLES:Array<[string,string]>=[['solar','battery_storage'],['battery_storage','habitat'],['surface_comms','habitat'],['life_support_hub','habitat']]
/** Gebäude, an denen Kisten und Fässer stehen. */
const PROP_BUILDINGS=/warehouse|workshop|rover|storage|depot/

function hash(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function residentLabel(resident:ColonyResident){return resident.identityState==='known'?resident.displayName:(resident.observableDescription?.trim()||'Person')}
function residentRole(resident:ColonyResident){return resident.assignments.find(item=>item.type==='work')?.roleCode??resident.activityState??'general'}

export default function PlanetaryWalkableSurface({
  locationSlug,body,title,corridors=[],mobileObjects=[],onOpenWorldObject,onOpenMobileObject,onClose,
}:Props){
  const residents=useColonyStateStore(state=>state.residents)
  const[spatial,setSpatial]=useState<SpatialPayload|null>(null)
  const[error,setError]=useState<string|null>(null)
  const[player,setPlayer]=useState<Point>({xM:0,yM:0})
  useEffect(()=>{reportPlayerPosition(locationSlug,player.xM,player.yM)},[player,locationSlug])
  const[selectedId,setSelectedId]=useState('')
  const[autoWalkId,setAutoWalkId]=useState('')
  const[hoveredBuildingId,setHoveredBuildingId]=useState<string|null>(null)
  const[motionTime,setMotionTime]=useState(0)
  // Näher heran als bisher: Gebäude und Personen waren auf der ganzen Fläche zu klein (27.10.2026).
  const[zoom,setZoom]=useState(1.7)
  // Draußen nur im Anzug oder im Fahrzeug (Thomas, 27.10.2026). Anzug an jeder Schleuse, Rover am Fahrzeughof.
  const[outfit,setOutfit]=useState<LocalSceneOutfit>('none')
  const[wallNote,setWallNote]=useState('')
  // Angeklickte freie Fläche (Weltmeter) – Bauen läuft über die Bauplanung (Thomas, 27.10.2026).
  const[groundSpot,setGroundSpot]=useState<{xM:number;yM:number}|null>(null)
  const rules=useMemo<LocalSceneMovementRules>(()=>({pressurized:true,outfit}),[outfit])
  const[personPanelOpen,setPersonPanelOpen]=useState(false)
  const[objectPanelOpen,setObjectPanelOpen]=useState(false)
  const[message,setMessage]=useState('')
  const[sending,setSending]=useState(false)
  const[conversationByNpc,setConversationByNpc]=useState<Record<string,Array<{role:'user'|'assistant';content:string}>>>({})

  useEffect(()=>{let live=true;(async()=>{try{const token=await getToken();if(!token)throw new Error('Nicht angemeldet');const response=await fetch('/api/game/build/spatial?location='+encodeURIComponent(locationSlug),{headers:{Authorization:'Bearer '+token},cache:'no-store'});const payload=await response.json();if(!response.ok)throw new Error(payload?.error??'Surface-Daten nicht verfügbar');if(live)setSpatial(payload)}catch(err){if(live)setError(err instanceof Error?err.message:String(err))}})();return()=>{live=false}},[locationSlug])
  useEffect(()=>{let frame=0,last=0;const tick=(now:number)=>{if(now-last>=160){setMotionTime(now/1000);last=now}frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[])

  const residentObjects=useMemo<MobileSurfaceObject[]>(()=>{
    if(!residents.length)return[]
    return residents.slice(0,18).map((resident,index)=>{
      const h=hash(resident.id)
      const corridor=corridors.length?corridors[h%corridors.length]:null
      const points=corridor?.points??[]
      if(points.length<2)return{id:'resident:'+resident.id,label:residentLabel(resident),xM:-70+(h%140),yM:-55+((h>>>8)%110),role:'person:npc'}
      const segments=points.slice(1).map((to,i)=>{const from=points[i];return{from,to,length:Math.hypot(to.xM-from.xM,to.yM-from.yM)}}).filter(item=>item.length>.01)
      const total=segments.reduce((sum,item)=>sum+item.length,0)||1
      const state=resident.activityState.toLowerCase()
      const speed=/work|travel|move|commut|deliver|patrol/.test(state)?1.2:/idle|rest|sleep/.test(state)?.18:.65
      const phase=(h%10000)/10000
      const travelled=((phase*total)+(motionTime*speed))%total
      let walked=0
      let point=points[0]
      for(const segment of segments){
        if(travelled<=walked+segment.length){
          const t=(travelled-walked)/segment.length
          point={xM:segment.from.xM+(segment.to.xM-segment.from.xM)*t,yM:segment.from.yM+(segment.to.yM-segment.from.yM)*t}
          break
        }
        walked+=segment.length
      }
      return{id:'resident:'+resident.id,label:residentLabel(resident),xM:point.xM+((index%3)-1)*1.8,yM:point.yM+((index%2)?1.6:-1.6),role:'person:npc'}
    })
  },[corridors,residents,motionTime])

  const scene=useMemo(()=>spatial?buildPlanetaryLocalScene({
    body,
    frameId:String(spatial.frame?.terrain_dataset_id??(body+'-local-frame')),
    radiusM:300,
    entities:[...(spatial.entities??[]),...(spatial.builds??[])],
    corridors,
    mobileObjects:[...mobileObjects,...residentObjects],
  }):null,[spatial,body,corridors,mobileObjects,residentObjects])

  // Gelände: hängt nur von Gebäuden und Wegen ab, nicht von bewegten Objekten.
  const decorKey=scene?scene.buildings.map(b=>b.id+':'+b.center.xM+':'+b.center.yM).join('|')+'#'+scene.paths.length:''
  const decor=useMemo(()=>scene?buildSurfaceDecor({body,seedKey:locationSlug,extentM:TERRAIN_EXTENT_M,keepOut:{buildings:scene.buildings,paths:scene.paths},activity:{pads:scene.buildings.filter(b=>isPad(b.entityId)),yards:scene.buildings.filter(b=>/rover|vehicle|garage/.test(b.entityId??''))}}):null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [decorKey,body,locationSlug])
  const interactions=useMemo(()=>scene?localSceneInteractions(scene):[],[scene])
  const selected=interactions.find(item=>item.id===selectedId)??null
  const selectedDistance=scene&&selected?localSceneInteractionDistance(player,selected):null
  const route=useMemo(()=>scene&&selected?routeAcrossLocalScene(scene,player,selected.point,{rules}):null,[scene,player,selected,rules])
  const selectedEntity=selected?.building
    ? spatial?.entities?.find(entity=>entity.id===selected.building?.id)??null
    : null
  const selectedMobile=selected?.mobileObject
    ? mobileObjects.find(object=>object.id===selected.mobileObject?.id)??null
    : null
  const selectedResident=selected?.mobileObject?.id.startsWith('resident:')
    ? residents.find(resident=>resident.id===selected.mobileObject?.id.slice('resident:'.length))??null
    : null
  const hasAction=Boolean(selectedResident||(selectedEntity&&onOpenWorldObject)||selectedMobile)
  const canInteract=Boolean(selected&&selectedDistance!==null&&selectedDistance<=Math.max(8,selected.rangeM)&&hasAction)
  const autoWalkStopDistance=selected?.building?Math.max(8,selected.rangeM):Math.max(3,selected?.rangeM??3)

  useEffect(()=>{
    if(!scene||isLocalScenePointWalkable(scene,player,.8,rules))return
    // Start drinnen: zuerst ein Gebäude mit Luft, sonst ein Punkt der Wege.
    const candidates=[...scene.buildings.filter(isPressurizedBuilding).map(building=>building.center),...scene.paths.flatMap(path=>path.points)]
    const spawn=candidates.find(point=>isLocalScenePointWalkable(scene,point,.8,rules))
    if(spawn)setPlayer(spawn)
  },[scene,player,rules])
  // Wo man gerade Ausrüstung wechseln kann
  const airlock=scene?pressurizedBuildingAt(scene,player):null
  const atYard=scene?scene.buildings.find(building=>/rover_yard|vehicle_yard/.test(building.entityId??'')&&localSceneInteractionDistance(player,{id:'',kind:'building',label:'',point:building.center,rangeM:0,building})<=6)??null:null
  const outside=scene?!isInsidePressurizedSpace(scene,player):false
  const changeOutfit=(next:LocalSceneOutfit)=>{setOutfit(next);setWallNote('');setAutoWalkId('')}

  const interact=useCallback(()=>{
    if(!canInteract||!selected)return
    if(selectedResident){setPersonPanelOpen(true);setObjectPanelOpen(false);return}
    if(selectedEntity&&onOpenWorldObject){onOpenWorldObject(selectedEntity);return}
    if(selectedMobile){setObjectPanelOpen(true);setPersonPanelOpen(false);onOpenMobileObject?.(selectedMobile)}
  },[canInteract,selected,selectedResident,selectedEntity,selectedMobile,onOpenWorldObject,onOpenMobileObject])

  async function talk(){
    if(!selectedResident||!message.trim()||sending)return
    const playerMessage=message.trim().slice(0,80)
    const history=conversationByNpc[selectedResident.id]??[]
    setSending(true)
    try{
      const token=await getToken()
      const response=await fetch('/api/game/npc-conversation',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({
        player:playerMessage,
        npcId:selectedResident.id,
        npcName:selectedResident.displayName,
        npcRole:residentRole(selectedResident),
        headline:'Lokales Gespräch in '+title,
        source:'NOXIA '+body+' local scene',
        locationName:title,
        localFacts:[scene?`${scene.buildings.length} Gebäude und ${scene.paths.length} lokale Wege/Korridore`:'lokale Szene',`Himmelskörper: ${body}`],
        nearbyPlaces:[],
        history,
      })})
      const json=await response.json().catch(()=>({}))
      const reply=response.ok&&json.reply?String(json.reply):'Die Person kann gerade nicht antworten.'
      setConversationByNpc(current=>({...current,[selectedResident.id]:[...(current[selectedResident.id]??[]),{role:'user' as const,content:playerMessage},{role:'assistant' as const,content:reply}].slice(-10)}))
      if(response.ok)setMessage('')
    }catch{
      setConversationByNpc(current=>({...current,[selectedResident.id]:[...(current[selectedResident.id]??[]),{role:'assistant' as const,content:'Gespräch derzeit nicht erreichbar.'}].slice(-10)}))
    }finally{setSending(false)}
  }

  useEffect(()=>{
    if(!scene||!selected||autoWalkId!==selected.id||selectedDistance===null||!route)return
    if(selectedDistance<=autoWalkStopDistance){
      setAutoWalkId('')
      return
    }
    setPlayer(current=>advanceAlongLocalSceneRoute(scene,current,route,outfit==='rover'?6:2.4,rules))
  },[motionTime,scene,selected,selectedDistance,route,autoWalkId,autoWalkStopDistance,outfit,rules])

  useEffect(()=>{
    if(!scene)return
    const onKey=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null
      if(target?.closest('input,textarea,select,[contenteditable="true"]'))return
      if((event.key==='f'||event.key==='Enter')&&canInteract){event.preventDefault();interact();return}
      const key=event.key.toLowerCase()
      if(!['w','a','s','d'].includes(key))return
      event.preventDefault()
      setAutoWalkId('')
      const step=(event.shiftKey?8:4)*(outfit==='rover'?2.5:1)
      setPlayer(current=>{
        const desired={xM:current.xM+(key==='d'?step:key==='a'?-step:0),yM:current.yM+(key==='s'?step:key==='w'?-step:0)}
        // In Metern unterteilt: bis an die Wand gehen, statt vor ihr ganz stehenzubleiben.
        const parts=Math.max(1,Math.ceil(step))
        let next=current
        for(let i=1;i<=parts;i++){
          const target={xM:current.xM+(desired.xM-current.xM)*i/parts,yM:current.yM+(desired.yM-current.yM)*i/parts}
          const moved=resolveLocalSceneStep(scene,next,target,.8,rules)
          if(Math.hypot(moved.xM-next.xM,moved.yM-next.yM)<.01)break
          next=moved
        }
        // Gegen die Wand gelaufen: sagen, warum
        if(Math.hypot(next.xM-current.xM,next.yM-current.yM)<.01)setWallNote(outfit==='none'?'Draußen nur im Anzug oder Rover – Anzüge gibt es an jeder Schleuse.':outfit==='rover'?'Mit dem Rover nicht in Gebäude oder Röhren – am Fahrzeughof abstellen.':'')
        else setWallNote('')
        return next
      })
    }
    window.addEventListener('keydown',onKey)
    return()=>window.removeEventListener('keydown',onKey)
  },[scene,canInteract,interact,outfit,rules])

  // Lade- und Fehleranzeige mit eigener Gestaltung: Die Stilregeln unten gelten erst für die fertige Szene;
  // ohne sie schien beim Laden die alte 2D-Karte durch (Thomas, 27.10.2026).
  const loadingStyle:React.CSSProperties={position:'fixed',inset:'var(--noxia-topbar-h,44px) 0 0',zIndex:1500,display:'grid',placeItems:'center',background:(TERRAIN_PALETTES[body]??TERRAIN_PALETTES.phobos).grainDark,color:'#c4d4da',fontFamily:'monospace',letterSpacing:'.08em'}
  if(error)return <div className="planetary-walkable-loading" style={loadingStyle}>{error}</div>
  if(!scene)return <div className="planetary-walkable-loading" style={loadingStyle}>{title.toUpperCase()} · LOKALE SZENE WIRD AUFGEBAUT …</div>

  return <section className={'planetary-walkable '+body}>
    <header><div><small>{body.toUpperCase()} · LOCAL SCENE</small><b>{title}</b><span>{scene.frameId}</span></div><div className="stats"><span>{scene.buildings.length} Gebäude</span><span>{scene.paths.length} Wege/Korridore</span><span>{scene.mobileObjects.length} Akteure/Objekte</span></div><button onClick={onClose} title="Zur Karte – dort wird gebaut">← Karte · Bauen</button></header>
    <div className="stage" onWheel={event=>{const factor=event.deltaY>0?1/1.12:1.12;setZoom(value=>Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,value*factor)))}}>
      <WalkableSurfaceSvg>
        <rect width={VIEW_W} height={VIEW_H} fill={(TERRAIN_PALETTES[body]??TERRAIN_PALETTES.phobos).grainDark} onClick={event=>{
          // Bildschirm → Weltmeter: Zoom und Kamera zurückrechnen, dann die Iso-Projektion umkehren.
          const svg=(event.currentTarget as SVGRectElement).ownerSVGElement,matrix=svg?.getScreenCTM()
          if(!svg||!matrix)return
          const pt=svg.createSVGPoint();pt.x=event.clientX;pt.y=event.clientY
          const local=pt.matrixTransform(matrix.inverse()),cam=iso(player)
          const u=((local.x-VIEW_W/2)/zoom+cam.x-WALKABLE_VIEW.width/2)/WALKABLE_VIEW.isoX
          const v=((local.y-VIEW_H/2)/zoom+cam.y-WALKABLE_VIEW.height/2)/WALKABLE_VIEW.isoY
          setSelectedId('');setAutoWalkId('');setGroundSpot({xM:Math.round((u+v)/2),yM:Math.round((v-u)/2)})
        }}/>
        <g transform={`translate(${VIEW_W/2} ${VIEW_H/2}) scale(${zoom}) translate(${-iso(player).x} ${-iso(player).y})`}>
        {decor&&<SurfaceTerrainLayer body={body} decor={decor} extentM={TERRAIN_EXTENT_M} detailed={zoom>=PEBBLE_ZOOM}/>}
        {/* Kabel auf dem Boden: Energie vom Solarfeld zum Speicher, Mast und Speicher zum Habitat */}
        {CABLES.flatMap(([from,to])=>{const a=scene.buildings.find(b=>b.entityId===from),b=scene.buildings.find(item=>item.entityId===to);if(!a||!b)return[];const p=iso(a.center),q=iso(b.center),mid={x:(p.x+q.x)/2+(q.y-p.y)*.12,y:(p.y+q.y)/2+8};return[<path key={from+to} d={`M${p.x} ${p.y} Q${mid.x} ${mid.y} ${q.x} ${q.y}`} fill="none" stroke="#141210" strokeWidth="1.1" opacity=".8" pointerEvents="none"/>]})}
        {/* Druckkorridore als Röhren mit Ringen und Lichtern; Rover-Pisten als zwei Fahrspuren */}
        {scene.paths.map(path=>path.kind==='pressurized-corridor'||path.kind==='surface-tube'||path.kind==='cargo-transfer-link'
          ? <g key={path.id} pointerEvents="none">
              <path d={pathD(path.points)} fill="none" stroke="#000" strokeWidth="11" strokeLinecap="round" opacity=".35" transform="translate(2 3)"/>
              <path d={pathD(path.points)} fill="none" stroke="#3c4246" strokeWidth="9" strokeLinecap="round"/>
              <path d={pathD(path.points)} fill="none" stroke="#a7aeb2" strokeWidth="7" strokeLinecap="round"/>
              <path d={pathD(path.points)} fill="none" stroke="#d5dadc" strokeWidth="2.2" strokeLinecap="round" transform="translate(0 -1.6)"/>
              <path d={pathD(path.points)} fill="none" stroke="#5d656a" strokeWidth="7" strokeDasharray="1.2 9"/>
              <path d={pathD(path.points)} fill="none" stroke="#ffd98a" strokeWidth="1.6" strokeDasharray=".1 27" strokeLinecap="round" transform="translate(0 -3.4)"/>
            </g>
          : path.kind==='road'
          ? <g key={path.id} pointerEvents="none">
              {/* Befestigte Straße im Freien (Mond, Mars) */}
              <path d={pathD(path.points)} fill="none" stroke="#2b2e30" strokeWidth="10" strokeLinecap="round" opacity=".6"/>
              <path d={pathD(path.points)} fill="none" stroke="#7d7f7c" strokeWidth="8" strokeLinecap="round"/>
              <path d={pathD(path.points)} fill="none" stroke="#c9b45a" strokeWidth=".8" strokeDasharray="6 6"/>
            </g>
          : <g key={path.id} pointerEvents="none">
              <path d={pathD(path.points)} fill="none" stroke="#000" strokeWidth="9" strokeLinecap="round" opacity=".18"/>
              <path d={pathD(path.points)} fill="none" stroke="#6b6158" strokeWidth="1.6" strokeDasharray="5 2" transform="translate(0 -2.2)"/>
              <path d={pathD(path.points)} fill="none" stroke="#6b6158" strokeWidth="1.6" strokeDasharray="5 2" transform="translate(0 2.2)"/>
            </g>)}

        {route&&selected&&<WalkableRoute points={route.points} target={selected.point}/>}

        {[...scene.buildings].sort((a,b)=>(a.center.xM+a.center.yM)-(b.center.xM+b.center.yM)).map(building=>{
          const top=buildingTop(building.center,building.widthM,building.depthM)
          const lifted=top.map(p=>({x:p.x,y:p.y-FOUNDATION_H}))
          const right=[lifted[1],lifted[2],top[2],top[1]]
          const front=[lifted[2],lifted[3],top[3],top[2]]
          const interactionId='building:'+building.id
          const active=selectedId==='building:'+building.id
          const center=iso(building.center)
          const pad=isPad(building.entityId)
          const visual=pad?null:getBuildingVisual(building.entityId??'',locationSlug)
          const spriteScale=visual?.mapScale??1.35
          // Bild füllt das Fundament (vorher standen kleine Bilder auf großen Platten).
          const spriteW=Math.max(46,Math.max(building.widthM,building.depthM)*2.1*spriteScale*1.3)
          const spriteH=spriteW*.75
          const ring=(rM:number,steps=32)=>Array.from({length:steps},(_,i)=>{const t=i/steps*Math.PI*2;return iso({xM:building.center.xM+Math.cos(t)*rM,yM:building.center.yM+Math.sin(t)*rM})})
          return <g key={building.id} onPointerEnter={()=>setHoveredBuildingId(building.id)} onPointerLeave={()=>setHoveredBuildingId(current=>current===building.id?null:current)} onClick={()=>setSelectedId(interactionId)} style={{cursor:'pointer'}}>
            <polygon points={attrs(top,6)} fill="#000" opacity=".3"/>
            <polygon points={attrs(right)} fill="#4d5458" stroke="#1d2224" strokeWidth=".6"/>
            <polygon points={attrs(front)} fill="#3b4245" stroke="#1d2224" strokeWidth=".6"/>
            <polygon points={attrs(lifted)} fill={active?'#e0c05e':pad?'#71777b':'#6b7174'} stroke={active?'#fff0a8':'#262c2e'} strokeWidth={active?2:1}/>
            {/* Staub, der an den Kanten auf die Platte geweht ist */}
            {!active&&[[0,1],[1,2],[2,3],[3,0]].map(([i,j])=>{const a=lifted[i],b=lifted[j];const inA={x:a.x+(center.x-a.x)*.16,y:a.y+(center.y-FOUNDATION_H-a.y)*.16},inB={x:b.x+(center.x-b.x)*.16,y:b.y+(center.y-FOUNDATION_H-b.y)*.16};return <polygon key={'d'+i} points={attrs([a,b,inB,inA])} fill={(TERRAIN_PALETTES[body]??TERRAIN_PALETTES.phobos).ground} opacity=".38" pointerEvents="none"/>})}
            {/* Kisten und Fässer an Lager, Werkstatt und Fahrzeughof */}
            {PROP_BUILDINGS.test(building.entityId??'')&&[0,1,2].map(i=>{const corner=lifted[3],toward=lifted[0];const base={x:corner.x+(center.x-corner.x)*.22+(toward.x-corner.x)*(.12+i*.12),y:corner.y+(center.y-FOUNDATION_H-corner.y)*.22+(toward.y-corner.y)*(.12+i*.12)};return i===1
              ? <g key={'prop'+i} pointerEvents="none"><ellipse cx={base.x+1.5} cy={base.y+.8} rx="3.2" ry="1.3" fill="#000" opacity=".35"/><rect x={base.x-2} y={base.y-5} width="4" height="5" rx="1" fill="#2f6f7a" stroke="#14262b" strokeWidth=".4"/><ellipse cx={base.x} cy={base.y-5} rx="2" ry=".8" fill="#4b8f9b"/></g>
              : <g key={'prop'+i} pointerEvents="none"><ellipse cx={base.x+2} cy={base.y+.8} rx="4.2" ry="1.4" fill="#000" opacity=".35"/><polygon points={`${base.x-3.5},${base.y-1} ${base.x},${base.y+.8} ${base.x},${base.y-3.4} ${base.x-3.5},${base.y-5.2}`} fill="#b07a3c" stroke="#3a2812" strokeWidth=".4"/><polygon points={`${base.x},${base.y+.8} ${base.x+3},${base.y-.6} ${base.x+3},${base.y-4.8} ${base.x},${base.y-3.4}`} fill="#8d5f2c" stroke="#3a2812" strokeWidth=".4"/><polygon points={`${base.x-3.5},${base.y-5.2} ${base.x},${base.y-3.4} ${base.x+3},${base.y-4.8} ${base.x-.5},${base.y-6.6}`} fill="#c99350" stroke="#3a2812" strokeWidth=".4"/></g>})}
            {pad?<>
              {/* Landeplattform: Warnrand, Zielkreis, Kreuz, blinkende Landelichter */}
              <polygon points={attrs(top.map(p=>({x:p.x+(center.x-p.x)*.1,y:p.y+(center.y-p.y)*.1-FOUNDATION_H})))} fill="none" stroke="#e8b923" strokeWidth="2.4" strokeDasharray="6 6"/>
              <polygon points={attrs(top.map(p=>({x:p.x+(center.x-p.x)*.1,y:p.y+(center.y-p.y)*.1-FOUNDATION_H})))} fill="none" stroke="#1b1d1f" strokeWidth="2.4" strokeDasharray="6 6" strokeDashoffset="6"/>
              <polygon points={attrs(ring(Math.min(building.widthM,building.depthM)*.32),-FOUNDATION_H)} fill="#5c6266" stroke="#f1f1ec" strokeWidth="1.6"/>
              <line x1={iso({xM:building.center.xM-building.widthM*.22,yM:building.center.yM}).x} y1={iso({xM:building.center.xM-building.widthM*.22,yM:building.center.yM}).y-FOUNDATION_H} x2={iso({xM:building.center.xM+building.widthM*.22,yM:building.center.yM}).x} y2={iso({xM:building.center.xM+building.widthM*.22,yM:building.center.yM}).y-FOUNDATION_H} stroke="#e8b923" strokeWidth="1.8"/>
              <line x1={iso({xM:building.center.xM,yM:building.center.yM-building.depthM*.22}).x} y1={iso({xM:building.center.xM,yM:building.center.yM-building.depthM*.22}).y-FOUNDATION_H} x2={iso({xM:building.center.xM,yM:building.center.yM+building.depthM*.22}).x} y2={iso({xM:building.center.xM,yM:building.center.yM+building.depthM*.22}).y-FOUNDATION_H} stroke="#e8b923" strokeWidth="1.8"/>
              {lifted.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r="4" fill="#ffd36b" opacity=".25"><animate attributeName="opacity" values=".1;.45;.1" dur="1.6s" begin={`${i*.4}s`} repeatCount="indefinite"/></circle><circle cx={p.x} cy={p.y} r="1.4" fill="#ffe9a8"/></g>)}
              {/* Frachtcontainer neben der Plattform */}
              {[0,1,2,3,4].map(i=>{const c=iso({xM:building.center.xM+building.widthM/2+6+(i%2)*7,yM:building.center.yM-building.depthM/2+6+Math.floor(i/2)*5});const colors=['#c8642b','#2f6f7a','#b9a03a','#7a3f3a','#4c6e45'];const w=9,h=6,d=5;return <g key={'k'+i} pointerEvents="none"><polygon points={`${c.x-w},${c.y} ${c.x},${c.y+d} ${c.x},${c.y+d-h} ${c.x-w},${c.y-h}`} fill={colors[i]} stroke="#1b1d1f" strokeWidth=".5" opacity=".95"/><polygon points={`${c.x},${c.y+d} ${c.x+w*.8},${c.y+d*.2} ${c.x+w*.8},${c.y+d*.2-h} ${c.x},${c.y+d-h}`} fill={colors[i]} stroke="#1b1d1f" strokeWidth=".5" style={{filter:'brightness(.75)'}}/><polygon points={`${c.x-w},${c.y-h} ${c.x},${c.y+d-h} ${c.x+w*.8},${c.y+d*.2-h} ${c.x-w*.2},${c.y-h-d*.8}`} fill={colors[i]} stroke="#1b1d1f" strokeWidth=".5" style={{filter:'brightness(1.2)'}}/></g>})}
            </>:visual?.mapAsset&&<image href={visual.mapAsset} x={center.x-spriteW/2} y={center.y-spriteH+8-FOUNDATION_H} width={spriteW} height={spriteH} preserveAspectRatio="xMidYMax meet" pointerEvents="none"/>}
            {/* Leuchtfeuer am Kommunikationsmast */}
            {building.entityId==='surface_comms'&&<g pointerEvents="none"><circle cx={center.x} cy={center.y-spriteH*.78} r="5" fill="#ff4a3a" opacity=".3"><animate attributeName="opacity" values=".05;.6;.05" dur="1.2s" repeatCount="indefinite"/></circle><circle cx={center.x} cy={center.y-spriteH*.78} r="1.6" fill="#ff6a5a"/></g>}
            <rect x={center.x-Math.max(18,building.widthM)} y={center.y-Math.max(20,building.depthM)} width={Math.max(36,building.widthM*2)} height={Math.max(38,building.depthM*2)} fill="transparent" pointerEvents="all"/>
            <title>{building.label??building.entityId??'Gebäude'}</title>
          </g>
        })}

        {scene.mobileObjects.map(object=>{
          const interaction=interactions.find(item=>item.id==='mobile:'+object.id)
          const active=selectedId==='mobile:'+object.id
          const person=interaction?.kind==='person'
          return <g key={object.id} onClick={()=>setSelectedId('mobile:'+object.id)} style={{cursor:'pointer'}}>
            {person?<WalkableActor suited={!isInsidePressurizedSpace(scene,object.point)} point={object.point} selected={active} appearance={object.id.startsWith('resident:')?residents.find(resident=>resident.id===object.id.slice('resident:'.length))?.appearance:undefined} visualSeed={object.id}/>:<WalkableObject point={object.point} selected={active}/>}<title>{object.label}</title>
          </g>
        })}

        {outfit==='rover'&&(()=>{const p=iso(player);return <g transform={`translate(${p.x} ${p.y})`} pointerEvents="none"><ellipse cy="5" rx="14" ry="5" fill="#000" opacity=".35"/><path d="M-13 1 L-9 -7 L9 -7 L13 1 L10 5 L-10 5Z" fill="#d6b04a" stroke="#4f411b" strokeWidth="1"/><rect x="-7" y="-6" width="14" height="5" rx="1.5" fill="#cfe3ea" opacity=".55"/>{[-9,-3,3,9].map(x=><circle key={x} cx={x} cy="5" r="2.6" fill="#22282a"/>)}</g>})()}
        <WalkablePlayer point={outfit==='rover'?{xM:player.xM,yM:player.yM-1.5}:player} suited={outfit!=='none'}/>
        </g>
      </WalkableSurfaceSvg>

      <div className="hint"><b>WASD</b> bewegen · <b>Shift</b> schneller · <b>Mausrad</b> zoomen · Ziel anklicken · <b>F/Enter</b> interagieren</div>
      <div className="outfit">
        <small>AUSRÜSTUNG</small>
        <b>{outfit==='none'?'Ohne Anzug – nur drinnen':outfit==='suit'?'Im Raumanzug':'Im Rover'}</b>
        <span>{outfit==='none'?(airlock?`Schleuse: ${airlock.label??'Gebäude'}`:'In Gebäuden und Druckkorridoren'):outfit==='suit'?(outside?'Draußen auf dem Regolith':'Drinnen'):'Nur draußen, schneller'}</span>
        <div className="outfit-actions">
          {outfit==='none'&&airlock&&<button onClick={()=>changeOutfit('suit')}>Anzug anlegen</button>}
          {outfit==='suit'&&airlock&&<button onClick={()=>changeOutfit('none')}>Anzug ablegen</button>}
          {outfit==='suit'&&atYard&&<button onClick={()=>changeOutfit('rover')}>Rover nehmen</button>}
          {outfit==='rover'&&atYard&&<button onClick={()=>changeOutfit('suit')}>Rover abstellen</button>}
        </div>
        {wallNote&&<em>{wallNote}</em>}
      </div>
      {hoveredBuildingId&&(()=>{const building=scene.buildings.find(item=>item.id===hoveredBuildingId);if(!building)return null;const entity=spatial?.entities?.find(item=>item.id===building.id);return <div className="building-hover"><small>GEBÄUDE</small><b>{building.label??building.entityId??'Gebäude'}</b><span>{entity?.owner_class==='STATE'?'Staatlich':entity?.owner_class==='CORPORATION'?'Corporation':entity?.profile_id?'Privat':'Neutral'} · {Math.round(Math.hypot(building.center.xM-player.xM,building.center.yM-player.yM))} m</span></div>})()}

      {groundSpot&&!selected&&<div className="target">
        <small>FREIE FLÄCHE</small>
        <b>{groundSpot.xM} m / {groundSpot.yM} m</b>
        <span>Gebaut wird in der Bauplanung auf der Karte – dort Fläche wählen und Gebäude setzen.</span>
        <button onClick={()=>{setGroundSpot(null);onClose()}}>HIER BAUEN → KARTE</button>
        <button onClick={()=>setGroundSpot(null)}>SCHLIESSEN</button>
      </div>}
      {selected&&<div className="target">
        <small>{selected.kind.toUpperCase()} · {route?.usesNetwork?'NETZROUTE':'DIREKTE ROUTE'}</small>
        <b>{selected.label}</b>
        <span>{Math.round(selectedDistance??0)} m entfernt · Weg {Math.round(route?.distanceM??0)} m</span>
        {selectedDistance!==null&&selectedDistance>autoWalkStopDistance&&<button onClick={()=>setAutoWalkId(selected.id)}>{autoWalkId===selected.id?'GEHE …':'GEHE DAHIN'}</button>}
        {hasAction
          ? <button disabled={!canInteract} onClick={interact}>{canInteract?(selectedResident?'SPRECHEN':'INTERAGIEREN'):'NÄHER HERANGEHEN'}</button>
          : <em>{selected.building&&!selectedEntity?'im Bau / noch nicht zugänglich':'keine lokale Aktion hinterlegt'}</em>}
        {outfit==='none'&&!isInsidePressurizedSpace(scene,selected.point)&&<em>Liegt draußen – nur im Anzug oder Rover erreichbar.</em>}
      </div>}

      {selectedMobile&&objectPanelOpen&&<aside className="object-panel">
        <div className="person-head"><div><small>{(selected?.kind??'object').toUpperCase()} · LOKALE SZENE</small><b>{selectedMobile.label}</b><span>{selectedMobile.role??'Objekt'}</span></div><button onClick={()=>setObjectPanelOpen(false)}>×</button></div>
        <div className="person-facts"><span>Status</span><b>{selectedMobile.status??'aktiv'}</b><span>Phase</span><b>{selectedMobile.phase??'–'}</b><span>Position</span><b>{Math.round(selectedMobile.xM)} m E · {Math.round(selectedMobile.yM)} m N</b></div>
      </aside>}

      {selectedResident&&personPanelOpen&&<aside className="person-panel">
        <div className="person-head"><div><small>PERSON · LOKALE SZENE</small><b>{residentLabel(selectedResident)}</b><span>{residentRole(selectedResident)}</span></div><button onClick={()=>setPersonPanelOpen(false)}>×</button></div>
        <div className="person-facts"><span>Aktivität</span><b>{selectedResident.activityState}</b><span>Letzte Aktion</span><b>{selectedResident.lastAction??'–'}</b></div>
        {(conversationByNpc[selectedResident.id]??[]).map((entry,index)=><p key={entry.role+'-'+index}><b>{entry.role==='user'?'Du':residentLabel(selectedResident)}:</b> „{entry.content}“</p>)}
        <div className="person-chat"><input value={message} maxLength={80} onChange={event=>setMessage(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')void talk()}} placeholder="Kurze Antwort …"/><button disabled={sending||!message.trim()} onClick={()=>void talk()}>{sending?'…':'Sprechen'}</button></div>
      </aside>}
    </div>
    <style jsx>{`
      .planetary-walkable{position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;z-index:1500;background:#090b0c;color:#e8eef0;font-family:system-ui;overflow:hidden}.planetary-walkable header{height:46px;display:flex;align-items:center;gap:14px;padding:0 14px;background:#07131dec;border-bottom:1px solid #394d59;position:relative;z-index:2}.planetary-walkable header>div:first-child{display:flex;align-items:baseline;gap:9px}.planetary-walkable header small{font:800 8px monospace;letter-spacing:.14em;color:#d7b96e}.planetary-walkable header b{font-size:13px}.planetary-walkable header span{font-size:9px;color:#869ca7}.planetary-walkable .stats{display:flex;gap:10px;margin-left:auto;color:#8ba0aa;font-size:9px}.planetary-walkable header button,.target button{border:1px solid #466578;border-radius:6px;background:#102b3c;color:#e1edf1;padding:6px 9px;cursor:pointer}.target button:disabled{opacity:.45;cursor:not-allowed}.planetary-walkable .stage{position:absolute;inset:46px 0 0}.planetary-walkable svg{width:100%;height:100%;display:block}.planetary-walkable .outfit{position:absolute;left:12px;bottom:16px;z-index:5;display:grid;gap:3px;min-width:220px;max-width:300px;padding:8px 10px;border:1px solid #536973;border-radius:8px;background:#071521e8;box-shadow:0 10px 26px #0007}.planetary-walkable .outfit small{color:#d7b96e;font:800 7px monospace;letter-spacing:.12em}.planetary-walkable .outfit b{font-size:11px}.planetary-walkable .outfit span{font-size:9px;color:#9db0b6}.planetary-walkable .outfit em{font-size:9px;color:#f0c27a;font-style:normal}.outfit-actions{display:flex;gap:6px;flex-wrap:wrap}.outfit-actions button{border:1px solid #466578;border-radius:6px;background:#102b3c;color:#e1edf1;padding:5px 8px;cursor:pointer;font-size:10px}.planetary-walkable .hint{position:absolute;left:12px;top:12px;padding:6px 8px;border:1px solid #536973;border-radius:6px;background:#071521d9;color:#bdccd2;font:9px monospace}.building-hover{position:absolute;left:12px;top:48px;z-index:6;display:grid;gap:2px;min-width:150px;padding:7px 9px;border:1px solid #5d747d;border-radius:7px;background:#071521e8;box-shadow:0 8px 24px #0007;pointer-events:none}.building-hover small{color:#d7b96e;font:800 7px monospace;letter-spacing:.12em}.building-hover b{font-size:11px}.building-hover span{font-size:9px;color:#9db0b6}.target{position:absolute;right:14px;top:14px;min-width:230px;display:grid;gap:4px;padding:10px 12px;border:1px solid #6f7659;border-radius:8px;background:#101711e8;box-shadow:0 12px 30px #0007}.target small{color:#d7b96e;font:800 8px monospace;letter-spacing:.1em}.target b{font-size:12px}.target span,.target em{color:#9eada6;font-size:9px;font-style:normal}.person-panel,.object-panel{position:absolute;right:14px;top:132px;width:360px;max-height:calc(100% - 150px);overflow:auto;padding:10px;border:1px solid #617b85;border-radius:9px;background:#071521f2;box-shadow:0 16px 38px #0008;backdrop-filter:blur(8px)}.object-panel{max-height:300px}.person-head{display:flex;justify-content:space-between;gap:12px}.person-head small{display:block;color:#d7b96e;font:800 8px monospace;letter-spacing:.12em}.person-head b{display:block;margin-top:3px}.person-head span{display:block;color:#8ba3ad;font-size:9px}.person-head button,.person-chat button{border:1px solid #476476;border-radius:6px;background:#102b3c;color:#dce9ee;padding:6px 9px;cursor:pointer}.person-facts{display:grid;grid-template-columns:90px 1fr;gap:5px;margin-top:10px;font-size:10px}.person-facts span{color:#7e98a3}.person-panel p{margin:9px 0 0;padding-top:8px;border-top:1px solid #314753;color:#d7e4e8;font-size:11px;line-height:1.45}.person-chat{display:flex;gap:6px;margin-top:10px}.person-chat input{flex:1;min-width:0;border:1px solid #476476;border-radius:6px;background:#061019;color:#eef5f7;padding:7px 8px}.planetary-walkable-loading{position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;z-index:1500;display:grid;place-items:center;background:#080c0f;color:#c4d4da;font-family:monospace}@media(max-width:760px){.planetary-walkable .stats{display:none}.target{left:12px;right:12px;top:46px}.person-panel,.object-panel{left:12px;right:12px;top:auto;bottom:12px;width:auto;max-height:42vh}}
    `}</style>
  </section>
}
