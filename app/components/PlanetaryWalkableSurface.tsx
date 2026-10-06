'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { useColonyStateStore, type ColonyResident } from '@/lib/store/colonyStateStore'
import { buildPlanetaryLocalScene } from '@/lib/game/spatial/planetaryLocalScene'
import { getBuildingVisual } from '@/lib/game/buildings/visuals'
import {
  advanceAlongLocalSceneRoute,
  isLocalScenePointWalkable,
  localSceneInteractionDistance,
  localSceneInteractions,
  resolveLocalSceneStep,
  routeAcrossLocalScene,
} from '@/lib/game/spatial/localSceneRuntime'
import type { PreparedCorridor, PlanetarySurfaceEntity, MobileSurfaceObject } from '@/app/components/PlanetarySurfaceMap'
import { WALKABLE_VIEW, WalkableActor, WalkableObject, WalkablePlayer, WalkableRoute, WalkableSurfaceSvg, projectSurfacePoint as iso, surfaceBuildingTop as buildingTop, surfacePathD as pathD, surfacePointsAttr as attrs, surfaceCameraTransform as cameraTransform } from '@/app/components/WalkableSurfaceRenderer'

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
const BUILDING_H=16

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
  const[selectedId,setSelectedId]=useState('')
  const[autoWalkId,setAutoWalkId]=useState('')
  const[hoveredBuildingId,setHoveredBuildingId]=useState<string|null>(null)
  const[motionTime,setMotionTime]=useState(0)
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

  const interactions=useMemo(()=>scene?localSceneInteractions(scene):[],[scene])
  const selected=interactions.find(item=>item.id===selectedId)??null
  const selectedDistance=scene&&selected?localSceneInteractionDistance(player,selected):null
  const route=useMemo(()=>scene&&selected?routeAcrossLocalScene(scene,player,selected.point):null,[scene,player,selected])
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
    if(!scene||isLocalScenePointWalkable(scene,player))return
    const candidates=scene.paths.flatMap(path=>path.points)
    const spawn=candidates.find(point=>isLocalScenePointWalkable(scene,point))
    if(spawn)setPlayer(spawn)
  },[scene,player])

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
    setPlayer(current=>advanceAlongLocalSceneRoute(scene,current,route,2.4))
  },[motionTime,scene,selected,selectedDistance,route,autoWalkId,autoWalkStopDistance])

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
      const step=event.shiftKey?8:4
      setPlayer(current=>resolveLocalSceneStep(scene,current,{
        xM:current.xM+(key==='d'?step:key==='a'?-step:0),
        yM:current.yM+(key==='s'?step:key==='w'?-step:0),
      }))
    }
    window.addEventListener('keydown',onKey)
    return()=>window.removeEventListener('keydown',onKey)
  },[scene,canInteract,interact])

  if(error)return <div className="planetary-walkable-loading">{error}</div>
  if(!scene)return <div className="planetary-walkable-loading">Lokale Surface-Szene wird aufgebaut …</div>

  const isMoon=body==='moon'
  return <section className={'planetary-walkable '+body}>
    <header><div><small>{body.toUpperCase()} · LOCAL SCENE</small><b>{title}</b><span>{scene.frameId}</span></div><div className="stats"><span>{scene.buildings.length} Gebäude</span><span>{scene.paths.length} Wege/Korridore</span><span>{scene.mobileObjects.length} Akteure/Objekte</span></div><button onClick={onClose}>← Karte</button></header>
    <div className="stage">
      <WalkableSurfaceSvg>
        <defs><radialGradient id={'ground-'+body} cx="45%" cy="38%"><stop offset="0%" stopColor={isMoon?'#777872':'#795b50'}/><stop offset="100%" stopColor={isMoon?'#343735':'#3e2f2b'}/></radialGradient></defs>
        <rect width={VIEW_W} height={VIEW_H} fill={'url(#ground-'+body+')'}/>
        <g transform={cameraTransform(player)}>
        {scene.paths.map(path=><g key={path.id}><path d={pathD(path.points)} fill="none" stroke="#20231f" strokeWidth="13" strokeLinecap="round" opacity=".45"/><path d={pathD(path.points)} fill="none" stroke={path.kind==='road'?'#aaa28f':'#8d887a'} strokeWidth={path.kind==='road'?8:5} strokeLinecap="round"/></g>)}

        {route&&selected&&<WalkableRoute points={route.points} target={selected.point}/>}

        {scene.buildings.map(building=>{
          const top=buildingTop(building.center,building.widthM,building.depthM)
          const right=[top[1],top[2],{x:top[2].x,y:top[2].y+BUILDING_H},{x:top[1].x,y:top[1].y+BUILDING_H}]
          const front=[top[2],top[3],{x:top[3].x,y:top[3].y+BUILDING_H},{x:top[2].x,y:top[2].y+BUILDING_H}]
          const interactionId='building:'+building.id
          const active=selectedId===interactionId
          const center=iso(building.center)
          const visual=getBuildingVisual(building.entityId??'',locationSlug)
          const spriteScale=visual?.mapScale??1.35
          const spriteW=Math.max(46,Math.max(building.widthM,building.depthM)*2.1*spriteScale)
          const spriteH=spriteW*.75
          return <g key={building.id} onPointerEnter={()=>setHoveredBuildingId(building.id)} onPointerLeave={()=>setHoveredBuildingId(current=>current===building.id?null:current)} onClick={()=>setSelectedId(interactionId)} style={{cursor:'pointer'}}>
            <polygon points={attrs(right)} fill="#59615f" stroke="#272d2d" opacity={visual?.mapAsset ? .8 : 1}/>
            <polygon points={attrs(front)} fill="#444d4d" stroke="#272d2d" opacity={visual?.mapAsset?.8:1}/>
            <polygon points={attrs(top)} fill={active?'#e0c05e':isMoon?'#b6b4a9':'#a88c7c'} stroke={active?'#fff0a8':'#2d3535'} strokeWidth={active?2:1.4} opacity={visual?.mapAsset ? .35 : 1}/>
            {visual?.mapAsset&&<image href={visual.mapAsset} x={center.x-spriteW/2} y={center.y-spriteH+8} width={spriteW} height={spriteH} preserveAspectRatio="xMidYMax meet" pointerEvents="none"/>}
            <rect x={center.x-Math.max(18,building.widthM)} y={center.y-Math.max(20,building.depthM)} width={Math.max(36,building.widthM*2)} height={Math.max(38,building.depthM*2)} fill="transparent" pointerEvents="all"/>
            <title>{building.label??building.entityId??'Gebäude'}</title>
          </g>
        })}

        {scene.mobileObjects.map(object=>{
          const interaction=interactions.find(item=>item.id==='mobile:'+object.id)
          const active=selectedId==='mobile:'+object.id
          const person=interaction?.kind==='person'
          return <g key={object.id} onClick={()=>setSelectedId('mobile:'+object.id)} style={{cursor:'pointer'}}>
            {person?<WalkableActor point={object.point} selected={active} appearance={object.id.startsWith('resident:')?residents.find(resident=>resident.id===object.id.slice('resident:'.length))?.appearance:undefined} visualSeed={object.id}/>:<WalkableObject point={object.point} selected={active}/>}<title>{object.label}</title>
          </g>
        })}

        <WalkablePlayer point={player}/>
        </g>
      </WalkableSurfaceSvg>

      <div className="hint"><b>WASD</b> bewegen · <b>Shift</b> schneller · Ziel anklicken · <b>F/Enter</b> interagieren</div>
      {hoveredBuildingId&&(()=>{const building=scene.buildings.find(item=>item.id===hoveredBuildingId);if(!building)return null;const entity=spatial?.entities?.find(item=>item.id===building.id);return <div className="building-hover"><small>GEBÄUDE</small><b>{building.label??building.entityId??'Gebäude'}</b><span>{entity?.owner_class==='STATE'?'Staatlich':entity?.owner_class==='CORPORATION'?'Corporation':entity?.profile_id?'Privat':'Neutral'} · {Math.round(Math.hypot(building.center.xM-player.xM,building.center.yM-player.yM))} m</span></div>})()}

      {selected&&<div className="target">
        <small>{selected.kind.toUpperCase()} · {route?.usesNetwork?'NETZROUTE':'DIREKTE ROUTE'}</small>
        <b>{selected.label}</b>
        <span>{Math.round(selectedDistance??0)} m entfernt · Weg {Math.round(route?.distanceM??0)} m</span>
        {selectedDistance!==null&&selectedDistance>autoWalkStopDistance&&<button onClick={()=>setAutoWalkId(selected.id)}>{autoWalkId===selected.id?'GEHE …':'GEHE DAHIN'}</button>}
        {hasAction
          ? <button disabled={!canInteract} onClick={interact}>{canInteract?(selectedResident?'SPRECHEN':'INTERAGIEREN'):'NÄHER HERANGEHEN'}</button>
          : <em>{selected.building&&!selectedEntity?'im Bau / noch nicht zugänglich':'keine lokale Aktion hinterlegt'}</em>}
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
      .planetary-walkable{position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;z-index:1500;background:#090b0c;color:#e8eef0;font-family:system-ui;overflow:hidden}.planetary-walkable header{height:46px;display:flex;align-items:center;gap:14px;padding:0 14px;background:#07131dec;border-bottom:1px solid #394d59;position:relative;z-index:2}.planetary-walkable header>div:first-child{display:flex;align-items:baseline;gap:9px}.planetary-walkable header small{font:800 8px monospace;letter-spacing:.14em;color:#d7b96e}.planetary-walkable header b{font-size:13px}.planetary-walkable header span{font-size:9px;color:#869ca7}.planetary-walkable .stats{display:flex;gap:10px;margin-left:auto;color:#8ba0aa;font-size:9px}.planetary-walkable header button,.target button{border:1px solid #466578;border-radius:6px;background:#102b3c;color:#e1edf1;padding:6px 9px;cursor:pointer}.target button:disabled{opacity:.45;cursor:not-allowed}.planetary-walkable .stage{position:absolute;inset:46px 0 0}.planetary-walkable svg{width:100%;height:100%;display:block}.planetary-walkable .hint{position:absolute;left:12px;top:12px;padding:6px 8px;border:1px solid #536973;border-radius:6px;background:#071521d9;color:#bdccd2;font:9px monospace}.building-hover{position:absolute;left:12px;top:48px;z-index:6;display:grid;gap:2px;min-width:150px;padding:7px 9px;border:1px solid #5d747d;border-radius:7px;background:#071521e8;box-shadow:0 8px 24px #0007;pointer-events:none}.building-hover small{color:#d7b96e;font:800 7px monospace;letter-spacing:.12em}.building-hover b{font-size:11px}.building-hover span{font-size:9px;color:#9db0b6}.target{position:absolute;right:14px;top:14px;min-width:230px;display:grid;gap:4px;padding:10px 12px;border:1px solid #6f7659;border-radius:8px;background:#101711e8;box-shadow:0 12px 30px #0007}.target small{color:#d7b96e;font:800 8px monospace;letter-spacing:.1em}.target b{font-size:12px}.target span,.target em{color:#9eada6;font-size:9px;font-style:normal}.person-panel,.object-panel{position:absolute;right:14px;top:132px;width:360px;max-height:calc(100% - 150px);overflow:auto;padding:10px;border:1px solid #617b85;border-radius:9px;background:#071521f2;box-shadow:0 16px 38px #0008;backdrop-filter:blur(8px)}.object-panel{max-height:300px}.person-head{display:flex;justify-content:space-between;gap:12px}.person-head small{display:block;color:#d7b96e;font:800 8px monospace;letter-spacing:.12em}.person-head b{display:block;margin-top:3px}.person-head span{display:block;color:#8ba3ad;font-size:9px}.person-head button,.person-chat button{border:1px solid #476476;border-radius:6px;background:#102b3c;color:#dce9ee;padding:6px 9px;cursor:pointer}.person-facts{display:grid;grid-template-columns:90px 1fr;gap:5px;margin-top:10px;font-size:10px}.person-facts span{color:#7e98a3}.person-panel p{margin:9px 0 0;padding-top:8px;border-top:1px solid #314753;color:#d7e4e8;font-size:11px;line-height:1.45}.person-chat{display:flex;gap:6px;margin-top:10px}.person-chat input{flex:1;min-width:0;border:1px solid #476476;border-radius:6px;background:#061019;color:#eef5f7;padding:7px 8px}.planetary-walkable-loading{position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;z-index:1500;display:grid;place-items:center;background:#080c0f;color:#c4d4da;font-family:monospace}@media(max-width:760px){.planetary-walkable .stats{display:none}.target{left:12px;right:12px;top:46px}.person-panel,.object-panel{left:12px;right:12px;top:auto;bottom:12px;width:auto;max-height:42vh}}
    `}</style>
  </section>
}
