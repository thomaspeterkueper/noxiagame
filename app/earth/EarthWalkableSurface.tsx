'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import { getSessionInfo } from '@/lib/supabase/auth'
import { deriveEarthSurfaceTheme } from '@/lib/world/render/earthSurfaceTheme'
import { buildEarthLocalScene, type EarthLocalScene, type ScenePoint } from '@/lib/world/spatial/earthLocalScene'
import { geoToLocalMeters, localMetersToGeo } from '@/lib/world/spatial/earthSpatial'
import { awarenessConversationForResident } from '@/lib/game/npcAwarenessConversation'
import { useEarthPlayerPositionStore } from '@/lib/store/earthPlayerPositionStore'
import { sourceForAwarenessItem, type WorldAwarenessItem } from '@/lib/game/worldAwareness'
import { constructionState } from '@/lib/game/constructionProgress'
import { getBuildingEntryDefinition, type BuildingEntryRequest } from '@/lib/game/buildings/entry'
import EarthBuildingAccessLayer from './EarthBuildingAccessLayer'

type GeoPoint={lat:number;lon:number}
type Feature={id:string;featureType:string;geometry:{kind:'point'|'line'|'polygon';coordinates:GeoPoint|GeoPoint[]};properties?:Record<string,any>}
type Payload={ok:boolean;region?:{id?:string;name:string;origin:GeoPoint};queryCenter?:GeoPoint;bounds?:{south:number;west:number;north:number;east:number};features?:Feature[];error?:string}
type SpatialEntity={id:string;entity_id:string;name?:string;x_m?:number|null;y_m?:number|null;rotation_deg?:number|null;footprint_width_m?:number|null;footprint_depth_m?:number|null;ownerLabel?:string;isOwn?:boolean;status?:string;latitude_deg?:number|null;longitude_deg?:number|null}
type SpatialBuild={id:string;buildable_id:string;name?:string;x_m?:number|null;y_m?:number|null;rotation_deg?:number|null;footprint_width_m?:number|null;footprint_depth_m?:number|null;status?:string;created_at?:string|null;completes_at?:string|null}
type Props={residents:ColonyResident[];onClose:()=>void}
type IsoPoint={x:number;y:number}
type ChatEntry={role:'user'|'assistant';content:string}
type NpcWorldAction={type:'lead_walk';startedAt:number;durationSeconds:number;maxDistanceMeters:number;playerFollows:boolean}|{type:'visit_place';startedAt:number;durationSeconds:number;targetRef:string;targetName:string;targetX:number;targetY:number;startX:number;startY:number;playerFollows:boolean}

const VIEW_W=1200
const VIEW_H=760
const SCENE_RADIUS_M=260
const ISO_X=.92
const ISO_Y=.46
const HEIGHT_PX=12

function role(resident:ColonyResident){return resident.assignments.find(item=>item.type==='work')?.roleCode??resident.activityState??'general'}
function hash(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function iso(point:ScenePoint):IsoPoint{return{x:VIEW_W/2+(point.xM-point.yM)*ISO_X,y:VIEW_H/2+(point.xM+point.yM)*ISO_Y}}
function pathD(points:ScenePoint[]){return points.map((point,index)=>{const p=iso(point);return `${index?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`}).join(' ')}
function polygonD(points:ScenePoint[]){return `${pathD(points)} Z`}
function buildingPolygon(center:ScenePoint,widthM:number,depthM:number){
  const corners=[
    {xM:center.xM-widthM/2,yM:center.yM-depthM/2},
    {xM:center.xM+widthM/2,yM:center.yM-depthM/2},
    {xM:center.xM+widthM/2,yM:center.yM+depthM/2},
    {xM:center.xM-widthM/2,yM:center.yM+depthM/2},
  ]
  return corners.map(iso)
}
function pointsAttr(points:IsoPoint[],dy=0){return points.map(point=>`${point.x},${point.y+dy}`).join(' ')}

export default function EarthWalkableSurface({residents,onClose}:Props){
  const[data,setData]=useState<Payload|null>(null)
  const player=useEarthPlayerPositionStore(s=>s.position)
  const playerRegionId=useEarthPlayerPositionStore(s=>s.regionId)
  const playerGeo=useEarthPlayerPositionStore(s=>s.geo)
  const setSharedPlayerPosition=useEarthPlayerPositionStore(s=>s.setPosition)
  const resetSharedPlayerPosition=useEarthPlayerPositionStore(s=>s.reset)
  const[selected,setSelected]=useState<ColonyResident|null>(null)
  const[message,setMessage]=useState('')
  const[conversationByNpc,setConversationByNpc]=useState<Record<string,ChatEntry[]>>({})
  const[npcWorldActionById,setNpcWorldActionById]=useState<Record<string,NpcWorldAction>>({})
  const[sending,setSending]=useState(false)
  const[playerName,setPlayerName]=useState('Du')
  const[motionTime,setMotionTime]=useState(0)
  const[awarenessItems,setAwarenessItems]=useState<WorldAwarenessItem[]>([])
  const[spatialEntities,setSpatialEntities]=useState<SpatialEntity[]>([])
  const[spatialBuilds,setSpatialBuilds]=useState<SpatialBuild[]>([])
  const[hoveredBuilding,setHoveredBuilding]=useState<{x:number;y:number;name:string;detail:string;distanceM:number}|null>(null)
  const[navigationTargetId,setNavigationTargetId]=useState<string>('')
  const[entryRequest,setEntryRequest]=useState<BuildingEntryRequest|null>(null)
  const localEnrichmentAttempted=useRef(new Set<string>())

  useEffect(()=>{let live=true;fetch('/api/earth/region?v=walkable-v2',{cache:'no-store'}).then(r=>r.json()).then(json=>{if(live)setData(json)}).catch(()=>{if(live)setData({ok:false,error:'Earth-Region nicht erreichbar'})});return()=>{live=false}},[])
  useEffect(()=>{
    const regionId=String((data?.region as any)?.id??'')
    const originPoint=data?.queryCenter??data?.region?.origin
    if(!data?.ok||!regionId.startsWith('earth-place-')||!originPoint)return
    const alreadyEnriched=(data.features??[]).some(feature=>feature.properties?.noxia_enrichment==='local-scene-v1')
    if(alreadyEnriched||localEnrichmentAttempted.current.has(regionId))return
    localEnrichmentAttempted.current.add(regionId)
    let live=true
    ;(async()=>{
      try{
        const {token}=await getSessionInfo()
        const response=await fetch('/api/earth/local-enrich',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({slug:regionId,lat:originPoint.lat,lon:originPoint.lon,radiusKm:.34})})
        if(!response.ok)return
        const refreshed=await fetch('/api/earth/region?v=walkable-v3',{cache:'no-store'}).then(result=>result.json())
        if(live&&refreshed?.ok)setData(refreshed)
      }catch{}
    })()
    return()=>{live=false}
  },[data?.ok,data?.region,data?.queryCenter,data?.features])
  useEffect(()=>{let live=true;getSessionInfo().then(({token})=>fetch('/api/game/profile',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'})).then(response=>response.ok?response.json():null).then(json=>{const username=String(json?.profile?.username??'').trim();if(live&&username)setPlayerName(username)}).catch(()=>{});return()=>{live=false}},[])
  useEffect(()=>{let live=true;getSessionInfo().then(({token})=>fetch('/api/game/build/spatial?location=earth',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'})).then(response=>response.ok?response.json():null).then(json=>{if(!live)return;setSpatialEntities(Array.isArray(json?.entities)?json.entities:[]);setSpatialBuilds(Array.isArray(json?.builds)?json.builds:[])}).catch(()=>{if(live){setSpatialEntities([]);setSpatialBuilds([])}});return()=>{live=false}},[])
  useEffect(()=>{let frame=0,last=0;const tick=(now:number)=>{if(now-last>=80){setMotionTime(now/1000);last=now}frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[])
  useEffect(()=>{let live=true;Promise.all([
    fetch('/api/game/world-awareness',{cache:'no-store'}).then(r=>r.ok?r.json():{items:[]}).catch(()=>({items:[]})),
    fetch('/api/game/world',{cache:'no-store'}).then(r=>r.ok?r.json():{news:[]}).catch(()=>({news:[]})),
  ]).then(([awareness,world])=>{
    if(!live)return
    const real=Array.isArray(awareness?.items)?awareness.items:[]
    const colony=Array.isArray(world?.news)?world.news.slice(0,8).map((item:any,index:number)=>({
      id:`noxia-world:${index}:${String(item?.text??'').slice(0,24)}`,
      sourceId:'noxia-world',
      title:String(item?.text??'').trim(),
      summary:'',
      url:'',
      publishedAt:new Date().toISOString(),
      topics:['general'] as any,
      kind:'colony' as const,
    })).filter((item:any)=>item.title):[]
    setAwarenessItems([...colony,...real].slice(0,28))
  });return()=>{live=false}},[])

  const features=data?.features??[]
  const origin=data?.queryCenter??data?.region?.origin
  useEffect(()=>{
    const regionId=(data?.region as any)?.id??null
    if(!origin)return
    if(regionId&&playerRegionId&&playerRegionId!==regionId){
      resetSharedPlayerPosition(regionId,origin)
      return
    }
    if(!playerRegionId){
      setSharedPlayerPosition(regionId,player,playerGeo??localMetersToGeo({eastM:player.xM,northM:player.yM},origin))
      return
    }
    if(!playerGeo){
      setSharedPlayerPosition(regionId,player,localMetersToGeo({eastM:player.xM,northM:player.yM},origin))
    }
  },[data?.region,origin,playerRegionId,player,playerGeo,resetSharedPlayerPosition,setSharedPlayerPosition])
  const theme=useMemo(()=>deriveEarthSurfaceTheme(Number(origin?.lat??0),features),[origin?.lat,features])
  const scene=useMemo<EarthLocalScene|null>(()=>origin?buildEarthLocalScene({origin,features,radiusM:SCENE_RADIUS_M}):null,[origin,features])
  const namedPoiTargets=useMemo(()=>origin?features.flatMap(feature=>{
    if(feature.geometry.kind!=='point'||!feature.properties?.name)return[]
    const point=feature.geometry.coordinates as GeoPoint
    const metric=geoToLocalMeters(point,origin)
    if(Math.abs(metric.eastM)>SCENE_RADIUS_M||Math.abs(metric.northM)>SCENE_RADIUS_M)return[]
    return[{id:`poi:${feature.id}`,name:String(feature.properties.name),xM:metric.eastM,yM:metric.northM,kind:String(feature.properties?.visual_class??feature.featureType)}]
  }).slice(0,30):[],[origin,features])
  const buildingTargets=useMemo(()=>spatialEntities.flatMap(entity=>{
    const xM=Number(entity.x_m),yM=Number(entity.y_m)
    if(!Number.isFinite(xM)||!Number.isFinite(yM)||Math.abs(xM)>SCENE_RADIUS_M||Math.abs(yM)>SCENE_RADIUS_M)return[]
    return[{id:`building:${entity.id}`,name:String(entity.name??entity.entity_id),xM,yM,kind:'NOXIA-Gebäude',entity}]
  }),[spatialEntities])
  const pendingTargets=useMemo(()=>spatialBuilds.flatMap(build=>{
    const xM=Number(build.x_m),yM=Number(build.y_m)
    if(!Number.isFinite(xM)||!Number.isFinite(yM)||Math.abs(xM)>SCENE_RADIUS_M||Math.abs(yM)>SCENE_RADIUS_M)return[]
    const state=constructionState({
      buildable_id:build.buildable_id,
      tile_row:0,
      tile_col:0,
      status:build.status??'building',
      created_at:build.created_at,
      completes_at:build.completes_at,
    },Date.now())
    return[{id:`pending:${build.id}`,name:String(build.name??build.buildable_id),xM,yM,kind:'Baustelle',build,state}]
  }),[spatialBuilds,motionTime])
  const navigationTargets=useMemo(()=>[...buildingTargets,...pendingTargets,...namedPoiTargets].sort((a,b)=>a.name.localeCompare(b.name,'de')),[buildingTargets,pendingTargets,namedPoiTargets])
  const navigationTarget=navigationTargets.find(target=>target.id===navigationTargetId)??null
  const targetDistance=navigationTarget?Math.hypot(navigationTarget.xM-player.xM,navigationTarget.yM-player.yM):null
  const selectedBuildingTarget=buildingTargets.find(target=>target.id===navigationTargetId)??null
  const selectedBuildingEntry=selectedBuildingTarget?getBuildingEntryDefinition(selectedBuildingTarget.entity.entity_id):null
  const canEnterSelectedBuilding=Boolean(selectedBuildingTarget&&selectedBuildingEntry&&targetDistance!==null&&targetDistance<=8)

  function enterSelectedBuilding(){
    if(!selectedBuildingTarget||!selectedBuildingEntry||!canEnterSelectedBuilding)return
    setEntryRequest({
      entityId:selectedBuildingTarget.entity.id,
      buildingTypeId:selectedBuildingTarget.entity.entity_id,
      buildingName:selectedBuildingTarget.name,
      kind:selectedBuildingEntry.kind,
    })
  }

  const baseLocalFacts=useMemo(()=>{
    const facts:string[]=[]
    if(data?.region?.name)facts.push(`Ort: ${data.region.name}`)
    if(scene){
      facts.push(`${scene.roadGraph.length} lokale Straßensegmente im aktuellen Ausschnitt`)
      facts.push(`${scene.railGraph.length} lokale Schienensegmente im aktuellen Ausschnitt`)
      if(scene.polygons.some(item=>item.kind==='water')||scene.paths.some(item=>item.kind==='waterway'))facts.push('Wasserlauf oder Wasserfläche im aktuellen Ausschnitt vorhanden')
      if(scene.polygons.some(item=>item.kind==='forest'||item.kind==='vegetation'))facts.push('Vegetations- bzw. Waldflächen im aktuellen Ausschnitt vorhanden')
    }
    return facts
  },[data?.region?.name,scene])

  const npcPositions=useMemo(()=>scene?residents.slice(0,18).map((resident,index)=>{
    const h=hash(resident.id)
    const road=scene.roadGraph.length?scene.roadGraph[h%scene.roadGraph.length]:null
    const fallback={xM:-90+(h%180),yM:-70+((h>>>9)%140)}
    if(!road||road.points.length<2)return{resident,...fallback}

    const segments=road.points.slice(1).map((point,i)=>{
      const from=road.points[i]
      const length=Math.hypot(point.xM-from.xM,point.yM-from.yM)
      return{from,to:point,length}
    }).filter(segment=>segment.length>.01)
    const total=segments.reduce((sum,segment)=>sum+segment.length,0)
    if(total<=0)return{resident,...fallback}

    const state=resident.activityState.toLowerCase()
    const baseSpeed=/work|travel|move|commut|deliver|patrol/.test(state)?1.45:/idle|rest|sleep/.test(state)?.32:.8
    const phase=(h%10000)/10000
    const stopCycle=(Math.sin(motionTime*.22+phase*Math.PI*2)+1)/2
    const stopFactor=/idle|rest/.test(state)&&stopCycle<.42?0:1
    const speed=baseSpeed*stopFactor
    const selectedNpc=selected?.id===resident.id
    const action=npcWorldActionById[resident.id]
    let position:{xM:number;yM:number}
    if(action?.type==='visit_place'){
      const progress=action.durationSeconds>0?Math.max(0,Math.min(1,(motionTime-action.startedAt)/action.durationSeconds)):1
      position={
        xM:action.startX+(action.targetX-action.startX)*progress,
        yM:action.startY+(action.targetY-action.startY)*progress,
      }
    }else{
      const actionElapsed=action?.type==='lead_walk'?Math.max(0,Math.min(action.durationSeconds,motionTime-action.startedAt)):0
      const actionSpeed=action?.type==='lead_walk'&&action.durationSeconds>0?action.maxDistanceMeters/action.durationSeconds:0
      const travelDistance=action?.type==='lead_walk'
        ? actionElapsed*actionSpeed
        : selectedNpc?0:motionTime*speed
      const distance=((phase*total)+travelDistance)%total

      let walked=0
      position=road.points[0]
      for(const segment of segments){
        if(distance<=walked+segment.length){
          const t=(distance-walked)/segment.length
          position={
            xM:segment.from.xM+(segment.to.xM-segment.from.xM)*t,
            yM:segment.from.yM+(segment.to.yM-segment.from.yM)*t,
          }
          break
        }
        walked+=segment.length
      }
    }
    return{
      resident,
      xM:Math.max(-SCENE_RADIUS_M,Math.min(SCENE_RADIUS_M,position.xM+((index%3)-1)*2.5)),
      yM:Math.max(-SCENE_RADIUS_M,Math.min(SCENE_RADIUS_M,position.yM+((index%2)?2:-2))),
    }
  }):[],[scene,residents,motionTime,selected?.id,npcWorldActionById])

  function perceivedLocalFactsForNpc(npcId:string){
    const npc=npcPositions.find(item=>item.resident.id===npcId)
    if(!npc)return baseLocalFacts
    const MAX_VISIBLE_PLACE_M=45
    const placeFacts=[
      ...buildingTargets.map(target=>({
        name:target.name,
        kind:target.kind,
        distance:Math.hypot(target.xM-npc.xM,target.yM-npc.yM),
        status:String(target.entity?.status??'aktiv'),
      })),
      ...namedPoiTargets.map(target=>({
        name:target.name,
        kind:target.kind,
        distance:Math.hypot(target.xM-npc.xM,target.yM-npc.yM),
        status:'sichtbar',
      })),
      ...pendingTargets.map(target=>({
        name:target.name,
        kind:'Baustelle',
        distance:Math.hypot(target.xM-npc.xM,target.yM-npc.yM),
        status:'im Bau',
      })),
    ]
      .filter(place=>place.distance<=MAX_VISIBLE_PLACE_M)
      .sort((a,b)=>a.distance-b.distance||a.name.localeCompare(b.name,'de'))
      .slice(0,10)
      .map(place=>`In der Nähe: ${place.name} · ${place.kind} · ca. ${Math.max(1,Math.round(place.distance))} m entfernt · ${place.status}`)

    return [...baseLocalFacts,...placeFacts].slice(0,16)
  }

  function perceivedNearbyPlacesForNpc(npcId:string){
    const npc=npcPositions.find(item=>item.resident.id===npcId)
    if(!npc)return[]
    const places=[
      ...buildingTargets.map(target=>({targetRef:target.id,name:target.name,kind:target.kind,xM:target.xM,yM:target.yM,distanceM:Math.hypot(target.xM-npc.xM,target.yM-npc.yM)})),
      ...namedPoiTargets.map(target=>({targetRef:target.id,name:target.name,kind:target.kind,xM:target.xM,yM:target.yM,distanceM:Math.hypot(target.xM-npc.xM,target.yM-npc.yM)})),
    ]
      .filter(place=>place.distanceM<=45)
      .sort((a,b)=>a.distanceM-b.distanceM||a.name.localeCompare(b.name,'de'))
      .slice(0,10)
    return places.map((place,index)=>({...place,key:`p${index}`}))
  }

  const ambientConversation=useMemo(()=>{
    if(!awarenessItems.length||npcPositions.length<2)return null
    let best:{a:typeof npcPositions[number];b:typeof npcPositions[number];pairDistance:number;playerDistance:number}|null=null
    for(let i=0;i<npcPositions.length;i++){
      for(let j=i+1;j<npcPositions.length;j++){
        const a=npcPositions[i],b=npcPositions[j]
        const pairDistance=Math.hypot(a.xM-b.xM,a.yM-b.yM)
        if(pairDistance>4)continue
        const playerDistance=Math.min(
          Math.hypot(a.xM-player.xM,a.yM-player.yM),
          Math.hypot(b.xM-player.xM,b.yM-player.yM),
        )
        if(playerDistance>9)continue
        if(!best||pairDistance+playerDistance*.25<best.pairDistance+best.playerDistance*.25)best={a,b,pairDistance,playerDistance}
      }
    }
    if(!best)return null
    const dayKey=new Date().toISOString().slice(0,10)
    const conversation=awarenessConversationForResident(best.a.resident.id,role(best.a.resident),awarenessItems,dayKey)
    if(!conversation)return null
    return{
      first:best.a.resident,
      second:best.b.resident,
      conversation,
      source:sourceForAwarenessItem(conversation.item),
      playerDistance:best.playerDistance,
    }
  },[awarenessItems,npcPositions,player])

  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{const target=event.target as HTMLElement|null;if(target?.closest('input,textarea'))return;const step=event.shiftKey?8:4;const key=event.key.toLowerCase();if(!['w','a','s','d'].includes(key))return;event.preventDefault();setNpcWorldActionById(current=>Object.fromEntries(Object.entries(current).map(([id,action])=>[id,{...action,playerFollows:false}])));(()=>{const next={xM:Math.max(-SCENE_RADIUS_M,Math.min(SCENE_RADIUS_M,player.xM+(key==='d'?step:key==='a'?-step:0))),yM:Math.max(-SCENE_RADIUS_M,Math.min(SCENE_RADIUS_M,player.yM+(key==='s'?step:key==='w'?-step:0)))};setSharedPlayerPosition((data?.region as any)?.id??null,next,origin?localMetersToGeo({eastM:next.xM,northM:next.yM},origin):playerGeo)})()};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[data?.region,origin,player,playerGeo,setSharedPlayerPosition])

  useEffect(()=>{
    const entry=Object.entries(npcWorldActionById).find(([,action])=>action.playerFollows&&motionTime-action.startedAt>=0&&motionTime-action.startedAt<action.durationSeconds)
    if(!entry||!origin)return
    const [npcId]=entry
    const npc=npcPositions.find(item=>item.resident.id===npcId)
    if(!npc)return
    const dx=npc.xM-player.xM,dy=npc.yM-player.yM
    const distance=Math.hypot(dx,dy)
    if(distance<=5||distance===0)return
    const step=Math.min(1.8,distance-5)
    const next={xM:player.xM+dx/distance*step,yM:player.yM+dy/distance*step}
    setSharedPlayerPosition((data?.region as any)?.id??null,next,localMetersToGeo({eastM:next.xM,northM:next.yM},origin))
  },[motionTime,npcWorldActionById,npcPositions,player,origin,data?.region,setSharedPlayerPosition])

  useEffect(()=>{
    const onEnter=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null
      if(target?.closest('input,textarea,select,[contenteditable="true"]'))return
      if((event.key==='f'||event.key==='Enter')&&canEnterSelectedBuilding){
        event.preventDefault()
        enterSelectedBuilding()
      }
    }
    window.addEventListener('keydown',onEnter)
    return()=>window.removeEventListener('keydown',onEnter)
  },[canEnterSelectedBuilding,selectedBuildingTarget?.id])

  const activeActionForSelected=selected?npcWorldActionById[selected.id]:null
  const interiorCompanion=selected&&activeActionForSelected?.type==='visit_place'&&activeActionForSelected.targetRef===navigationTargetId
    ? selected
    : null
  const selectedActionActive=Boolean(activeActionForSelected&&motionTime-activeActionForSelected.startedAt>=0&&motionTime-activeActionForSelected.startedAt<activeActionForSelected.durationSeconds)

  async function talk(){
    if(!selected||!message.trim()||sending)return
    const playerMessage=message.trim().slice(0,80)
    if(!playerMessage)return
    const history=conversationByNpc[selected.id]??[]
    setSending(true)
    try{
      const{token}=await getSessionInfo()
      const response=await fetch('/api/game/npc-conversation',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({player:playerMessage,npcId:selected.id,npcName:selected.displayName,npcRole:role(selected),headline:`Lokales Gespräch in ${data?.region?.name??'der aktuellen Earth-Region'}`,source:'NOXIA Earth local scene',locationName:data?.region?.name??'Erde',localFacts:perceivedLocalFactsForNpc(selected.id),nearbyPlaces:perceivedNearbyPlacesForNpc(selected.id).map(({key,targetRef,name,kind,distanceM})=>({key,targetRef,name,kind,distanceM})),history})})
      const json=await response.json().catch(()=>({}))
      const npcReply=response.ok&&json.reply?String(json.reply):'Die Person kann gerade nicht antworten.'
      if(response.ok){
        setConversationByNpc(current=>({
          ...current,
          [selected.id]:[...(current[selected.id]??[]),{role:'user' as const,content:playerMessage},{role:'assistant' as const,content:npcReply}].slice(-10),
        }))
        const action=json?.worldAction
        if(action?.type==='visit_place'){
          const place=perceivedNearbyPlacesForNpc(selected.id).find(candidate=>candidate.targetRef===action.targetRef)
          const npc=npcPositions.find(item=>item.resident.id===selected.id)
          if(place&&npc){
            setNavigationTargetId(place.targetRef)
            setNpcWorldActionById(current=>({
              ...current,
              [selected.id]:{
                type:'visit_place',
                startedAt:motionTime,
                durationSeconds:Math.max(4,Math.min(35,Number(action.durationSeconds??8))),
                targetRef:place.targetRef,
                targetName:place.name,
                targetX:place.xM,
                targetY:place.yM,
                startX:npc.xM,
                startY:npc.yM,
                playerFollows:Boolean(action.playerFollows),
              },
            }))
          }
        }else if(action?.type==='lead_walk'&&scene?.roadGraph?.length){
          setNpcWorldActionById(current=>({
            ...current,
            [selected.id]:{
              type:'lead_walk',
              startedAt:motionTime,
              durationSeconds:Math.max(5,Math.min(60,Number(action.durationSeconds??30))),
              maxDistanceMeters:Math.max(5,Math.min(80,Number(action.maxDistanceMeters??45))),
              playerFollows:Boolean(action.playerFollows),
            },
          }))
        }
        setMessage('')
      }
    }catch{
      setConversationByNpc(current=>({
        ...current,
        [selected.id]:[...(current[selected.id]??[]),{role:'assistant' as const,content:'Gespräch derzeit nicht erreichbar.'}].slice(-10),
      }))
    }finally{setSending(false)}
  }

  if(!data)return <div className="earth-walkable-loading">Lokale Earth-Szene wird aufgebaut …</div>
  if(!data.ok||!scene)return <div className="earth-walkable-loading">Earth-Szene nicht verfügbar: {data.error??'keine Region'}</div>

  const playerIso=iso(player)

  return <section className="earth-walkable" aria-label={`Begehbarer Ort ${data.region?.name??'Erde'}`}>
    <header><div><small>EARTH · LOCAL SCENE</small><b>{data.region?.name??'Aktueller Ort'}</b><span>{theme.label}</span></div><div className="meta"><span>{scene.buildings.length} Gebäude/Massen</span><span>{scene.roadGraph.length} Straßen</span><span>{scene.railGraph.length} Schienen</span></div><button onClick={onClose}>← Karte</button></header>
    <div className="earth-walkable-stage">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="earth-scene-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={theme.backgroundAlt}/><stop offset="100%" stopColor={theme.background}/></linearGradient>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} fill="url(#earth-scene-ground)"/>

        {scene.polygons.map(feature=>{
          const fill=feature.kind==='water'?'#6aa9c6':feature.kind==='forest'?theme.vegetation:feature.kind==='vegetation'?theme.backgroundAlt:feature.kind==='farmland'?'#bda96c':'#a9aaa0'
          return <path key={feature.id} d={polygonD(feature.points)} fill={fill} stroke={feature.kind==='water'?'#4d8eae':'rgba(54,71,57,.5)'} strokeWidth="1" opacity={feature.kind==='urban' ? .72 : .88}/>
        })}

        {scene.paths.filter(path=>path.kind==='waterway').map(path=><path key={path.id} d={pathD(path.points)} fill="none" stroke="#5ca6c8" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>)}
        {scene.paths.filter(path=>path.kind==='rail').map(path=><g key={path.id}><path d={pathD(path.points)} fill="none" stroke="#444b4c" strokeWidth="5" strokeLinecap="round"/><path d={pathD(path.points)} fill="none" stroke="#a9acaa" strokeWidth="1.3" strokeDasharray="5 4"/></g>)}
        {scene.paths.filter(path=>path.kind==='road').map(path=>{const major=/motorway|trunk|primary|secondary/.test(path.className??'');return <g key={path.id}><path d={pathD(path.points)} fill="none" stroke={major?'#d4c3a0':'#ddd8ca'} strokeWidth={major?12:8} strokeLinecap="round" strokeLinejoin="round"/><path d={pathD(path.points)} fill="none" stroke={major?'#b4975d':'#b6b0a4'} strokeWidth="1.1" strokeDasharray={major?'8 8':'3 7'}/></g>})}

        {pendingTargets.map(target=>{
          const build=target.build
          const width=Math.max(8,Number(build.footprint_width_m??18))
          const depth=Math.max(8,Number(build.footprint_depth_m??14))
          const top=buildingPolygon({xM:target.xM,yM:target.yM},width,depth)
          const distanceM=Math.hypot(target.xM-player.xM,target.yM-player.yM)
          const pct=Math.round(target.state.progress*100)
          const detail=`im Bau · ${target.state.phaseLabel} · ${pct} %`
          return <g key={target.id} style={{cursor:'pointer'}} onClick={()=>setNavigationTargetId(target.id)}
            onMouseMove={event=>setHoveredBuilding({x:event.clientX,y:event.clientY,name:target.name,detail,distanceM})}
            onMouseLeave={()=>setHoveredBuilding(null)}>
            <polygon points={pointsAttr(top)} fill={navigationTargetId===target.id?'#e0c05e':'#d7a941'} fillOpacity=".68" stroke="#6e5317" strokeWidth="1.6" strokeDasharray="5 3"/>
            <circle cx={iso({xM:target.xM,yM:target.yM}).x} cy={iso({xM:target.xM,yM:target.yM}).y} r="4" fill="#6e5317"/>
            <title>{target.name} · {detail} · {Math.round(distanceM)} m</title>
          </g>
        })}

        {buildingTargets.map(target=>{
          const entity=target.entity
          const width=Math.max(8,Number(entity.footprint_width_m??18))
          const depth=Math.max(8,Number(entity.footprint_depth_m??14))
          const top=buildingPolygon({xM:target.xM,yM:target.yM},width,depth)
          const side=top.map(point=>({x:point.x,y:point.y+HEIGHT_PX+4}))
          const facade=[top[1],top[2],side[2],side[1]]
          const front=[top[2],top[3],side[3],side[2]]
          const distanceM=Math.hypot(target.xM-player.xM,target.yM-player.yM)
          return <g key={target.id} style={{cursor:'pointer'}} onClick={()=>setNavigationTargetId(target.id)}
            onMouseMove={event=>setHoveredBuilding({x:event.clientX,y:event.clientY,name:target.name,detail:`${entity.ownerLabel??'NOXIA'} · ${entity.status??'aktiv'}`,distanceM})}
            onMouseLeave={()=>setHoveredBuilding(null)}>
            <polygon points={pointsAttr(facade)} fill="#496778" stroke="#183643" strokeWidth="1.1"/>
            <polygon points={pointsAttr(front)} fill="#365462" stroke="#183643" strokeWidth="1.1"/>
            <polygon points={pointsAttr(top)} fill={navigationTargetId===target.id?'#e0c05e':'#89a8b4'} stroke="#173845" strokeWidth="1.4"/>
            <title>{target.name} · {entity.ownerLabel??'NOXIA'} · {Math.round(distanceM)} m</title>
          </g>
        })}

        {scene.buildings.map(building=>{
          const top=buildingPolygon(building.center,building.widthM,building.depthM)
          const side=top.map(point=>({x:point.x,y:point.y+HEIGHT_PX}))
          const facade=[top[1],top[2],side[2],side[1]]
          const front=[top[2],top[3],side[3],side[2]]
          const distanceM=Math.hypot(building.center.xM-player.xM,building.center.yM-player.yM)
          return <g key={building.id} opacity={building.provenance==='observed'?1:.78} style={{cursor:'help'}}
            onMouseMove={event=>setHoveredBuilding({x:event.clientX,y:event.clientY,name:building.label??'Gebäude',detail:building.provenance==='observed'?'reale Geometrie':'abgeleitete Bebauungsmasse',distanceM})}
            onMouseLeave={()=>setHoveredBuilding(null)}>
            <polygon points={pointsAttr(facade)} fill="#6f7776" stroke="#39464b" strokeWidth="1"/>
            <polygon points={pointsAttr(front)} fill="#596466" stroke="#39464b" strokeWidth="1"/>
            <polygon points={pointsAttr(top)} fill={building.provenance==='observed'?'#d7d2c5':'#c8c3b8'} stroke="#4b5759" strokeWidth="1.2"/>
            <title>{building.label??'Gebäude'} · {building.provenance==='observed'?'reale Geometrie':'abgeleitete Bebauungsmasse'}</title>
          </g>
        })}

        {navigationTarget&&(()=>{const from=iso(player),to=iso({xM:navigationTarget.xM,yM:navigationTarget.yM});return <g pointerEvents="none"><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#f1d57a" strokeWidth="1.4" strokeDasharray="7 5" opacity=".85"/><circle cx={to.x} cy={to.y} r="8" fill="none" stroke="#f1d57a" strokeWidth="2"/></g>})()}

        {npcPositions.map(({resident,xM,yM})=>{const p=iso({xM,yM});const name=resident.displayName;const selectedNpc=selected?.id===resident.id;const labelWidth=Math.max(42,Math.min(112,name.length*6.1+14));return <g key={resident.id} transform={`translate(${p.x} ${p.y-8})`} onClick={()=>{setSelected(resident);setMessage('')}} style={{cursor:'pointer'}}>
          <ellipse cy="10" rx="7" ry="3" fill="#000" opacity=".25"/>
          <circle cy="-3" r="4" fill="#efc39d" stroke="#173845" strokeWidth="1"/>
          <path d="M-5 11 Q0 1 5 11 L4 18 L-4 18 Z" fill={selectedNpc?'#e4bd4b':'#2e6274'} stroke="#173845" strokeWidth="1"/>
          <g pointerEvents="none" transform="translate(0 -18)">
            <rect x={-labelWidth/2} y="-12" width={labelWidth} height="14" rx="4" fill={selectedNpc?'#173845ee':'#071521d9'} stroke={selectedNpc?'#e4bd4b':'#57717d'} strokeWidth=".8"/>
            <text x="0" y="-2.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#edf4f5">{name}</text>
          </g>
          <title>{resident.displayName} · {role(resident)}</title>
        </g>})}

        <g transform={`translate(${playerIso.x} ${playerIso.y-9})`}>
          <ellipse cy="11" rx="8" ry="3.5" fill="#000" opacity=".28"/>
          <circle cy="-4" r="4.5" fill="#f0c49c" stroke="#493c18" strokeWidth="1.2"/>
          <path d="M-6 12 Q0 0 6 12 L5 20 L-5 20 Z" fill="#d4ad43" stroke="#594717" strokeWidth="1.2"/>
          <g pointerEvents="none" transform="translate(0 -20)">
            <rect x={-Math.max(44,Math.min(118,playerName.length*6.1+16))/2} y="-12" width={Math.max(44,Math.min(118,playerName.length*6.1+16))} height="14" rx="4" fill="#173845ee" stroke="#e4bd4b" strokeWidth=".9"/>
            <text x="0" y="-2.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff7d8">{playerName}</text>
          </g>
        </g>
      </svg>

      <div className="earth-orientation">
        <div><small>DU BIST HIER</small><b>{data.region?.name??'Erde'}</b><span>{player.xM>=0?'+':''}{Math.round(player.xM)} m Ost · {player.yM>=0?'+':''}{Math.round(player.yM)} m Nord vom Szenenzentrum</span></div>
        <label><span>Ziel</span><select value={navigationTargetId} onChange={event=>setNavigationTargetId(event.target.value)}>
          <option value="">— kein Ziel —</option>
          {navigationTargets.map(target=><option key={target.id} value={target.id}>{target.name}</option>)}
        </select></label>
        {navigationTarget&&<div className="earth-target"><b>{navigationTarget.name}</b><span>{Math.round(targetDistance??0)} m entfernt</span>{selectedBuildingEntry&&<button disabled={!canEnterSelectedBuilding} onClick={enterSelectedBuilding} title={canEnterSelectedBuilding?selectedBuildingEntry.hint:'Gehe bis auf etwa 8 m an das Gebäude heran'}>{canEnterSelectedBuilding?'BETRETEN':'NÄHER HERANGEHEN'}</button>}</div>}
      </div>
      {pendingTargets.length>0&&<div className="earth-construction-hint">Baustellen sind gelb gestrichelt markiert und zeigen Bauphase + Fortschritt.</div>}
      {hoveredBuilding&&<div className="earth-building-tooltip" style={{left:hoveredBuilding.x+12,top:hoveredBuilding.y+12}}>
        <b>{hoveredBuilding.name}</b><span>{hoveredBuilding.detail}</span><small>{Math.round(hoveredBuilding.distanceM)} m von dir</small>
      </div>}

      <div className="earth-walkable-help"><b>WASD</b> bewegen · <b>Shift</b> schneller · NPC anklicken · lokale 2.5D-Szene aus realer Geographie</div>
      <div className="earth-walkable-provenance">Gebäude ohne reale Footprints werden vorläufig als <b>abgeleitete Bebauungsmasse</b> dargestellt. Straßen, Wasser, Landnutzung und Routen stammen aus dem persistierten Orts-Snapshot.</div>

      {ambientConversation&&!selected&&<div className="earth-overheard">
        <small>GESPRÄCH IN HÖRWEITE · {ambientConversation.conversation.item.kind==='colony'?'NOXIA':'HEUTE'}</small>
        <b>{ambientConversation.first.displayName} + {ambientConversation.second.displayName}</b>
        <p><strong>{ambientConversation.first.displayName}:</strong> „{ambientConversation.conversation.opener}“</p>
        <p><strong>{ambientConversation.second.displayName}:</strong> „{ambientConversation.conversation.followUp}“</p>
        <span>{ambientConversation.conversation.item.kind==='colony'?'NOXIA-Weltgeschehen':`Reale Meldung · ${ambientConversation.source?.name??ambientConversation.conversation.item.sourceId}`} · ca. {Math.round(ambientConversation.playerDistance)} m entfernt</span>
      </div>}

      {selected&&<aside><div className="head"><div><small>NPC · LOKAL</small><b>{selected.displayName}</b><span>{role(selected)}</span></div><button onClick={()=>setSelected(null)}>×</button></div><div className="facts"><span>Aktivität</span><b>{selectedActionActive?'geht voraus':selected.activityState}</b><span>Letzte Aktion</span><b>{selectedActionActive?(activeActionForSelected?.type==='visit_place'?`geht zu ${activeActionForSelected.targetName}`:(activeActionForSelected?.playerFollows?'führt dich den Weg entlang':'geht den Weg entlang')):selected.lastAction??'–'}</b></div>{(conversationByNpc[selected.id]??[]).map((entry,index)=><p key={`${entry.role}-${index}`}><b>{entry.role==='user'?'Du':selected.displayName}:</b> „{entry.content}“</p>)}<div className="chat"><input value={message} maxLength={80} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void talk()}} placeholder="Kurze Antwort …"/><button disabled={sending||!message.trim()} onClick={()=>void talk()}>{sending?'…':'Sprechen'}</button></div><div style={{marginTop:3,textAlign:'right',color:message.length>=70?'#f1d57a':'#738795',fontSize:9}}>{message.length}/80</div></aside>}
    </div>
    <EarthBuildingAccessLayer request={entryRequest} companion={interiorCompanion} onClose={()=>setEntryRequest(null)}/>
    <style jsx>{`
      .earth-walkable{position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;z-index:1120;background:#0b1115;color:#e7eef0;font-family:system-ui;overflow:hidden}.earth-walkable header{height:46px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 14px;background:#081723ef;border-bottom:1px solid #38546b;position:relative;z-index:3}.earth-walkable header>div:first-child{display:flex;align-items:baseline;gap:10px;min-width:0}.earth-walkable header small{font:800 8px monospace;letter-spacing:.14em;color:#d7b96e}.earth-walkable header b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.earth-walkable header span{font-size:9px;color:#8ea4af}.earth-walkable header .meta{display:flex;gap:10px;margin-left:auto}.earth-walkable header button,.earth-walkable aside button{border:1px solid #476476;border-radius:6px;background:#102b3c;color:#dce9ee;padding:6px 9px;cursor:pointer}.earth-walkable-stage{position:absolute;inset:46px 0 0;overflow:hidden}.earth-walkable-stage svg{width:100%;height:100%;display:block}.earth-orientation{position:absolute;right:16px;top:16px;z-index:4;display:flex;gap:10px;align-items:center;padding:9px 11px;border:1px solid #536f7d;border-radius:8px;background:#071521df;backdrop-filter:blur(7px);font-size:9px}.earth-orientation>div:first-child{display:grid;gap:1px}.earth-orientation small{color:#d7b96e;font:800 8px monospace;letter-spacing:.1em}.earth-orientation b{font-size:11px}.earth-orientation span{color:#89a1ac}.earth-orientation label{display:grid;gap:2px;min-width:180px}.earth-orientation select{max-width:220px;border:1px solid #476476;border-radius:5px;background:#06111a;color:#e7eff2;padding:5px 7px;font-size:9px}.earth-target{display:grid;gap:3px;padding-left:9px;border-left:1px solid #425b67}.earth-target button{margin-top:3px;border:1px solid #6e7d55;border-radius:4px;background:#273d24;color:#edf3dd;padding:4px 6px;font:800 8px monospace;cursor:pointer}.earth-target button:disabled{opacity:.45;cursor:not-allowed}.earth-construction-hint{position:absolute;left:12px;top:76px;padding:5px 7px;border:1px solid #8a6a20;border-radius:5px;background:#2a220ed9;color:#ead59a;font:8px monospace}.earth-building-tooltip{position:fixed;z-index:5000;pointer-events:none;display:grid;gap:2px;min-width:150px;max-width:240px;padding:7px 9px;border:1px solid #6b8793;border-radius:6px;background:#06131df2;color:#ecf3f5;box-shadow:0 8px 24px #0007;font-size:9px}.earth-building-tooltip b{font-size:10px}.earth-building-tooltip span,.earth-building-tooltip small{color:#90a6af}
      .earth-walkable-help,.earth-walkable-provenance{position:absolute;left:12px;padding:6px 8px;border:1px solid #4b6877;border-radius:6px;background:#071521d9;font:9px monospace;color:#b7c8cf}.earth-walkable-help{top:12px}.earth-walkable-provenance{top:44px;max-width:520px;color:#92a9b2}.earth-overheard{position:absolute;left:16px;bottom:84px;width:360px;max-width:calc(100vw - 32px);padding:10px 12px;border:1px solid #567487;border-radius:9px;background:#071521e8;box-shadow:0 12px 28px #0007;color:#dce8ed;backdrop-filter:blur(7px)}.earth-overheard small{display:block;color:#7fb1c9;font:800 8px monospace;letter-spacing:.1em}.earth-overheard>b{display:block;margin-top:3px;font-size:11px}.earth-overheard p{margin:6px 0 0;font-size:10px;line-height:1.4}.earth-overheard>span{display:block;margin-top:7px;color:#879ca7;font-size:8px}.earth-walkable aside{position:absolute;right:16px;top:16px;width:390px;max-height:calc(100% - 32px);overflow:auto;padding:10px;border:1px solid #617b85;border-radius:9px;background:#071521f2;box-shadow:0 16px 38px #0008;backdrop-filter:blur(8px)}.earth-walkable .head{display:flex;justify-content:space-between;gap:12px}.earth-walkable .head small{display:block;color:#d7b96e;font:800 8px monospace;letter-spacing:.12em}.earth-walkable .head b{display:block;margin-top:3px}.earth-walkable .head span{display:block;margin-top:2px;color:#8ba3ad;font-size:9px}.earth-walkable .facts{display:grid;grid-template-columns:90px 1fr;gap:5px;margin-top:10px;font-size:10px}.earth-walkable .facts span{color:#7e98a3}.earth-walkable .chat{display:flex;gap:6px;margin-top:10px}.earth-walkable .chat input{flex:1;min-width:0;border:1px solid #476476;border-radius:6px;background:#061019;color:#eef5f7;padding:7px 8px}.earth-walkable aside p{margin:9px 0 0;padding-top:8px;border-top:1px solid #314753;color:#d7e4e8;font-size:11px;line-height:1.45}.earth-walkable-loading{position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;z-index:1120;display:grid;place-items:center;background:#07111b;color:#bcd2dc;font-family:monospace}
      @media(max-width:760px){.earth-walkable header .meta{display:none}.earth-orientation{left:12px;right:12px;top:12px;flex-wrap:wrap}.earth-orientation label{min-width:140px;flex:1}.earth-walkable-provenance{max-width:calc(100% - 24px)}.earth-overheard{left:12px;right:12px;bottom:92px;width:auto}.earth-walkable aside{left:12px;right:12px;top:auto;bottom:92px;width:auto;max-height:42vh}}
    `}</style>
  </section>
}
