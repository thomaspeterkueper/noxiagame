'use client'

// app/earth/EarthWalkableSurface.tsx
// Aktualisiert: 28.10.2026 — Gesprächsende sperrt das Eingabefeld (useConversationEnd); 26.10.2026: Betriebe aus realen Gewerbe-Orten: Marker mit erfundenem Namen und Funktion, betretbar (Laden/Werkstatt) mit Personal; realer Name nur im Tooltip; 12.10.2026 — reale Gebäude als eigene, einmal je Szene aufgebaute Ebene mit Walmdächern und Fensterreihen; 2,5D-Gebäude: reale Häuser mit Höhe, belichteten Wänden, Dachform und Schatten; NOXIA-Gebäude mit ihrem Gebäudebild; Bewohner stehen an Arbeits- bzw. Wohngebäude statt beliebig auf der Straße; Bibliothek und Gotteshaus öffnen einen begehbaren Innenraum; NOXIA-Gebäude bis 6 km als Ziel wählbar (mit Entfernung), „Gehe dahin“ läuft etappenweise über den Szenenrand hinaus; Landmarks mit Symbol in der Szene, anwählbar und aus der Nähe betretbar (Ortstafel); Maßstab: Szene 2,4-fach vergrößert und auf die Spielfigur zentriert, Figuren behalten ihre Größe; Gebäude mit realem Umriss statt Hüllrechteck, von hinten nach vorn gezeichnet; Szene wandert mit: nähert sich die Spielfigur dem Rand, wird der Ausschnitt um ihren Standort neu aufgebaut; die Szene öffnet am tatsächlichen Standort der Spielfigur
// Version:      1.11.0

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import { getSessionInfo } from '@/lib/supabase/auth'
import { deriveEarthSurfaceTheme } from '@/lib/world/render/earthSurfaceTheme'
import { EARTH_LOCAL_ENRICHMENT_PROFILE, buildEarthLocalScene, type EarthLocalScene, type ScenePoint } from '@/lib/world/spatial/earthLocalScene'
import { advanceAlongLocalSceneRoute, distanceToBuildingFootprint, resolveLocalSceneStep, routeAcrossLocalScene, targetAccessDistance } from '@/lib/game/spatial/localSceneRuntime'
import { geoToLocalMeters, localMetersToGeo } from '@/lib/world/spatial/earthSpatial'
import { awarenessConversationForResident } from '@/lib/game/npcAwarenessConversation'
import { useEarthPlayerPositionStore } from '@/lib/store/earthPlayerPositionStore'
import { sourceForAwarenessItem, type WorldAwarenessItem } from '@/lib/game/worldAwareness'
import { constructionState } from '@/lib/game/constructionProgress'
import { deriveLoopingRailProgress, derivePointAlongRailPath } from '@/lib/game/transport/railSimulation'
import { getBuildingEntryDefinition, type BuildingEntryRequest } from '@/lib/game/buildings/entry'
import EarthBuildingAccessLayer from './EarthBuildingAccessLayer'
import LandmarkWalkableInterior from './LandmarkWalkableInterior'
import { landmarkRoomKind } from '@/lib/game/landmarks/interiors'
import { establishmentFor, establishmentKnowledge, type Establishment } from '@/lib/game/business/establishments'
import { extrudeFootprint } from '@/lib/game/spatial/buildingMassing'
import EarthBuildingMassingLayer, { HEIGHT_PX_PER_M } from './EarthBuildingMassingLayer'
import type { LocalSurfaceBuilding } from '@/lib/game/spatial/localSurfaceScene'
import { getBuildingVisual } from '@/lib/game/buildings/visuals'
import { useConversationEnd, CONVERSATION_ENDED_PLACEHOLDER } from '@/app/components/useConversationEnd'
import { WALKABLE_VIEW, WalkableActor, WalkablePlayer, WalkableRoute, WalkableSurfaceSvg, WalkableTrain, projectSurfacePoint as iso, surfaceBuildingTop as buildingPolygon, surfacePathD as pathD, surfacePolygonD as polygonD, surfacePointsAttr as pointsAttr, surfaceCameraTransform as cameraTransform } from '@/app/components/WalkableSurfaceRenderer'
import { personSceneLabel } from '@/lib/game/population/personSceneLabel'
import { PersonPortrait } from '@/lib/grid/PersonPortrait'

type GeoPoint={lat:number;lon:number}
type Feature={id:string;featureType:string;geometry:{kind:'point'|'line'|'polygon';coordinates:GeoPoint|GeoPoint[]};properties?:Record<string,any>}
type Payload={ok:boolean;region?:{id?:string;name:string;origin:GeoPoint};queryCenter?:GeoPoint;localDetail?:{slug:string;lat:number;lon:number};bounds?:{south:number;west:number;north:number;east:number};features?:Feature[];narrativeLandmarks?:Array<{id:string;name:string;locality:string;noxiaRole:string;presentDayRole:string;walkableInterior:string|null;locator:{value:string};point:GeoPoint}>;error?:string}
type SpatialEntity={id:string;entity_id:string;name?:string;x_m?:number|null;y_m?:number|null;rotation_deg?:number|null;footprint_width_m?:number|null;footprint_depth_m?:number|null;ownerLabel?:string;isOwn?:boolean;status?:string;latitude_deg?:number|null;longitude_deg?:number|null}
type SpatialBuild={id:string;buildable_id:string;name?:string;latitude_deg?:number|null;longitude_deg?:number|null;x_m?:number|null;y_m?:number|null;rotation_deg?:number|null;footprint_width_m?:number|null;footprint_depth_m?:number|null;status?:string;created_at?:string|null;completes_at?:string|null}
type Props={residents:ColonyResident[];onClose:()=>void}
type ChatEntry={role:'user'|'assistant';content:string}
type NpcWorldAction={type:'lead_walk';startedAt:number;durationSeconds:number;maxDistanceMeters:number;playerFollows:boolean}|{type:'visit_place';startedAt:number;durationSeconds:number;targetRef:string;targetName:string;targetX:number;targetY:number;startX:number;startY:number;playerFollows:boolean}

const VIEW_W=WALKABLE_VIEW.width
const VIEW_H=WALKABLE_VIEW.height
const SCENE_RADIUS_M=260
const HEIGHT_PX=12
// The shared projection draws about 1.3 px per metre – right for open terrain,
// far too small for a town where a house is 10 m wide and a figure 30 px tall.
// Earth scenes zoom the ground in; figures and labels keep their screen size.
const SCENE_ZOOM=2.4
const LANDMARK_LABEL:Record<string,string>={library:'Bibliothek',place_of_worship:'Gotteshaus',museum:'Museum',gallery:'Galerie',attraction:'Sehenswürdigkeit',viewpoint:'Aussichtspunkt',castle:'Burg / Schloss',fort:'Festung',city_gate:'Stadttor',ruins:'Ruine',archaeological_site:'Ausgrabungsstätte',monument:'Denkmal',memorial:'Gedenkstätte',university:'Universität',townhall:'Rathaus',theatre:'Theater',arts_centre:'Kulturzentrum',hospital:'Krankenhaus',station:'Bahnhof',tower:'Turm',lighthouse:'Leuchtturm',observatory:'Sternwarte'}
function landmarkLabel(kind:string,tags?:Record<string,any>){if(kind==='artlounge')return'Kultur · ArtLounge';if(kind==='place_of_worship'){const religion=String(tags?.religion??'');return religion==='christian'?'Kirche':religion==='muslim'?'Moschee':religion==='jewish'?'Synagoge':religion==='buddhist'||religion==='hindu'?'Tempel':'Gotteshaus'}return LANDMARK_LABEL[kind]??'Landmark'}
// One plain glyph per landmark class, drawn inside a 20 px badge.
function landmarkGlyph(kind:string,tags?:Record<string,any>){
  const ink={fill:'none',stroke:'#17313c',strokeWidth:1.5,strokeLinecap:'round' as const,strokeLinejoin:'round' as const}
  switch(kind){
    case'artlounge':return <path {...ink} d="M-6 5 V-3 Q-6 -6 -3 -6 H3 Q6 -6 6 -3 V5 Z M-3 -1 V5 M0 -1 V5 M3 -1 V5 M-6 1 H6"/>
    case'library':return <path {...ink} d="M-6 -4 Q-3 -6 0 -4 Q3 -6 6 -4 V5 Q3 3 0 5 Q-3 3 -6 5 Z M0 -4 V5"/>
    case'place_of_worship':return String(tags?.religion??'')==='christian'
      ?<path {...ink} d="M0 -7 V-2 M-2 -5 H2 M-5 6 V0 L0 -3 L5 0 V6 Z M-1.5 6 V3 H1.5 V6"/>
      :<path {...ink} d="M-5 6 V0 Q0 -8 5 0 V6 Z M-1.5 6 V3 H1.5 V6"/>
    case'museum':case'gallery':case'townhall':case'university':case'theatre':case'arts_centre':return <path {...ink} d="M-6 -2 L0 -6 L6 -2 Z M-4 -2 V4 M0 -2 V4 M4 -2 V4 M-6 5 H6"/>
    case'castle':case'fort':case'city_gate':return <path {...ink} d="M-6 6 V-5 H-3.5 V-3 H-1.2 V-5 H1.2 V-3 H3.5 V-5 H6 V6 Z M-1.5 6 V2 Q0 0 1.5 2 V6"/>
    case'ruins':case'archaeological_site':return <path {...ink} d="M-6 6 V-1 L-4 -3 V6 M-1 6 V-5 H1 V6 M4 6 V1 L6 -1 V6 M-7 6 H7"/>
    case'monument':case'memorial':return <path {...ink} d="M0 -7 L2 -4 L1.2 4 H-1.2 L-2 -4 Z M-4 6 H4 M-3 4 H3"/>
    case'tower':case'lighthouse':case'observatory':return <path {...ink} d="M-2 6 L-1.2 -3 H1.2 L2 6 Z M-2.5 -3 H2.5 M0 -3 V-7 M-5 -6 L-2.5 -5 M5 -6 L2.5 -5"/>
    case'viewpoint':case'attraction':return <path {...ink} d="M-7 5 L-2 -3 L1 1 L3 -1 L7 5 Z M3 -5 A1.4 1.4 0 1 0 3.01 -5"/>
    case'hospital':return <path {...ink} d="M-5 -5 H5 V5 H-5 Z M0 -3 V3 M-3 0 H3"/>
    case'station':return <path {...ink} d="M-4 -5 H4 Q5 -5 5 -4 V2 Q5 3 4 3 H-4 Q-5 3 -5 2 V-4 Q-5 -5 -4 -5 Z M-5 -1 H5 M-3 6 L-2 3 M3 6 L2 3"/>
    default:return <path {...ink} d="M0 -6 L1.8 -1.8 L6 -1.8 L2.6 1 L4 5.5 L0 2.8 L-4 5.5 L-2.6 1 L-6 -1.8 L-1.8 -1.8 Z"/>
  }
}
// Betriebe: schlichtes Zeichen je Funktion im selben Abzeichen wie Landmarks.
function businessGlyph(business:Establishment){
  const ink={fill:'none',stroke:'#17313c',strokeWidth:1.5,strokeLinecap:'round' as const,strokeLinejoin:'round' as const}
  switch(business.kind){
    case'autohaus':case'werkstatt':case'tankstelle':return <path {...ink} d="M-7 2 L-5 -3 H5 L7 2 V5 H-7 Z M-4 5 V7 M4 5 V7 M-7 2 H7"/>
    case'tierbedarf':case'tierarzt':return <path {...ink} d="M-4 -4 A1.6 1.6 0 1 0 -4 -4.1 M0 -6 A1.6 1.6 0 1 0 0 -6.1 M4 -4 A1.6 1.6 0 1 0 4 -4.1 M0 4 Q-5 4 -4 0 Q-2 -2 0 -2 Q2 -2 4 0 Q5 4 0 4 Z"/>
    case'baeckerei':case'metzgerei':case'supermarkt':return <path {...ink} d="M-6 -2 H6 L5 6 H-5 Z M-3 -2 V-5 Q0 -8 3 -5 V-2"/>
    case'apotheke':return <path {...ink} d="M-5 -5 H5 V5 H-5 Z M0 -3 V3 M-3 0 H3"/>
    case'bank':case'buero':case'post':return <path {...ink} d="M-6 -2 L0 -6 L6 -2 Z M-4 -2 V4 M0 -2 V4 M4 -2 V4 M-6 5 H6"/>
    case'industrie':case'handwerk':return <path {...ink} d="M-7 6 V-1 L-3 1 V-1 L1 1 V-1 L5 1 V6 Z M-6 -1 V-6 H-4 V-1"/>
    case'hotel':return <path {...ink} d="M-6 6 V-5 H6 V6 M-3 -2 H-1 M1 -2 H3 M-3 2 H-1 M1 2 H3 M-1 6 V3 H1 V6"/>
    default:return <path {...ink} d="M-6 -2 H6 V6 H-6 Z M-6 -2 L-4 -6 H4 L6 -2 M-2 6 V2 H2 V6"/>
  }
}
function zoomedCamera(focus:ScenePoint){const p=iso(focus);return `translate(${VIEW_W/2} ${VIEW_H/2}) scale(${SCENE_ZOOM}) translate(${(-p.x).toFixed(1)} ${(-p.y).toFixed(1)})`}
function unzoomedAt(point:ScenePoint){const p=iso(point);return `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${1/SCENE_ZOOM}) translate(${(-p.x).toFixed(1)} ${(-p.y).toFixed(1)})`}
// The scene covers ±260 m. Well before that edge it is rebuilt around the
// player, snapped to a fixed grid so the same ground always maps to the same
// stored detail rows instead of a new set for every few metres walked.
// Ansprechen kann man nur, wen man erreicht hat.
const WALK_VIEW_KEY='noxia-earth-walk-view-v1'
const TALK_RANGE_M=8
const RECENTER_AT_M=190
// Own and state buildings stay selectable as a destination well beyond the
// visible scene; walking there crosses several scene frames.
const TARGET_RANGE_M=6000
const ROUTE_STAGE_M=235
const SCENE_GRID_M=300
function sceneGridNode(point:GeoPoint):GeoPoint{
  const latStep=SCENE_GRID_M/110540
  const lat=Math.round(point.lat/latStep)*latStep
  const lonStep=SCENE_GRID_M/(111320*Math.max(.05,Math.cos(lat*Math.PI/180)))
  return{lat:Number(lat.toFixed(6)),lon:Number((Math.round(point.lon/lonStep)*lonStep).toFixed(6))}
}
function rememberedViewMatches(origin:GeoPoint){try{return window.localStorage.getItem(WALK_VIEW_KEY)===`${origin.lat.toFixed(4)},${origin.lon.toFixed(4)}`}catch{return false}}
function regionUrl(tag:string,center:GeoPoint|null){return `/api/earth/region?v=${tag}`+(center?`&lat=${center.lat}&lon=${center.lon}`:'')}

function role(resident:ColonyResident){return resident.assignments.find(item=>item.type==='work')?.roleCode??resident.activityState??'general'}
// x_m/y_m of an entity are relative to the region anchor of the API response,
// the scene is centred on the current view centre. WGS84 is the canonical
// position, so project it into the scene frame instead of mixing both frames.
function scenePosition(item:{latitude_deg?:number|null;longitude_deg?:number|null;x_m?:number|null;y_m?:number|null},origin:GeoPoint|undefined){
  const lat=item.latitude_deg==null?NaN:Number(item.latitude_deg),lon=item.longitude_deg==null?NaN:Number(item.longitude_deg)
  if(origin&&Number.isFinite(lat)&&Number.isFinite(lon)){const metric=geoToLocalMeters({lat,lon},origin);return{xM:metric.eastM,yM:metric.northM}}
  return{xM:item.x_m==null?NaN:Number(item.x_m),yM:item.y_m==null?NaN:Number(item.y_m)}
}
function hash(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
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
  const conversationEnd=useConversationEnd()
  const[playerName,setPlayerName]=useState('Du')
  const[motionTime,setMotionTime]=useState(0)
  const[awarenessItems,setAwarenessItems]=useState<WorldAwarenessItem[]>([])
  const[spatialEntities,setSpatialEntities]=useState<SpatialEntity[]>([])
  const[spatialBuilds,setSpatialBuilds]=useState<SpatialBuild[]>([])
  const[hoveredBuilding,setHoveredBuilding]=useState<{x:number;y:number;name:string;detail:string;distanceM:number}|null>(null)
  const[navigationTargetId,setNavigationTargetId]=useState<string>('')
  const[autoWalkTargetId,setAutoWalkTargetId]=useState<string>('')
  // Person, auf die die Spielfigur gerade zugeht.
  const[approachNpcId,setApproachNpcId]=useState<string>('')
  // Prevent a position update from immediately triggering another auto-walk step
  // before the next animation frame. React state changes recalculate the route.
  const lastAutoWalkMotionTime=useRef<number|null>(null)
  const[entryRequest,setEntryRequest]=useState<BuildingEntryRequest|null>(null)
  const localEnrichmentAttempted=useRef(new Set<string>())
  // Stable callback for the memoised building layer; the player position is
  // read at hover time instead of making the layer depend on every step.
  const playerRef=useRef(player)
  playerRef.current=player
  const hoverRealBuilding=useCallback((building:LocalSurfaceBuilding|null,event?:MouseEvent)=>{
    if(!building||!event){setHoveredBuilding(null);return}
    setHoveredBuilding({x:event.clientX,y:event.clientY,name:building.label??'Gebäude',detail:building.provenance==='observed'?'reale Geometrie':'abgeleitete Bebauungsmasse',distanceM:Math.hypot(building.center.xM-playerRef.current.xM,building.center.yM-playerRef.current.yM)})
  },[])
  const[detailStatus,setDetailStatus]=useState<'idle'|'loading'|'failed'>('idle')
  const[detailRetry,setDetailRetry]=useState(0)
  const[sceneCenter,setSceneCenter]=useState<GeoPoint|null>(null)
  const[openLandmarkId,setOpenLandmarkId]=useState('')
  const recenterRequested=useRef('')
  const openedViewChecked=useRef(false)
  // Erst wenn entschieden ist, wo die Spielfigur beim Öffnen steht, darf die Szene ihr nachrücken.
  const[viewDecided,setViewDecided]=useState(false)

  // Eine Szene wird erst gezeigt, wenn ihre Ortsdetails da sind. Sonst baut sich
  // der Ort zweimal auf: zuerst mit abgeleiteten Baumassen, dann mit den echten
  // Gebäuden. Beim Weiterlaufen bleibt die bisherige Szene stehen, bis die neue fertig ist.
  useEffect(()=>{
    let live=true
    ;(async()=>{
      let base:Payload|null=null
      try{base=await fetch(regionUrl('walkable-v2',sceneCenter),{cache:'no-store'}).then(r=>r.json())}catch{base=null}
      if(!live)return
      if(!base){if(!sceneCenter)setData({ok:false,error:'Earth-Region nicht erreichbar'});return}
      if(!base.ok){if(!sceneCenter)setData(base);return}
      const detail=base.localDetail
      const enriched=(base.features??[]).some(feature=>feature.properties?.noxia_enrichment===EARTH_LOCAL_ENRICHMENT_PROFILE)
      if(!detail?.slug||enriched||localEnrichmentAttempted.current.has(detail.slug)){setData(base);setDetailStatus('idle');return}
      localEnrichmentAttempted.current.add(detail.slug)
      setDetailStatus('loading')
      try{
        const {token}=await getSessionInfo()
        const response=await fetch('/api/earth/local-enrich',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({slug:detail.slug,lat:detail.lat,lon:detail.lon,radiusKm:.34})})
        if(!live)return
        if(!response.ok){setData(base);setDetailStatus('failed');return}
        const refreshed=await fetch(regionUrl('walkable-v3',sceneCenter),{cache:'no-store'}).then(result=>result.json())
        if(!live)return
        setData(refreshed?.ok?refreshed:base)
        setDetailStatus('idle')
      }catch{if(live){setData(base);setDetailStatus('failed')}}
    })()
    return()=>{live=false}
  },[sceneCenter,detailRetry])
  useEffect(()=>{let live=true;getSessionInfo().then(({token})=>fetch('/api/game/profile',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'})).then(response=>response.ok?response.json():null).then(json=>{const username=String(json?.profile?.username??'').trim();if(live&&username)setPlayerName(username)}).catch(()=>{});return()=>{live=false}},[])
  // Gebäude am Ort. Ohne sie gibt es keine Ziele und niemand steht an seinem
  // Arbeitsplatz – deshalb wird ein fehlgeschlagener Abruf wiederholt und gemeldet.
  const[spatialStatus,setSpatialStatus]=useState<'loading'|'ready'|'failed'>('loading')
  useEffect(()=>{
    let live=true,timer:ReturnType<typeof setTimeout>|null=null
    const load=async(attempt:number)=>{
      try{
        const{token}=await getSessionInfo()
        const response=token?await fetch('/api/game/build/spatial?location=earth',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'}):null
        const json=response?.ok?await response.json():null
        if(!live)return
        if(json&&Array.isArray(json.entities)){
          setSpatialEntities(json.entities);setSpatialBuilds(Array.isArray(json.builds)?json.builds:[]);setSpatialStatus('ready')
          return
        }
      }catch{/* erneut versuchen */}
      if(!live)return
      if(attempt<4)timer=setTimeout(()=>void load(attempt+1),1500*(attempt+1))
      else setSpatialStatus('failed')
    }
    void load(0)
    return()=>{live=false;if(timer)clearTimeout(timer)}
  },[])
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
    // Beim Öffnen gilt der gewählte Ort. Die gemerkte Position der Spielfigur
    // zählt nur, wenn sie zu genau diesem Ort gehört – sonst stünde man nach
    // „Springen“ oder „Home“ erst hier und würde gleich darauf kilometerweit
    // an die alte Stelle zurückversetzt.
    if(!sceneCenter&&!openedViewChecked.current){
      openedViewChecked.current=true
      const viewKey=`${origin.lat.toFixed(4)},${origin.lon.toFixed(4)}`
      let remembered:string|null=null
      try{remembered=window.localStorage.getItem(WALK_VIEW_KEY);window.localStorage.setItem(WALK_VIEW_KEY,viewKey)}catch{/* ohne Speicher gilt der gewählte Ort */}
      setViewDecided(true)
      if(remembered!==viewKey){resetSharedPlayerPosition(regionId,origin);return}
    }
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
  // WGS84 is the player's canonical position; the local metres only describe
  // it inside the current scene frame. Keep both in step and move the frame
  // before the player reaches its edge.
  useEffect(()=>{
    const regionId=(data?.region as any)?.id??null
    if(!viewDecided||!origin||!playerGeo||!playerRegionId||(regionId&&playerRegionId!==regionId))return
    const metric=geoToLocalMeters(playerGeo,origin)
    if(Math.max(Math.abs(metric.eastM),Math.abs(metric.northM))>RECENTER_AT_M){
      const node=sceneGridNode(playerGeo)
      const key=`${node.lat},${node.lon}`
      if(recenterRequested.current!==key){recenterRequested.current=key;setSceneCenter(node)}
      return
    }
    if(Math.hypot(metric.eastM-player.xM,metric.northM-player.yM)>.5)setSharedPlayerPosition(regionId,{xM:metric.eastM,yM:metric.northM},playerGeo)
  },[data?.region,origin,playerGeo,playerRegionId,player,setSharedPlayerPosition,viewDecided])
  const theme=useMemo(()=>deriveEarthSurfaceTheme(Number(origin?.lat??0),features),[origin?.lat,features])
  const scene=useMemo<EarthLocalScene|null>(()=>origin?buildEarthLocalScene({origin,features,radiusM:SCENE_RADIUS_M}):null,[origin,features])
  // Kanonische Landmarks mit begehbarem Innenraum (z. B. CAMALEO-ArtLounge) wie Gebäude betretbar.
  const canonicalInteriorTargets=useMemo(()=>origin?(data?.narrativeLandmarks??[]).flatMap(landmark=>{
    if(!landmark.walkableInterior)return[]
    const metric=geoToLocalMeters(landmark.point,origin)
    // Wie Gebäude erreichbar, auch wenn der Ort außerhalb des gezeichneten Ausschnitts liegt.
    if(Math.abs(metric.eastM)>TARGET_RANGE_M||Math.abs(metric.northM)>TARGET_RANGE_M)return[]
    const[street,...rest]=landmark.locator.value.split(',')
    const match=street.match(/^(.*?)\s+(\d+\w*)$/)
    const tags:Record<string,any>={'addr:street':match?match[1]:street,'addr:housenumber':match?match[2]:'',description:landmark.noxiaRole}
    return[{id:`canon:${landmark.id}`,name:landmark.name,xM:metric.eastM,yM:metric.northM,kind:landmark.walkableInterior,isLandmark:true,business:null,tags}]
  }):[],[origin,data?.narrativeLandmarks])
  const namedPoiTargets=useMemo(()=>origin?[...canonicalInteriorTargets,...features.flatMap(feature=>{
    if(feature.geometry.kind!=='point'||!feature.properties?.name)return[]
    const point=feature.geometry.coordinates as GeoPoint
    const metric=geoToLocalMeters(point,origin)
    if(Math.abs(metric.eastM)>SCENE_RADIUS_M||Math.abs(metric.northM)>SCENE_RADIUS_M)return[]
    const tags=(feature.properties??{}) as Record<string,any>
    const business=feature.featureType==='poi'?establishmentFor(tags,String(tags.noxia_source_id??feature.id)):null
    // Ein Betrieb trägt im Spiel seinen erfundenen Namen; der reale bleibt im Tooltip.
    return[{id:`poi:${feature.id}`,name:business?business.name:String(feature.properties.name),xM:metric.eastM,yM:metric.northM,kind:String(feature.properties?.visual_class??feature.featureType),isLandmark:feature.featureType==='landmark',business,tags}]
  })].slice(0,40+canonicalInteriorTargets.length):[],[origin,features,canonicalInteriorTargets])
  const buildingTargets=useMemo(()=>spatialEntities.flatMap(entity=>{
    const{xM,yM}=scenePosition(entity,origin)
    if(!Number.isFinite(xM)||!Number.isFinite(yM)||Math.abs(xM)>TARGET_RANGE_M||Math.abs(yM)>TARGET_RANGE_M)return[]
    return[{id:`building:${entity.id}`,name:String(entity.name??entity.entity_id),xM,yM,kind:'NOXIA-Gebäude',entity}]
  }),[spatialEntities,origin])
  const pendingTargets=useMemo(()=>spatialBuilds.flatMap(build=>{
    const{xM,yM}=scenePosition(build,origin)
    if(!Number.isFinite(xM)||!Number.isFinite(yM)||Math.abs(xM)>TARGET_RANGE_M||Math.abs(yM)>TARGET_RANGE_M)return[]
    const state=constructionState({
      buildable_id:build.buildable_id,
      tile_row:0,
      tile_col:0,
      status:build.status??'building',
      created_at:build.created_at,
      completes_at:build.completes_at,
    },Date.now())
    return[{id:`pending:${build.id}`,name:String(build.name??build.buildable_id),xM,yM,kind:'Baustelle',build,state}]
  }),[spatialBuilds,motionTime,origin])
  const localTrainPoint=useMemo(()=>{
    const track=scene?.railGraph.find(path=>path.points.length>=2)
    if(!track)return null
    return derivePointAlongRailPath(track.points,deriveLoopingRailProgress(motionTime*1000))
  },[scene,motionTime])
  const navigationTargets=useMemo(()=>[...buildingTargets,...pendingTargets,...namedPoiTargets].sort((a,b)=>a.name.localeCompare(b.name,'de')),[buildingTargets,pendingTargets,namedPoiTargets])
  const navigationTarget=navigationTargets.find(target=>target.id===navigationTargetId)??null
  const navigationRoute=useMemo(()=>{
    if(!scene||!navigationTarget)return null
    const goal={xM:navigationTarget.xM,yM:navigationTarget.yM}
    const reach=Math.max(Math.abs(goal.xM),Math.abs(goal.yM))
    if(reach<=ROUTE_STAGE_M)return routeAcrossLocalScene(scene,player,goal)
    // The destination lies beyond this scene frame: head for the point where
    // the direct line leaves it, preferring the road network on the way.
    const dx=goal.xM-player.xM,dy=goal.yM-player.yM
    let t=1
    if(dx>0)t=Math.min(t,(ROUTE_STAGE_M-player.xM)/dx);else if(dx<0)t=Math.min(t,(-ROUTE_STAGE_M-player.xM)/dx)
    if(dy>0)t=Math.min(t,(ROUTE_STAGE_M-player.yM)/dy);else if(dy<0)t=Math.min(t,(-ROUTE_STAGE_M-player.yM)/dy)
    t=Math.max(0,t)
    return routeAcrossLocalScene(scene,player,{xM:player.xM+dx*t,yM:player.yM+dy*t},{maxConnectorM:140})
  },[scene,navigationTarget,player])
  const targetDistance=navigationTarget?Math.hypot(navigationTarget.xM-player.xM,navigationTarget.yM-player.yM):null
  const selectedLandmark=namedPoiTargets.find(target=>target.id===navigationTargetId&&(target.isLandmark||target.business))??null
  const openLandmark=namedPoiTargets.find(target=>target.id===openLandmarkId)??null
  const selectedBuildingTarget=buildingTargets.find(target=>target.id===navigationTargetId)??null
  const selectedBuildingEntry=selectedBuildingTarget?getBuildingEntryDefinition(selectedBuildingTarget.entity.entity_id):null
  const selectedBuildingDistance=selectedBuildingTarget?distanceToBuildingFootprint(player,{
    id:selectedBuildingTarget.entity.id,
    center:{xM:selectedBuildingTarget.xM,yM:selectedBuildingTarget.yM},
    widthM:Math.max(8,Number(selectedBuildingTarget.entity.footprint_width_m??18)),
    depthM:Math.max(8,Number(selectedBuildingTarget.entity.footprint_depth_m??14)),
    rotationDeg:Number(selectedBuildingTarget.entity.rotation_deg??0),
    provenance:'canonical',
  }):null
  const landmarkAccessDistance=selectedLandmark?(scene?targetAccessDistance(scene,player,selectedLandmark):targetDistance):null
  const targetInteractionDistance=selectedBuildingDistance??landmarkAccessDistance??targetDistance
  const autoWalkStopDistance=selectedBuildingTarget||(selectedLandmark&&landmarkAccessDistance!==null&&landmarkAccessDistance<(targetDistance??0))?6:2
  const canEnterSelectedBuilding=Boolean(selectedBuildingTarget&&selectedBuildingEntry&&selectedBuildingDistance!==null&&selectedBuildingDistance<=8)

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

  const npcPositions=useMemo(()=>scene?residents.slice(0,18).flatMap((resident,index)=>{
    const h=hash(resident.id)
    // A person with a workplace or home is where the simulation says: at work
    // while working, otherwise at home – also when that building lies outside
    // this scene, in which case the person is simply not here.
    if(!npcWorldActionById[resident.id]){
      const activity=resident.activityState.toLowerCase()
      const atWork=/work|produc|serv|operat/.test(activity)
      const wanted=[atWork?'work':'home',atWork?'home':'work']
      const anchor=wanted.map(type=>resident.assignments.find(item=>item.type===type&&item.tileEntityId)).map(item=>item?buildingTargets.find(target=>target.entity.id===item.tileEntityId):undefined).find(Boolean)
      // Wer einem Gebäude zugewiesen ist, läuft nicht ersatzweise auf irgendeiner
      // Straße herum, nur weil das Gebäude hier nicht (oder noch nicht) bekannt ist.
      if(!anchor&&resident.assignments.some(item=>(item.type==='work'||item.type==='home')&&item.tileEntityId))return[]
      if(anchor){
        if(Math.abs(anchor.xM)>SCENE_RADIUS_M||Math.abs(anchor.yM)>SCENE_RADIUS_M)return[]
        // Wer arbeitet und dessen Arbeitsplatz betretbar ist, ist drinnen – nicht davor.
        const worksHere=atWork&&resident.assignments.some(item=>item.type==='work'&&item.tileEntityId===anchor.entity.id)
        if(worksHere&&getBuildingEntryDefinition(anchor.entity.entity_id))return[]
        const depth=Math.max(8,Number(anchor.entity.footprint_depth_m??14))
        const width=Math.max(8,Number(anchor.entity.footprint_width_m??18))
        const sway=selected?.id===resident.id?0:Math.sin(motionTime*.35+(h%628)/100)*1.2
        return[{resident,xM:anchor.xM+(((h%7)-3)/3)*(width/2-1)+sway,yM:anchor.yM+depth/2+2.5+((h>>>5)%3)*1.6}]
      }
    }
    const road=scene.roadGraph.length?scene.roadGraph[h%scene.roadGraph.length]:null
    const fallback={xM:-90+(h%180),yM:-70+((h>>>9)%140)}
    if(!road||road.points.length<2)return[{resident,...fallback}]

    const segments=road.points.slice(1).map((point,i)=>{
      const from=road.points[i]
      const length=Math.hypot(point.xM-from.xM,point.yM-from.yM)
      return{from,to:point,length}
    }).filter(segment=>segment.length>.01)
    const total=segments.reduce((sum,segment)=>sum+segment.length,0)
    if(total<=0)return[{resident,...fallback}]

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
      // Hin und zurück statt Sprung an den Anfang: am Ende des Weges kehrt die Person um.
      const lap=((phase*total)+travelDistance)%(2*total)
      const distance=lap<=total?lap:2*total-lap

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
    return[{
      resident,
      xM:Math.max(-SCENE_RADIUS_M,Math.min(SCENE_RADIUS_M,position.xM+((index%3)-1)*2.5)),
      yM:Math.max(-SCENE_RADIUS_M,Math.min(SCENE_RADIUS_M,position.yM+((index%2)?2:-2))),
    }]
  }):[],[scene,residents,motionTime,selected?.id,npcWorldActionById,buildingTargets])

  const selectedNpcPoint=selected?npcPositions.find(item=>item.resident.id===selected.id)??null:null
  const selectedNpcDistance=selectedNpcPoint?Math.hypot(selectedNpcPoint.xM-player.xM,selectedNpcPoint.yM-player.yM):null
  const canTalkToSelected=selectedNpcDistance!==null&&selectedNpcDistance<=TALK_RANGE_M
  // „Gehe hin“: Schritt für Schritt auf die gewählte Person zu, bis man sie ansprechen kann.
  const lastApproachMotionTime=useRef<number|null>(null)
  useEffect(()=>{
    if(!approachNpcId||!scene||!origin)return
    const npc=npcPositions.find(item=>item.resident.id===approachNpcId)
    if(!npc||selected?.id!==approachNpcId){setApproachNpcId('');return}
    if(lastApproachMotionTime.current===motionTime)return
    lastApproachMotionTime.current=motionTime
    const away=Math.hypot(npc.xM-player.xM,npc.yM-player.yM)
    if(away<=TALK_RANGE_M-2){setApproachNpcId('');return}
    const route=routeAcrossLocalScene(scene,player,{xM:npc.xM,yM:npc.yM})
    const next=route?advanceAlongLocalSceneRoute(scene,player,route,2.2):player
    if(Math.hypot(next.xM-player.xM,next.yM-player.yM)<.01){setApproachNpcId('');return}
    setSharedPlayerPosition((data?.region as any)?.id??null,next,localMetersToGeo({eastM:next.xM,northM:next.yM},origin))
  },[motionTime,approachNpcId,npcPositions,selected?.id,scene,origin,player,data?.region,setSharedPlayerPosition])

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

  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{const target=event.target as HTMLElement|null;if(target?.closest('input,textarea'))return;const step=event.shiftKey?8:4;const key=event.key.toLowerCase();if(!['w','a','s','d'].includes(key)||!scene)return;event.preventDefault();setAutoWalkTargetId('');setApproachNpcId('');setNpcWorldActionById(current=>Object.fromEntries(Object.entries(current).map(([id,action])=>[id,{...action,playerFollows:false}])));(()=>{const next=resolveLocalSceneStep(scene,player,{xM:player.xM+(key==='d'?step:key==='a'?-step:0),yM:player.yM+(key==='s'?step:key==='w'?-step:0)});setSharedPlayerPosition((data?.region as any)?.id??null,next,origin?localMetersToGeo({eastM:next.xM,northM:next.yM},origin):playerGeo)})()};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[data?.region,origin,player,playerGeo,scene,setSharedPlayerPosition])

  useEffect(()=>{
    if(!scene||!origin||!navigationTarget||!navigationRoute||autoWalkTargetId!==navigationTarget.id||targetInteractionDistance===null)return
    // A changed player position recomputes navigationRoute and reruns this effect.
    // Only advance once per motion clock tick to avoid React update-depth loops.
    if(lastAutoWalkMotionTime.current===motionTime)return
    lastAutoWalkMotionTime.current=motionTime
    if(targetInteractionDistance<=autoWalkStopDistance){
      setAutoWalkTargetId('')
      return
    }
    const next=advanceAlongLocalSceneRoute(scene,player,navigationRoute,2.2)
    if(Math.hypot(next.xM-player.xM,next.yM-player.yM)<.01){
      // At the frame edge the next scene is still loading – wait, don't give up.
      if(Math.max(Math.abs(player.xM),Math.abs(player.yM))<RECENTER_AT_M)setAutoWalkTargetId('')
      return
    }
    setSharedPlayerPosition((data?.region as any)?.id??null,next,localMetersToGeo({eastM:next.xM,northM:next.yM},origin))
  },[motionTime,scene,origin,navigationTarget,navigationRoute,autoWalkTargetId,targetInteractionDistance,autoWalkStopDistance,player,data?.region,setSharedPlayerPosition])

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
    if(!selected||!message.trim()||sending||!canTalkToSelected||conversationEnd.isEnded(selected.id))return
    const playerMessage=message.trim().slice(0,400)
    if(!playerMessage)return
    const history=conversationByNpc[selected.id]??[]
    setSending(true)
    try{
      const{token}=await getSessionInfo()
      const response=await fetch('/api/game/npc-conversation',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({player:playerMessage,npcId:selected.id,npcName:selected.displayName,npcRole:role(selected),headline:`Lokales Gespräch in ${data?.region?.name??'der aktuellen Earth-Region'}`,source:'NOXIA Earth local scene',locationName:data?.region?.name??'Erde',localFacts:perceivedLocalFactsForNpc(selected.id),nearbyPlaces:perceivedNearbyPlacesForNpc(selected.id).map(({key,targetRef,name,kind,distanceM})=>({key,targetRef,name,kind,distanceM})),history})})
      const json=await response.json().catch(()=>({}))
      const npcReply=response.ok&&json.reply?String(json.reply):'Die Person kann gerade nicht antworten.'
      conversationEnd.noteReply(selected.id,json)
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

  if(!data)return <div className="earth-walkable-loading">{detailStatus==='loading'?'Gebäude, Wege und Gewässer dieses Ortes werden geladen …':'Lokale Earth-Szene wird aufgebaut …'}</div>
  if(!data.ok||!scene)return <div className="earth-walkable-loading">Earth-Szene nicht verfügbar: {data.error??'keine Region'}</div>
  // Steht die Spielfigur vom letzten Besuch weit vom Mittelpunkt dieser ersten
  // Szene entfernt, wird gleich um sie herum neu geladen – die erste Szene nicht zeigen.
  if(!sceneCenter&&origin&&playerGeo&&playerRegionId&&playerRegionId===((data.region as any)?.id??null)&&rememberedViewMatches(origin)){
    const away=geoToLocalMeters(playerGeo,origin)
    if(Math.max(Math.abs(away.eastM),Math.abs(away.northM))>RECENTER_AT_M)return <div className="earth-walkable-loading">Lokale Earth-Szene wird aufgebaut …</div>
  }

  return <section className="earth-walkable" aria-label={`Begehbarer Ort ${data.region?.name??'Erde'}`}>
    <header><div><small>EARTH · LOCAL SCENE</small><b>{data.region?.name??'Aktueller Ort'}</b><span>{theme.label}</span></div><div className="meta"><span>{scene.buildings.length} Gebäude/Massen</span><span>{scene.roadGraph.length} Straßen</span><span>{scene.railGraph.length} Schienen</span></div><button onClick={onClose}>← Karte</button></header>
    <div className="earth-walkable-stage">
      <WalkableSurfaceSvg>
        <defs>
          <linearGradient id="earth-scene-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={theme.backgroundAlt}/><stop offset="100%" stopColor={theme.background}/></linearGradient>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} fill="url(#earth-scene-ground)"/>
        <g transform={zoomedCamera(player)}>

        {scene.polygons.map(feature=>{
          const fill=feature.kind==='water'?'#6aa9c6':feature.kind==='beach'?'#e2d5a3':feature.kind==='rock'?'#aea89d':feature.kind==='forest'?theme.vegetation:feature.kind==='vegetation'?theme.backgroundAlt:feature.kind==='farmland'?(/^(meadow|grass|orchard)$/.test(feature.className??'')?'#a9c178':'#bda96c'):'#a9aaa0'
          return <path key={feature.id} d={polygonD(feature.points)} fill={fill} stroke={feature.kind==='water'?'#4d8eae':'rgba(54,71,57,.5)'} strokeWidth="1" opacity={feature.kind==='urban' ? .72 : .88}/>
        })}

        {scene.paths.filter(path=>path.kind==='waterway').map(path=><path key={path.id} d={pathD(path.points)} fill="none" stroke="#5ca6c8" strokeWidth={/^(river|canal)$/.test(path.className??'')?14:3.5} strokeLinecap="round" strokeLinejoin="round"/>)}
        {scene.paths.filter(path=>path.kind==='rail').map(path=><g key={path.id}><path d={pathD(path.points)} fill="none" stroke="#444b4c" strokeWidth="5" strokeLinecap="round"/><path d={pathD(path.points)} fill="none" stroke="#a9acaa" strokeWidth="1.3" strokeDasharray="5 4"/></g>)}
        {scene.paths.filter(path=>path.kind==='road').map(path=>{const major=/motorway|trunk|primary|secondary/.test(path.className??'');return <g key={path.id}><path d={pathD(path.points)} fill="none" stroke={major?'#d4c3a0':'#ddd8ca'} strokeWidth={major?11:/^(footway|path|steps|cycleway|pedestrian|track)$/.test(path.className??'')?3.2:7} strokeLinecap="round" strokeLinejoin="round"/><path d={pathD(path.points)} fill="none" stroke={major?'#b4975d':'#b6b0a4'} strokeWidth=".5" strokeDasharray={major?'8 8':'3 7'}/></g>})}

        {pendingTargets.map(target=>{
          const build=target.build
          const width=Math.max(8,Number(build.footprint_width_m??18))
          const depth=Math.max(8,Number(build.footprint_depth_m??14))
          const top=buildingPolygon({xM:target.xM,yM:target.yM},width,depth)
          const distanceM=Math.hypot(target.xM-player.xM,target.yM-player.yM)
          const pct=Math.round(target.state.progress*100)
          const detail=`im Bau · ${target.state.phaseLabel} · ${pct} %`
          return <g key={target.id} style={{cursor:'pointer'}} onClick={()=>{setSelected(null);setNavigationTargetId(target.id)}}
            onMouseMove={event=>setHoveredBuilding({x:event.clientX,y:event.clientY,name:target.name,detail,distanceM})}
            onMouseLeave={()=>setHoveredBuilding(null)}>
            <polygon points={pointsAttr(top)} fill={navigationTargetId===target.id?'#e0c05e':'#d7a941'} fillOpacity=".68" stroke="#6e5317" strokeWidth="1.6" strokeDasharray="5 3"/>
            <circle cx={iso({xM:target.xM,yM:target.yM}).x} cy={iso({xM:target.xM,yM:target.yM}).y} r="4" fill="#6e5317"/>
            <title>{target.name} · {detail} · {Math.round(distanceM)} m</title>
          </g>
        })}

        {[...buildingTargets].filter(target=>Math.abs(target.xM)<=SCENE_RADIUS_M*1.4&&Math.abs(target.yM)<=SCENE_RADIUS_M*1.4).sort((a,b)=>(a.xM+a.yM)-(b.xM+b.yM)).map(target=>{
          const entity=target.entity
          const width=Math.max(8,Number(entity.footprint_width_m??18))
          const depth=Math.max(8,Number(entity.footprint_depth_m??14))
          const base=buildingPolygon({xM:target.xM,yM:target.yM},width,depth)
          const centre=iso({xM:target.xM,yM:target.yM})
          const active=navigationTargetId===target.id
          const visual=getBuildingVisual(entity.entity_id,'earth')
          const distanceM=Math.hypot(target.xM-player.xM,target.yM-player.yM)
          // The building picture is a square isometric drawing; it stands on the
          // front corner of the footprint and spans the footprint's diagonal.
          const diamondW=(width+depth)*WALKABLE_VIEW.isoX
          const side=diamondW*1.18*((visual?.mapScale??1.7)/1.7)
          const frontY=centre.y+(width+depth)/2*WALKABLE_VIEW.isoY
          const box=visual?.mapAsset?null:extrudeFootprint(base,9*HEIGHT_PX_PER_M)
          return <g key={target.id} style={{cursor:'pointer'}} onClick={()=>{setSelected(null);setNavigationTargetId(target.id)}}
            onMouseMove={event=>setHoveredBuilding({x:event.clientX,y:event.clientY,name:target.name,detail:`${entity.ownerLabel??'NOXIA'} · ${entity.status??'aktiv'}`,distanceM})}
            onMouseLeave={()=>setHoveredBuilding(null)}>
            <polygon points={pointsAttr(base)} fill={active?'#e0c05e':'#dfe7dc'} fillOpacity={active?.55:.5} stroke={active?'#b8902b':'#173845'} strokeWidth={active?1.2:.6}/>
            {visual?.mapAsset
              ?<image href={visual.mapAsset} x={centre.x-side/2} y={frontY+side*.1-side} width={side} height={side} preserveAspectRatio="xMidYMax meet"/>
              :box&&<>{box.walls.map((wall,index)=><polygon key={index} points={pointsAttr(wall.points)} fill={wall.lit?'#5d7f91':'#3f5d6c'} stroke="#183643" strokeWidth=".5"/>)}<polygon points={pointsAttr(box.roof)} fill={active?'#e0c05e':'#89a8b4'} stroke="#173845" strokeWidth=".7"/></>}
            <title>{target.name} · {entity.ownerLabel??'NOXIA'} · {Math.round(distanceM)} m</title>
          </g>
        })}

        <EarthBuildingMassingLayer buildings={scene.buildings} onHover={hoverRealBuilding}/>

        {navigationTarget&&navigationRoute&&<WalkableRoute points={navigationRoute.points} target={{xM:navigationTarget.xM,yM:navigationTarget.yM}}/>}

        {npcPositions.map(({resident,xM,yM})=><g key={resident.id} transform={unzoomedAt({xM,yM})}><WalkableActor point={{xM,yM}} label={personSceneLabel(resident)} appearance={resident.appearance} visualSeed={resident.id} selected={selected?.id===resident.id} onClick={()=>{setSelected(resident);setMessage('');setAutoWalkTargetId('');setNavigationTargetId('')}}/></g>)}

        {localTrainPoint&&<WalkableTrain point={localTrainPoint} label="Regional"/>}
        {namedPoiTargets.filter(target=>target.isLandmark||target.business).map(target=>{
          const p=iso({xM:target.xM,yM:target.yM})
          const active=navigationTargetId===target.id
          const width=Math.max(48,Math.min(150,target.name.length*5.4+14))
          return <g key={target.id} transform={unzoomedAt({xM:target.xM,yM:target.yM})} style={{cursor:'pointer'}} onClick={()=>{setSelected(null);setAutoWalkTargetId('');setNavigationTargetId(target.id)}}>
            <g transform={`translate(${p.x.toFixed(1)} ${(p.y-16).toFixed(1)})`}>
              <path d="M0 16 L-5 8 H5 Z" fill={active?'#e0c05e':'#f4ecd2'} stroke="#17313c" strokeWidth="1"/>
              <circle r="11" fill={active?'#e0c05e':'#f4ecd2'} stroke="#17313c" strokeWidth="1.4"/>
              {target.business?businessGlyph(target.business):landmarkGlyph(target.kind,target.tags)}
              <g pointerEvents="none" transform="translate(0 -15)"><rect x={-width/2} y="-11" width={width} height="13" rx="4" fill="#173845ee" stroke="#8fa7b0" strokeWidth=".8"/><text y="-2" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#f3f7f8">{target.name.length>26?target.name.slice(0,25)+'…':target.name}</text></g>
              <title>{target.business?`${target.name} · ${target.business.function} · heute laut OSM: ${target.business.realName}`:`${target.name} · ${landmarkLabel(target.kind,target.tags)}`}</title>
            </g>
          </g>
        })}
        <g transform={unzoomedAt(player)}><WalkablePlayer point={player} label={playerName}/></g>
        </g>

      </WalkableSurfaceSvg>

      <div className="earth-orientation">
        <div><small>DU BIST HIER</small><b>{data.region?.name??'Erde'}</b><span>{player.xM>=0?'+':''}{Math.round(player.xM)} m Ost · {player.yM>=0?'+':''}{Math.round(player.yM)} m Nord vom Szenenzentrum</span></div>
        <label><span>Ziel</span><select value={navigationTargetId} onChange={event=>{if(event.target.value)setSelected(null);setAutoWalkTargetId('');setNavigationTargetId(event.target.value)}}>
          <option value="">{spatialStatus==='loading'?'— Ziele werden geladen —':spatialStatus==='failed'?'— Gebäude nicht geladen —':'— kein Ziel —'}</option>
          {navigationTargets.map(target=>{const away=Math.hypot(target.xM-player.xM,target.yM-player.yM);return <option key={target.id} value={target.id}>{target.name}{away>SCENE_RADIUS_M?` · ${(away/1000).toFixed(1).replace('.',',')} km`:''}</option>})}
        </select></label>
        {navigationTarget&&<div className="earth-target"><b>{navigationTarget.name}</b><span>{Math.round(targetInteractionDistance??targetDistance??0)} m entfernt{(targetDistance??0)<=SCENE_RADIUS_M?<> · Weg {Math.round(navigationRoute?.distanceM??targetDistance??0)} m {navigationRoute?.usesNetwork?'über Wegenetz':''}</>:' · außerhalb des Ausschnitts'}</span>{targetInteractionDistance!==null&&targetInteractionDistance>autoWalkStopDistance&&<button onClick={()=>setAutoWalkTargetId(navigationTarget.id)}>{autoWalkTargetId===navigationTarget.id?'GEHE …':'GEHE DAHIN'}</button>}{selectedBuildingEntry&&<button disabled={!canEnterSelectedBuilding} onClick={enterSelectedBuilding} title={canEnterSelectedBuilding?selectedBuildingEntry.hint:'Gehe bis auf etwa 8 m an das Gebäude heran'}>{canEnterSelectedBuilding?'BETRETEN':'NÄHER HERANGEHEN'}</button>}{selectedLandmark&&<button disabled={(landmarkAccessDistance??Infinity)>12} onClick={()=>setOpenLandmarkId(selectedLandmark.id)} title={(landmarkAccessDistance??Infinity)>12?'Gehe bis auf etwa 12 m heran':`${selectedLandmark.business?selectedLandmark.business.function:landmarkLabel(selectedLandmark.kind,selectedLandmark.tags)} betreten`}>{(landmarkAccessDistance??Infinity)>12?'NÄHER HERANGEHEN':'BETRETEN'}</button>}</div>}
      </div>
      {openLandmark?.business&&<LandmarkWalkableInterior kind={openLandmark.business.room} name={openLandmark.name} typeLabel={openLandmark.business.function} staffRole={openLandmark.business.staffRole} realName={openLandmark.business.realName} services={openLandmark.business.services} knowledge={establishmentKnowledge(openLandmark.business,data.region?.name??'diesem Ort')} onClose={()=>setOpenLandmarkId('')} facts={[
        ['Adresse',[openLandmark.tags['addr:street'],openLandmark.tags['addr:housenumber']].filter(Boolean).join(' ')],
        ['Geöffnet',openLandmark.tags.opening_hours],
      ].flatMap(([label,value])=>value?[{label:String(label),value:String(value)}]:[])}/>}
      {openLandmark&&!openLandmark.business&&landmarkRoomKind(openLandmark.kind,openLandmark.tags)&&<LandmarkWalkableInterior kind={landmarkRoomKind(openLandmark.kind,openLandmark.tags)!} name={openLandmark.name} typeLabel={landmarkLabel(openLandmark.kind,openLandmark.tags)} onClose={()=>setOpenLandmarkId('')} facts={[
        ['Adresse',[openLandmark.tags['addr:street'],openLandmark.tags['addr:housenumber']].filter(Boolean).join(' ')],
        ['Geöffnet',openLandmark.tags.opening_hours],
        ['Konfession',openLandmark.tags.denomination],
        ['Erbaut',openLandmark.tags.start_date],
        ['Träger',openLandmark.tags.operator],
      ].flatMap(([label,value])=>value?[{label:String(label),value:String(value)}]:[])}/>}
      {openLandmark&&!openLandmark.business&&!landmarkRoomKind(openLandmark.kind,openLandmark.tags)&&<div className="earth-landmark-room" role="dialog" aria-label={openLandmark.name}>
        <div className="head"><div><small>REALER ORT · {landmarkLabel(openLandmark.kind,openLandmark.tags).toUpperCase()}</small><b>{openLandmark.name}</b></div><button onClick={()=>setOpenLandmarkId('')}>×</button></div>
        <svg viewBox="-14 -14 28 28" width="54" height="54" aria-hidden="true"><circle r="12" fill="#f4ecd2" stroke="#17313c" strokeWidth="1.2"/>{landmarkGlyph(openLandmark.kind,openLandmark.tags)}</svg>
        {openLandmark.tags.description&&<p>{String(openLandmark.tags.description)}</p>}
        <dl>
          {openLandmark.tags['addr:street']&&<><dt>Adresse</dt><dd>{String(openLandmark.tags['addr:street'])} {String(openLandmark.tags['addr:housenumber']??'')}</dd></>}
          {openLandmark.tags.opening_hours&&<><dt>Geöffnet</dt><dd>{String(openLandmark.tags.opening_hours)}</dd></>}
          {openLandmark.tags.denomination&&<><dt>Konfession</dt><dd>{String(openLandmark.tags.denomination)}</dd></>}
          {openLandmark.tags.start_date&&<><dt>Erbaut</dt><dd>{String(openLandmark.tags.start_date)}</dd></>}
          {openLandmark.tags.operator&&<><dt>Träger</dt><dd>{String(openLandmark.tags.operator)}</dd></>}
        </dl>
        <span>Du stehst im Eingangsbereich. Ein eigener Innenraum für diesen Ortstyp ist noch nicht gebaut. Quelle: OpenStreetMap.</span>
      </div>}
      {pendingTargets.length>0&&<div className="earth-construction-hint">Baustellen sind gelb gestrichelt markiert und zeigen Bauphase + Fortschritt.</div>}
      {hoveredBuilding&&<div className="earth-building-tooltip" style={{left:hoveredBuilding.x+12,top:hoveredBuilding.y+12}}>
        <b>{hoveredBuilding.name}</b><span>{hoveredBuilding.detail}</span><small>{Math.round(hoveredBuilding.distanceM)} m von dir</small>
      </div>}

      <div className="earth-walkable-help"><b>WASD</b> bewegen · <b>Shift</b> schneller · NPC anklicken · lokale 2.5D-Szene aus realer Geographie</div>
      <div className="earth-walkable-provenance">Gebäude ohne reale Footprints werden vorläufig als <b>abgeleitete Bebauungsmasse</b> dargestellt. Straßen, Wasser, Landnutzung und Routen stammen aus dem persistierten Orts-Snapshot.</div>

      {detailStatus!=='idle'&&<div className="earth-walkable-detail">{detailStatus==='loading'?'Gebäude, Wege und Gewässer dieses Ortes werden geladen …':<>Kartendienst nicht erreichbar – Gebäude, Wege und Gewässer fehlen noch. <button onClick={()=>{if(data?.localDetail)localEnrichmentAttempted.current.delete(data.localDetail.slug);setDetailRetry(count=>count+1)}}>Erneut versuchen</button></>}</div>}

      {ambientConversation&&!selected&&<div className="earth-overheard">
        <small>GESPRÄCH IN HÖRWEITE · {ambientConversation.conversation.item.kind==='colony'?'NOXIA':'HEUTE'}</small>
        <b>{ambientConversation.first.displayName} + {ambientConversation.second.displayName}</b>
        <p><strong>{ambientConversation.first.displayName}:</strong> „{ambientConversation.conversation.opener}“</p>
        <p><strong>{ambientConversation.second.displayName}:</strong> „{ambientConversation.conversation.followUp}“</p>
        <span>{ambientConversation.conversation.item.kind==='colony'?'NOXIA-Weltgeschehen':`Reale Meldung · ${ambientConversation.source?.name??ambientConversation.conversation.item.sourceId}`} · ca. {Math.round(ambientConversation.playerDistance)} m entfernt</span>
      </div>}

      {selected&&<aside><div className="head"><PersonPortrait id={selected.id} role={selected.assignments?.find((item:any)=>item.type==='work')?.roleCode??selected.activityState} appearance={selected.appearance} size={52} title={personSceneLabel(selected)}/><div><small>NPC · LOKAL</small><b>{personSceneLabel(selected)}</b><span>{selected.identityState!=='known'&&selected.observableDescription&&selected.observableDescription!==personSceneLabel(selected)?selected.observableDescription+' · ':''}{role(selected)}</span></div><button onClick={()=>setSelected(null)}>×</button></div><div className="facts"><span>Aktivität</span><b>{selectedActionActive?'geht voraus':selected.activityState}</b><span>Letzte Aktion</span><b>{selectedActionActive?(activeActionForSelected?.type==='visit_place'?`geht zu ${activeActionForSelected.targetName}`:(activeActionForSelected?.playerFollows?'führt dich den Weg entlang':'geht den Weg entlang')):selected.lastAction??'–'}</b></div>{(conversationByNpc[selected.id]??[]).map((entry,index)=><p key={`${entry.role}-${index}`}><b>{entry.role==='user'?'Du':selected.displayName}:</b> „{entry.content}“</p>)}{canTalkToSelected?<><div className="chat"><input value={message} maxLength={400} disabled={conversationEnd.isEnded(selected.id)} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void talk()}} placeholder={conversationEnd.isEnded(selected.id)?CONVERSATION_ENDED_PLACEHOLDER:'Kurze Antwort …'}/><button disabled={sending||conversationEnd.isEnded(selected.id)||!message.trim()} onClick={()=>void talk()}>{sending?'…':'Sprechen'}</button></div><div style={{marginTop:3,textAlign:'right',color:message.length>=350?'#f1d57a':'#738795',fontSize:9}}>{message.length}/400</div></>:<div className="chat"><span style={{flex:1,alignSelf:'center',fontSize:11,color:'#9fb0bb'}}>{selectedNpcDistance===null?'Nicht mehr in Sichtweite.':`Zu weit weg zum Ansprechen – ${Math.round(selectedNpcDistance)} m.`}</span>{selectedNpcDistance!==null&&<button onClick={()=>{setAutoWalkTargetId('');setApproachNpcId(selected.id)}}>{approachNpcId===selected.id?'GEHE …':'GEHE HIN'}</button>}</div>}</aside>}
    </div>
    <EarthBuildingAccessLayer request={entryRequest} companion={interiorCompanion} onClose={()=>setEntryRequest(null)}/>
    <style jsx>{`
      .earth-walkable{position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;z-index:1120;background:#0b1115;color:#e7eef0;font-family:system-ui;overflow:hidden}.earth-walkable header{height:46px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 14px;background:#081723ef;border-bottom:1px solid #38546b;position:relative;z-index:3}.earth-walkable header>div:first-child{display:flex;align-items:baseline;gap:10px;min-width:0}.earth-walkable header small{font:800 8px monospace;letter-spacing:.14em;color:#d7b96e}.earth-walkable header b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.earth-walkable header span{font-size:9px;color:#8ea4af}.earth-walkable header .meta{display:flex;gap:10px;margin-left:auto}.earth-walkable header button,.earth-walkable aside button{border:1px solid #476476;border-radius:6px;background:#102b3c;color:#dce9ee;padding:6px 9px;cursor:pointer}.earth-walkable-stage{position:absolute;inset:46px 0 0;overflow:hidden}.earth-walkable-stage svg{width:100%;height:100%;display:block}.earth-orientation{position:absolute;right:16px;top:16px;z-index:4;display:flex;gap:10px;align-items:center;padding:9px 11px;border:1px solid #536f7d;border-radius:8px;background:#071521df;backdrop-filter:blur(7px);font-size:9px}.earth-orientation>div:first-child{display:grid;gap:1px}.earth-orientation small{color:#d7b96e;font:800 8px monospace;letter-spacing:.1em}.earth-orientation b{font-size:11px}.earth-orientation span{color:#89a1ac}.earth-orientation label{display:grid;gap:2px;min-width:180px}.earth-orientation select{max-width:220px;border:1px solid #476476;border-radius:5px;background:#06111a;color:#e7eff2;padding:5px 7px;font-size:9px}.earth-target{display:grid;gap:3px;padding-left:9px;border-left:1px solid #425b67}.earth-target button{margin-top:3px;border:1px solid #6e7d55;border-radius:4px;background:#273d24;color:#edf3dd;padding:4px 6px;font:800 8px monospace;cursor:pointer}.earth-target button:disabled{opacity:.45;cursor:not-allowed}.earth-construction-hint{position:absolute;left:12px;top:76px;padding:5px 7px;border:1px solid #8a6a20;border-radius:5px;background:#2a220ed9;color:#ead59a;font:8px monospace}.earth-building-tooltip{position:fixed;z-index:5000;pointer-events:none;display:grid;gap:2px;min-width:150px;max-width:240px;padding:7px 9px;border:1px solid #6b8793;border-radius:6px;background:#06131df2;color:#ecf3f5;box-shadow:0 8px 24px #0007;font-size:9px}.earth-building-tooltip b{font-size:10px}.earth-building-tooltip span,.earth-building-tooltip small{color:#90a6af}
      .earth-walkable-help,.earth-walkable-provenance{position:absolute;left:12px;padding:6px 8px;border:1px solid #4b6877;border-radius:6px;background:#071521d9;font:9px monospace;color:#b7c8cf}.earth-walkable-help{top:12px}.earth-landmark-room{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:6;width:min(420px,calc(100vw - 32px));display:grid;gap:8px;padding:14px;border:1px solid #617b85;border-radius:10px;background:#071521f5;box-shadow:0 18px 44px #000a;font-size:11px;color:#dce8ed}.earth-landmark-room .head{display:flex;justify-content:space-between;align-items:center;gap:10px}.head>div:nth-child(2){flex:1}.earth-landmark-room small{display:block;color:#d7b96e;font:800 8px monospace;letter-spacing:.12em}.earth-landmark-room b{display:block;margin-top:3px;font-size:14px}.earth-landmark-room button{border:1px solid #476476;border-radius:6px;background:#102b3c;color:#dce9ee;padding:4px 9px;cursor:pointer;height:fit-content}.earth-landmark-room p{margin:0;line-height:1.45}.earth-landmark-room dl{display:grid;grid-template-columns:90px 1fr;gap:4px;margin:0}.earth-landmark-room dt{color:#7e98a3}.earth-landmark-room dd{margin:0}.earth-landmark-room>span{color:#879ca7;font-size:9px}.earth-walkable-detail{position:absolute;left:12px;top:92px;max-width:520px;padding:6px 8px;border:1px solid #8a6a20;border-radius:6px;background:#2a220ee6;color:#ead59a;font:9px monospace}.earth-walkable-detail button{margin-left:6px;border:1px solid #8a6a20;border-radius:4px;background:#4a3a14;color:#f3e2ad;padding:2px 6px;font:800 8px monospace;cursor:pointer}.earth-walkable-provenance{top:44px;max-width:520px;color:#92a9b2}.earth-overheard{position:absolute;left:16px;bottom:84px;width:360px;max-width:calc(100vw - 32px);padding:10px 12px;border:1px solid #567487;border-radius:9px;background:#071521e8;box-shadow:0 12px 28px #0007;color:#dce8ed;backdrop-filter:blur(7px)}.earth-overheard small{display:block;color:#7fb1c9;font:800 8px monospace;letter-spacing:.1em}.earth-overheard>b{display:block;margin-top:3px;font-size:11px}.earth-overheard p{margin:6px 0 0;font-size:10px;line-height:1.4}.earth-overheard>span{display:block;margin-top:7px;color:#879ca7;font-size:8px}.earth-walkable aside{position:absolute;right:16px;top:16px;z-index:5;width:390px;max-height:calc(100% - 32px);overflow:auto;padding:10px;border:1px solid #617b85;border-radius:9px;background:#071521f2;box-shadow:0 16px 38px #0008;backdrop-filter:blur(8px)}.earth-walkable .head{display:flex;justify-content:space-between;gap:12px}.earth-walkable .head small{display:block;color:#d7b96e;font:800 8px monospace;letter-spacing:.12em}.earth-walkable .head b{display:block;margin-top:3px}.earth-walkable .head span{display:block;margin-top:2px;color:#8ba3ad;font-size:9px}.earth-walkable .facts{display:grid;grid-template-columns:90px 1fr;gap:5px;margin-top:10px;font-size:10px}.earth-walkable .facts span{color:#7e98a3}.earth-walkable .chat{display:flex;gap:6px;margin-top:10px}.earth-walkable .chat input{flex:1;min-width:0;border:1px solid #476476;border-radius:6px;background:#061019;color:#eef5f7;padding:7px 8px}.earth-walkable aside p{margin:9px 0 0;padding-top:8px;border-top:1px solid #314753;color:#d7e4e8;font-size:11px;line-height:1.45}.earth-walkable-loading{position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;z-index:1120;display:grid;place-items:center;background:#07111b;color:#bcd2dc;font-family:monospace}
      @media(max-width:760px){.earth-walkable header .meta{display:none}.earth-orientation{left:12px;right:12px;top:12px;flex-wrap:wrap}.earth-orientation label{min-width:140px;flex:1}.earth-walkable-provenance{max-width:calc(100% - 24px)}.earth-overheard{left:12px;right:12px;bottom:92px;width:auto}.earth-walkable aside{left:12px;right:12px;top:auto;bottom:92px;width:auto;max-height:42vh}}
    `}</style>
  </section>
}
