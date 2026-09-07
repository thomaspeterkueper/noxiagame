'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { getBuildingVisual } from '@/lib/game/buildings/visuals'
import { geoToLocalMeters, localMetersToGeo } from '@/lib/world/spatial/earthSpatial'

type GeoPoint = { lat:number; lon:number }
type Feature = { id:string; featureType:string; properties:Record<string,string>; geometry:{kind:'point';coordinates:GeoPoint}|{kind:'line'|'polygon';coordinates:GeoPoint[]} }
type Payload = { ok:boolean; region?:{name:string;origin:GeoPoint}; queryCenter?:GeoPoint; detail?:boolean; bounds?:{south:number;west:number;north:number;east:number}; featureCount?:number; features?:Feature[]; attribution?:string; error?:string }
type Candidate = GeoPoint & { elevationM:number; slopePercent:number; reliefM:number; score:number; roadDistanceM:number|null; railDistanceM:number|null; exclusionDistanceM:number|null; exclusionType:string|null; reasons:string[] }
type ShortlistCandidate = Candidate & { shortlistRank:1|2|3; shortlistLabel:'A'|'B'|'C'; shortlistReason:string }
type CandidatePayload = { ok:boolean; candidates?:Candidate[]; shortlist?:ShortlistCandidate[]; attribution?:string; error?:string }
type BuildingDef = { id:string; name:string; cost:number; buildTimeTicks:number; footprint:{widthM:number;depthM:number;clearanceM:number} }
type SpatialEntity = { id:string; entity_id:string; x_m:number|null; y_m:number|null; rotation_deg:number|null; footprint_width_m:number|null; footprint_depth_m:number|null; status:string }
type PendingBuild = { id:string; buildable_id:string; x_m:number|null; y_m:number|null; rotation_deg:number|null; footprint_width_m:number|null; footprint_depth_m:number|null; status:string }
type SpatialPayload = { location?:{slug:string;name:string}; available?:BuildingDef[]; entities?:SpatialEntity[]; builds?:PendingBuild[]; error?:string }
type BuildPreview = { mapX:number;mapY:number;xM:number;yM:number }
type TerrainCell = { row:number;col:number;xM:number;yM:number;elevationM:number;slopeDeg:number|null;state:'buildable'|'restricted'|'invalid'|'unresolved';reason:string|null }
type TerrainPayload = { ok:boolean; sourceResolutionM?:number; sampledRows?:number; sampledCols?:number; cells?:TerrainCell[]; error?:string }
type LayerKey = 'relief'|'landuse'|'water'|'infrastructure'|'buildability'|'slope'|'noxia'|'sites'

const layerOrder=['farmland','forest','urban','water','industrial','public','building','waterway','rail','road','settlement']
const defaultLayers:Record<LayerKey,boolean>={relief:true,landuse:true,water:true,infrastructure:true,buildability:false,slope:false,noxia:true,sites:true}
const BUILD_PLAN_VISIBLE_WIDTH_M=300
const LOCAL_DETAIL_RADIUS_KM=.65
const EARTH_DATA_VERSION='20260906-local-detail-1'

function styleFor(type:string,tags:Record<string,string>){
  switch(type){
    case'forest':return{fill:'#6f875d',stroke:'#5f754f',width:.45}
    case'farmland':return{fill:'#c4b879',stroke:'#b1a46b',width:.35}
    case'urban':return{fill:'#aaa9a3',stroke:'#85847f',width:.45}
    case'water':return{fill:'#82b8d4',stroke:'#5b9cbe',width:.6}
    case'waterway':return{fill:'none',stroke:'#5b9cbe',width:1.4}
    case'industrial':return{fill:'#b8b5ad',stroke:'#8b8880',width:.4}
    case'public':return{fill:'#d9d2b8',stroke:'#b4aa88',width:.4}
    case'building':return{fill:'#d8d0c5',stroke:'#81786f',width:.5}
    case'rail':return{fill:'none',stroke:'#625d59',width:.8}
    case'road':{const major=['motorway','trunk','primary','secondary'].includes(tags.highway);return{fill:'none',stroke:major?'#e2c98f':'#f4eee0',width:major?2.4:1.2}}
    default:return{fill:'#9caf78',stroke:'#708263',width:.5}
  }
}

function distanceMeters(a:GeoPoint,b:GeoPoint){const lat=(a.lat+b.lat)*Math.PI/360;const dx=(b.lon-a.lon)*111320*Math.cos(lat);const dy=(b.lat-a.lat)*110540;return Math.hypot(dx,dy)}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
function payloadWidthM(payload:Payload){if(!payload.bounds)return null;const b=payload.bounds,lat=(b.south+b.north)/2;return distanceMeters({lat,lon:b.west},{lat,lon:b.east})}

export default function EarthRegionPreview(){
  const[data,setData]=useState<Payload|null>(null)
  const[overviewData,setOverviewData]=useState<Payload|null>(null)
  const[candidateData,setCandidateData]=useState<CandidatePayload|null>(null)
  const[spatial,setSpatial]=useState<SpatialPayload|null>(null)
  const[terrain,setTerrain]=useState<TerrainPayload|null>(null)
  const[zoom,setZoom]=useState(1)
  const[offset,setOffset]=useState({x:0,y:0})
  const[selected,setSelected]=useState<string|null>(null)
  const[buildTypeId,setBuildTypeId]=useState<string|null>(null)
  const[preview,setPreview]=useState<BuildPreview|null>(null)
  const[buildMessage,setBuildMessage]=useState<string|null>(null)
  const[placing,setPlacing]=useState(false)
  const[layers,setLayers]=useState<Record<LayerKey,boolean>>(defaultLayers)
  const[layersOpen,setLayersOpen]=useState(false)
  const[focusLabel,setFocusLabel]=useState<string|null>(null)
  const[focusLoading,setFocusLoading]=useState(false)
  const[focusError,setFocusError]=useState<string|null>(null)

  const drag=useRef<{x:number;y:number;ox:number;oy:number}|null>(null)
  const mapGroupRef=useRef<SVGGElement|null>(null)

  const loadSpatial=async()=>{const token=await getToken();if(!token){setSpatial({error:'Nicht angemeldet'});return}const response=await fetch('/api/game/build/spatial?location=earth',{headers:{Authorization:`Bearer ${token}`}});setSpatial(await response.json())}

  useEffect(()=>{
    const load=async()=>{
      try{
        const response=await fetch(`/api/earth/region?radiusKm=3&v=${EARTH_DATA_VERSION}`,{cache:'no-store'})
        const json=await response.json() as Payload
        setData(json)
        if(json.ok)setOverviewData(json)
      }catch(e){setData({ok:false,error:String(e)})}
    }
    void load()
    fetch('/api/earth/spaceport-candidates?radiusKm=3').then(r=>r.json()).then(setCandidateData).catch(e=>setCandidateData({ok:false,error:String(e)}))
    void loadSpatial()
  },[])
  useEffect(()=>{const cancel=(e:KeyboardEvent)=>{if(e.key==='Escape'){setBuildTypeId(null);setPreview(null);setBuildMessage(null)}};window.addEventListener('keydown',cancel);return()=>window.removeEventListener('keydown',cancel)},[])

  const projection=useMemo(()=>{if(!data?.bounds)return null;const b=data.bounds;return{x:(lon:number)=>((lon-b.west)/(b.east-b.west))*1000,y:(lat:number)=>((b.north-lat)/(b.north-b.south))*1000,lon:(x:number)=>b.west+x/1000*(b.east-b.west),lat:(y:number)=>b.north-y/1000*(b.north-b.south)}},[data])
  const mapMetrics=useMemo(()=>{if(!data?.bounds)return null;const b=data.bounds,midLat=(b.south+b.north)/2,midLon=(b.west+b.east)/2;return{widthM:distanceMeters({lat:midLat,lon:b.west},{lat:midLat,lon:b.east}),heightM:distanceMeters({lat:b.south,lon:midLon},{lat:b.north,lon:midLon})}},[data])

  useEffect(()=>{if(!data?.bounds||!data.region?.origin)return;const origin=data.region.origin,b=data.bounds,nw=geoToLocalMeters({lat:b.north,lon:b.west},origin),se=geoToLocalMeters({lat:b.south,lon:b.east},origin);const q=new URLSearchParams({minXM:String(Math.min(nw.eastM,se.eastM)),minYM:String(Math.min(nw.northM,se.northM)),maxXM:String(Math.max(nw.eastM,se.eastM)),maxYM:String(Math.max(nw.northM,se.northM)),maxBuildableSlopeDeg:'5',maxRestrictedSlopeDeg:'12',resolutionM:data.detail?'30':'120'});fetch(`/api/earth/buildability?${q}`).then(r=>r.json()).then(setTerrain).catch(e=>setTerrain({ok:false,error:String(e)}))},[data])

  const projected=useMemo(()=>{if(!projection||!data?.features)return[];return[...data.features].sort((a,b)=>layerOrder.indexOf(a.featureType)-layerOrder.indexOf(b.featureType)).map(f=>f.geometry.kind==='point'?{...f,p:[projection.x(f.geometry.coordinates.lon),projection.y(f.geometry.coordinates.lat)]as[number,number]}:{...f,d:f.geometry.coordinates.map((p,i)=>`${i?'L':'M'}${projection.x(p.lon).toFixed(2)} ${projection.y(p.lat).toFixed(2)}`).join(' ')+(f.geometry.kind==='polygon'?' Z':'')})},[data,projection])
  const candidates=useMemo(()=>projection?(candidateData?.candidates??[]).map((c,i)=>({...c,index:i,x:projection.x(c.lon),y:projection.y(c.lat)})):[],[candidateData,projection])
  const shortlist=useMemo(()=>projection?(candidateData?.shortlist??[]).map(c=>({...c,x:projection.x(c.lon),y:projection.y(c.lat)})):[],[candidateData,projection])
  const active=selected?shortlist.find(c=>c.shortlistLabel===selected)??null:null

  const scale=useMemo(()=>{if(!mapMetrics)return null;const visibleWidthM=mapMetrics.widthM/zoom,targetM=visibleWidthM/5,options=[2,5,10,20,50,100,200,500,1000,2000,5000,10000];const meters=options.reduce((best,n)=>Math.abs(n-targetM)<Math.abs(best-targetM)?n:best,options[0]);return{meters,pixels:meters/mapMetrics.widthM*1000*zoom}},[mapMetrics,zoom])

  const terrainOverlay=useMemo(()=>{if(!terrain?.ok||!terrain.cells||!projection||!data?.region?.origin||!mapMetrics)return[];const cells=terrain.cells,byKey=new Map(cells.map(c=>[`${c.row}:${c.col}`,c]));const stepX=(terrain.sourceResolutionM??120)/mapMetrics.widthM*1000,stepY=(terrain.sourceResolutionM??120)/mapMetrics.heightM*1000;return cells.map(c=>{const geo=localMetersToGeo({eastM:c.xM,northM:c.yM},data.region!.origin),x=projection.x(geo.lon),y=projection.y(geo.lat),west=byKey.get(`${c.row}:${c.col-1}`),east=byKey.get(`${c.row}:${c.col+1}`),north=byKey.get(`${c.row-1}:${c.col}`),south=byKey.get(`${c.row+1}:${c.col}`),dx=(east?.elevationM??c.elevationM)-(west?.elevationM??c.elevationM),dy=(south?.elevationM??c.elevationM)-(north?.elevationM??c.elevationM),light=clamp(.52+(-dx+dy)*.012,.18,.82);return{...c,x,y,w:stepX,h:stepY,shade:light<.5?'#203026':'#fff7da',shadeOpacity:Math.abs(light-.5)*.42,buildFill:c.state==='buildable'?'#4ecb71':c.state==='restricted'?'#e6bc46':c.state==='invalid'?'#d85757':'#78818a',slopeOpacity:clamp((c.slopeDeg??0)/22,0,.55)}})},[terrain,projection,data,mapMetrics])

  const selectedBuilding=(spatial?.available??[]).find(b=>b.id===buildTypeId)??null
  const selectedVisual=selectedBuilding?getBuildingVisual(selectedBuilding.id,'earth'):null
  const placed=useMemo(()=>{if(!projection||!data?.region?.origin||!mapMetrics)return[];const defs=new Map((spatial?.available??[]).map(b=>[b.id,b]));const rows=[...(spatial?.entities??[]).map(e=>({id:e.id,typeId:e.entity_id,xM:e.x_m,yM:e.y_m,rotation:e.rotation_deg,widthM:e.footprint_width_m,depthM:e.footprint_depth_m,pending:false})),...(spatial?.builds??[]).map(b=>({id:b.id,typeId:b.buildable_id,xM:b.x_m,yM:b.y_m,rotation:b.rotation_deg,widthM:b.footprint_width_m,depthM:b.footprint_depth_m,pending:true}))];return rows.flatMap(row=>{if(row.xM==null||row.yM==null)return[];const geo=localMetersToGeo({eastM:Number(row.xM),northM:Number(row.yM)},data.region!.origin),def=defs.get(row.typeId),widthSvg=Number(row.widthM??def?.footprint.widthM??10)/mapMetrics.widthM*1000,depthSvg=Number(row.depthM??def?.footprint.depthM??10)/mapMetrics.heightM*1000;return[{...row,name:def?.name??row.typeId,mapX:projection.x(geo.lon),mapY:projection.y(geo.lat),widthSvg,depthSvg,visual:getBuildingVisual(row.typeId,'earth')}]})},[projection,data,spatial,mapMetrics])

  function featureVisible(type:string){if(type==='water'||type==='waterway')return layers.water;if(type==='forest'||type==='farmland'||type==='urban')return layers.landuse;if(type==='road'||type==='rail'||type==='industrial'||type==='public'||type==='building')return layers.infrastructure;return true}
  function toggleLayer(key:LayerKey){setLayers(v=>({...v,[key]:!v[key]}))}
  function setCamera(nextZoom:number,centerX:number,centerY:number){setZoom(nextZoom);setOffset({x:500-centerX*nextZoom,y:500-centerY*nextZoom})}
  async function focusGeoPoint(point:GeoPoint,label:string){
    if(buildTypeId||focusLoading)return
    setFocusLoading(true);setFocusError(null)
    try{
      const q=new URLSearchParams({lat:String(point.lat),lon:String(point.lon),radiusKm:String(LOCAL_DETAIL_RADIUS_KM),v:EARTH_DATA_VERSION})
      const response=await fetch(`/api/earth/region?${q}`,{cache:'no-store'})
      const local=await response.json() as Payload
      if(!response.ok||!local.ok||!local.bounds)throw new Error(local.error??'Lokale Kartendaten konnten nicht geladen werden')
      const widthM=payloadWidthM(local)??(LOCAL_DETAIL_RADIUS_KM*2000)
      setData(local)
      setFocusLabel(label)
      setZoom(clamp(widthM/BUILD_PLAN_VISIBLE_WIDTH_M,.7,128))
      setOffset({x:500-500*clamp(widthM/BUILD_PLAN_VISIBLE_WIDTH_M,.7,128),y:500-500*clamp(widthM/BUILD_PLAN_VISIBLE_WIDTH_M,.7,128)})
    }catch(error){setFocusError(error instanceof Error?error.message:String(error))}
    finally{setFocusLoading(false)}
  }
  function resetOverview(){if(overviewData)setData(overviewData);setZoom(1);setOffset({x:0,y:0});setFocusLabel(null);setFocusError(null);setSelected(null)}
  function zoomAroundCenter(direction:1|-1){const factor=direction>0?1.15:.87,nextZoom=clamp(zoom*factor,.7,128),centerX=(500-offset.x)/zoom,centerY=(500-offset.y)/zoom;setCamera(nextZoom,centerX,centerY)}

  function pointerToPreview(e:{clientX:number;clientY:number}){if(!projection||!data?.region?.origin||!mapGroupRef.current)return null;const svg=mapGroupRef.current.ownerSVGElement,ctm=mapGroupRef.current.getScreenCTM();if(!svg||!ctm)return null;const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const local=point.matrixTransform(ctm.inverse()),geo={lon:projection.lon(local.x),lat:projection.lat(local.y)},metric=geoToLocalMeters(geo,data.region.origin);return{mapX:local.x,mapY:local.y,xM:metric.eastM,yM:metric.northM}}

  async function placeBuilding(target:BuildPreview|null=preview){if(!selectedBuilding||!target||placing)return;setPlacing(true);setBuildMessage('Bauauftrag wird geprüft …');try{const token=await getToken();if(!token)throw new Error('Nicht angemeldet');const response=await fetch('/api/game/build/spatial',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({buildableId:selectedBuilding.id,location:'earth',xM:target.xM,yM:target.yM})});const json=await response.json();if(!response.ok)throw new Error(json.error??'Bauauftrag fehlgeschlagen');setBuildMessage(`${selectedBuilding.name}: Bauauftrag angelegt`);setLayers(v=>({...v,noxia:true}));await loadSpatial()}catch(error){setBuildMessage(error instanceof Error?error.message:String(error))}finally{setPlacing(false)}}

  if(!data)return <div className="earth-loading">Reale Sauerland-Daten werden geladen …</div>
  if(!data.ok)return <div className="earth-loading">Geodaten derzeit nicht erreichbar: {data.error}</div>

  return <div className="earth-shell">
    <div className="earth-head"><div><small>NOXIA EARTH · SAUERLAND 2086</small><h1>Technikstandort Deutschland · Sauerland</h1><p>Reale Geometrie und reale Entfernungen sind Ground Truth. NOXIA-Gebäude verwenden dieselben metrischen Weltkoordinaten.</p></div><div className="earth-actions"><button onClick={()=>toggleLayer('sites')}>{layers.sites?'Standorte ausblenden':'Standorte einblenden'}</button><select value={buildTypeId??''} onChange={e=>{setBuildTypeId(e.target.value||null);setBuildMessage(null)}}><option value="">Bauen …</option>{(spatial?.available??[]).map(b=><option key={b.id} value={b.id}>{b.name} · {b.cost} Cr · {b.footprint.widthM}×{b.footprint.depthM} m</option>)}</select>{buildTypeId&&<button onClick={()=>{setBuildTypeId(null);setPreview(null);setBuildMessage(null)}}>Abbrechen</button>}<div className="earth-stats"><b>{placed.length}</b><span>NOXIA-Bauten</span></div></div></div>

    <div className={`earth-map ${buildTypeId?'building':''}`}
      onWheel={e=>{e.preventDefault();zoomAroundCenter(e.deltaY<0?1:-1)}}
      onPointerDown={e=>{if(buildTypeId){const next=pointerToPreview(e);if(next)setPreview(next);return}drag.current={x:e.clientX,y:e.clientY,ox:offset.x,oy:offset.y};e.currentTarget.setPointerCapture(e.pointerId)}}
      onPointerMove={e=>{if(buildTypeId){const next=pointerToPreview(e);if(next)setPreview(next);return}if(drag.current)setOffset({x:drag.current.ox+e.clientX-drag.current.x,y:drag.current.oy+e.clientY-drag.current.y})}}
      onPointerUp={e=>{if(buildTypeId)return;drag.current=null;try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}}}>
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" onClick={e=>{if(!buildTypeId)return;const next=pointerToPreview(e);if(next){setPreview(next);void placeBuilding(next)}}}>
        <rect width="1000" height="1000" fill="#9caf78"/>
        <g ref={mapGroupRef} transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
          {layers.relief&&terrainOverlay.map(c=><rect key={`relief-${c.row}-${c.col}`} x={c.x-c.w/2} y={c.y-c.h/2} width={c.w*1.08} height={c.h*1.08} fill={c.shade} opacity={c.shadeOpacity}/>) }
          {projected.map((f:any)=>{if(!featureVisible(f.featureType))return null;const s=styleFor(f.featureType,f.properties||{});if(f.p){if(f.featureType!=='settlement')return null;const name=f.properties?.name||'';const point=f.geometry.coordinates as GeoPoint;return <g key={f.id} role="button" aria-label={`${name} auf Bauplan-Größe öffnen`} onPointerDown={e=>{if(!buildTypeId)e.stopPropagation()}} onClick={e=>{if(buildTypeId)return;e.stopPropagation();void focusGeoPoint(point,name)}} style={{cursor:buildTypeId?'crosshair':'pointer'}}><circle cx={f.p[0]} cy={f.p[1]} r={18/zoom} fill="transparent"/><circle cx={f.p[0]} cy={f.p[1]} r={4.5/zoom} fill="#344d59" stroke="#f4f1e6" strokeWidth={1.2/zoom}/><text pointerEvents="none" x={f.p[0]+7/zoom} y={f.p[1]-5/zoom} fontSize={10/zoom} fontWeight="700" fill="#17313c" paintOrder="stroke" stroke="#f4f1e6" strokeWidth={2.4/zoom}>{name}</text></g>}return <path key={f.id} d={f.d} fill={s.fill} stroke={s.stroke} strokeWidth={s.width/zoom} vectorEffect="non-scaling-stroke" opacity={f.featureType==='building'?.9:1}/>})}
          {layers.buildability&&terrainOverlay.map(c=><rect key={`build-${c.row}-${c.col}`} x={c.x-c.w/2} y={c.y-c.h/2} width={c.w} height={c.h} fill={c.buildFill} opacity={.28} stroke={c.buildFill} strokeWidth={.25/zoom}/>)}
          {layers.slope&&terrainOverlay.map(c=><rect key={`slope-${c.row}-${c.col}`} x={c.x-c.w/2} y={c.y-c.h/2} width={c.w} height={c.h} fill="#351d18" opacity={c.slopeOpacity}/>)}

          {layers.noxia&&placed.map(b=>{const visual=b.visual,spriteScale=visual?.mapScale??1.7,spriteW=Math.max(b.widthSvg*spriteScale,22/zoom),spriteH=Math.max(Math.max(b.depthSvg,b.widthSvg*.72)*spriteScale,18/zoom);return <g key={`noxia-${b.id}`} pointerEvents="none" transform={`translate(${b.mapX} ${b.mapY}) rotate(${b.rotation??0})`}><ellipse cx={0} cy={b.depthSvg*.18} rx={Math.max(b.widthSvg*.58,5/zoom)} ry={Math.max(b.depthSvg*.32,2.4/zoom)} fill="#14271e" opacity={b.pending?.22:.28}/><rect x={-b.widthSvg/2} y={-b.depthSvg/2} width={Math.max(b.widthSvg,2/zoom)} height={Math.max(b.depthSvg,2/zoom)} rx={1/zoom} fill={b.pending?'#d9a63d':'#eaf1df'} fillOpacity={b.pending?.38:.22} stroke={b.pending?'#7b5914':'#173f49'} strokeOpacity={1} strokeWidth={1.5/zoom} strokeDasharray={b.pending?`${3/zoom} ${2/zoom}`:undefined}/>{visual?.mapAsset?<image href={visual.mapAsset} x={-spriteW/2} y={-spriteH*.72} width={spriteW} height={spriteH} preserveAspectRatio="xMidYMid meet" opacity={b.pending?.7:1}/>:<rect x={-b.widthSvg/2} y={-b.depthSvg/2} width={Math.max(b.widthSvg,2/zoom)} height={Math.max(b.depthSvg,2/zoom)} rx={1/zoom} fill={b.pending?'#d9a63d':'#1f5967'} fillOpacity={b.pending?.8:.95}/>} {zoom>=3&&<text x={0} y={-spriteH*.58-5/zoom} textAnchor="middle" fontSize={9/zoom} fontWeight="800" fill="#17313c" paintOrder="stroke" stroke="#f5f2e8" strokeWidth={2/zoom}>{b.name}{b.pending?' · Bau':''}</text>}</g>})}

          {!data.detail&&layers.sites&&candidates.map(c=><circle key={`raw-${c.lat}-${c.lon}`} cx={c.x} cy={c.y} r={4/zoom} fill="#fff4be" stroke="#8d732e" strokeWidth={1/zoom} opacity=".45"/>)}
          {!data.detail&&layers.sites&&shortlist.map(c=><g key={c.shortlistLabel} role="button" aria-label={`Prüfstandort ${c.shortlistLabel} auf Bauplan-Größe öffnen`} onPointerDown={e=>{if(!buildTypeId)e.stopPropagation()}} onClick={e=>{if(buildTypeId)return;e.stopPropagation();setSelected(c.shortlistLabel);void focusGeoPoint({lat:c.lat,lon:c.lon},`Prüfstandort ${c.shortlistLabel}`)}} style={{cursor:buildTypeId?'crosshair':'pointer'}}><circle cx={c.x} cy={c.y} r={20/zoom} fill="transparent"/><circle cx={c.x} cy={c.y} r={15/zoom} fill={c.shortlistRank===1?'#efc34d':'#fff3bd'} stroke="#5d4300" strokeWidth={2.5/zoom}/><text pointerEvents="none" x={c.x} y={c.y+4/zoom} textAnchor="middle" fontSize={11/zoom} fontWeight="900" fill="#493500">{c.shortlistLabel}</text></g>)}

          {selectedBuilding&&preview&&mapMetrics&&(()=>{const width=selectedBuilding.footprint.widthM/mapMetrics.widthM*1000,depth=selectedBuilding.footprint.depthM/mapMetrics.heightM*1000,spriteScale=selectedVisual?.mapScale??1.7,spriteW=Math.max(width*spriteScale,22/zoom),spriteH=Math.max(Math.max(depth,width*.72)*spriteScale,18/zoom);return <g transform={`translate(${preview.mapX} ${preview.mapY})`} pointerEvents="none"><rect x={-width/2} y={-depth/2} width={width} height={depth} fill="#e9c95e" fillOpacity=".32" stroke="#6e5712" strokeWidth={2/zoom} strokeDasharray={`${5/zoom} ${3/zoom}`}/>{selectedVisual?.mapAsset&&<image href={selectedVisual.mapAsset} x={-spriteW/2} y={-spriteH*.72} width={spriteW} height={spriteH} preserveAspectRatio="xMidYMid meet" opacity=".58"/>}<circle r={3/zoom} fill="#6e5712"/></g>})()}
        </g>
      </svg>

      <div className="earth-map-tools"><div className="earth-compass" aria-label="Karte ist nach Norden ausgerichtet"><span>N</span><b>↑</b></div>{scale&&<div className="earth-scale"><span>{scale.meters>=1000?`${scale.meters/1000} km`:`${scale.meters} m`}</span><i style={{width:`${Math.max(26,Math.min(150,scale.pixels))}px`}}/></div>}{focusLabel&&<button className="earth-focus" onClick={resetOverview}>{focusLabel}<small>Übersicht</small></button>}</div>
      <div className="earth-layer-control"><button className="earth-layer-trigger" onClick={()=>setLayersOpen(v=>!v)}>☷ Layer</button>{layersOpen&&<div className="earth-layer-menu">{([['relief','Relief / DEM'],['landuse','Landnutzung'],['water','Wasser'],['infrastructure','Infrastruktur'],['buildability','Bebaubarkeit'],['slope','Neigung'],['noxia','NOXIA-Bauten'],['sites','Prüfstandorte']] as [LayerKey,string][]).map(([key,label])=><button key={key} className={layers[key]?'active':''} onClick={()=>toggleLayer(key)}><span>{layers[key]?'●':'○'}</span>{label}</button>)}<div className="earth-layer-disabled">○ Ressourcen · Daten folgen</div></div>}</div>
      {focusLoading&&<div className="earth-detail-status">Kartendetails werden geladen …</div>}
      {focusError&&<div className="earth-detail-status error">{focusError}</div>}
      {buildTypeId&&<div className="earth-build-status"><b>{selectedBuilding?.name??'Bauen'}</b><span>{preview?`${preview.xM.toFixed(0)} m E · ${preview.yM.toFixed(0)} m N`:'Position wählen'}</span><small>Klick: Bauauftrag · Esc: abbrechen</small>{buildMessage&&<em>{buildMessage}</em>}</div>}
      {active&&<div className="earth-candidate"><button onClick={()=>setSelected(null)}>×</button><small>PRÜFSTANDORT {active.shortlistLabel}</small><strong>{active.score.toFixed(0)} / 100</strong><span>{active.elevationM.toFixed(0)} m Höhe · {active.slopePercent.toFixed(1)} % Neigung · {active.reliefM.toFixed(0)} m Relief</span><span>Straße {active.roadDistanceM??'–'} m · Bahn {active.railDistanceM??'–'} m</span><p>{active.reasons.join(' · ')}</p><em>{active.shortlistReason}. Noch keine kanonische Platzierung.</em></div>}
      <div className="earth-help">{buildTypeId?'Bauposition wählen · Esc: abbrechen':data.detail?'Lokale OSM-Details · Mausrad: Zoom · Ziehen: Karte':'Stadt/Punkt klicken: Bauplan · Mausrad: Zoom · Ziehen: Karte'}</div>
    </div>

    <div className="earth-foot"><span>{candidateData?.attribution||data.attribution}</span><span>{data.detail?`Lokale OSM-Details · ${data.featureCount??0} Objekte`:'DEM-Relief: Copernicus/Open-Meteo · Bebaubarkeit aus metrischen Terrain-Zellen'}</span></div>

    <style jsx>{`
      .earth-shell{min-height:100%;background:#eef0e8;color:#1f3440;font-family:system-ui,sans-serif;padding:14px;box-sizing:border-box}
      .earth-head{display:flex;justify-content:space-between;gap:20px;align-items:end;max-width:1500px;margin:0 auto 12px}.earth-head small{letter-spacing:.16em;font-weight:800;color:#597284}.earth-head h1{font-family:Georgia,serif;font-weight:400;margin:5px 0 4px;font-size:26px}.earth-head p{margin:0;color:#68777e;font-size:12px;max-width:850px}
      .earth-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.earth-actions button,.earth-actions select{border:1px solid #a8893d;background:#fffaf0;color:#735918;border-radius:7px;padding:8px 11px;font-weight:750}.earth-actions button{cursor:pointer}.earth-stats{text-align:right;margin-left:8px}.earth-stats b{display:block;font-size:24px;color:#b28d33}.earth-stats span{font-size:10px;text-transform:uppercase;letter-spacing:.12em}
      .earth-map{position:relative;max-width:1500px;height:calc(100vh - 245px);min-height:560px;margin:auto;border:1px solid #a9b2a5;border-radius:12px;overflow:hidden;background:#9caf78;box-shadow:0 16px 45px #41503a24;touch-action:none;cursor:grab}.earth-map:active{cursor:grabbing}.earth-map.building,.earth-map.building:active{cursor:crosshair}.earth-map svg{width:100%;height:100%;display:block}
      .earth-map-tools{position:absolute;left:16px;top:14px;display:flex;align-items:flex-start;gap:12px;color:#17313c;text-shadow:0 1px 2px #fff,0 0 7px #f4f1e6}.earth-compass,.earth-scale{pointer-events:none}.earth-compass{width:30px;height:38px;display:grid;place-items:center;position:relative;color:#17313c}.earth-compass span{position:absolute;top:0;font-size:10px;font-weight:900}.earth-compass b{font-size:26px;line-height:1;margin-top:8px}.earth-scale{min-width:72px;padding-top:2px;color:#17313c}.earth-scale span{display:block;font-size:10px;font-weight:900;margin-bottom:3px;text-align:center}.earth-scale i{display:block;height:7px;border-left:2px solid #17313c;border-right:2px solid #17313c;border-bottom:3px solid #17313c;box-sizing:border-box;filter:drop-shadow(0 1px 1px #fff)}.earth-focus{pointer-events:auto;border:1px solid #506b73;background:#f5f2e8dd;color:#17313c;border-radius:7px;padding:5px 8px;font-size:10px;font-weight:800;cursor:pointer;text-shadow:none;display:grid;gap:1px}.earth-focus small{font-size:8px;font-weight:700;color:#738087}
      .earth-layer-control{position:absolute;right:14px;top:14px;z-index:4}.earth-layer-trigger{border:1px solid #47616d;background:#102632dc;color:#e9f0ed;border-radius:7px;padding:7px 10px;font-size:10px;font-weight:800;cursor:pointer;backdrop-filter:blur(4px)}.earth-layer-menu{margin-top:6px;width:172px;background:#0b1c27ed;border:1px solid #405965;border-radius:9px;padding:6px;box-shadow:0 8px 28px #10202745;backdrop-filter:blur(8px)}.earth-layer-menu button{width:100%;display:flex;gap:8px;align-items:center;border:0;background:transparent;color:#9fb2b8;padding:7px 8px;text-align:left;font-size:10px;border-radius:5px;cursor:pointer}.earth-layer-menu button:hover,.earth-layer-menu button.active{background:#173746;color:#f2e7ba}.earth-layer-menu button span{width:12px;color:#d4ad43}.earth-layer-disabled{padding:7px 8px;color:#64767c;font-size:9px;border-top:1px solid #263b44;margin-top:4px}
      .earth-detail-status{position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:5;background:#102632e8;color:#f4f0dd;border:1px solid #58717a;border-radius:8px;padding:8px 12px;font-size:10px;font-weight:800}.earth-detail-status.error{background:#612f2fe8;border-color:#9c6262}
      .earth-build-status{position:absolute;left:50%;top:14px;transform:translateX(-50%);background:#fffaf0ed;border:1px solid #a8893d;border-radius:9px;padding:10px 12px;display:grid;gap:3px;box-shadow:0 5px 18px #30270f25;pointer-events:none}.earth-build-status b{font-size:12px}.earth-build-status span{font:700 11px ui-monospace,monospace}.earth-build-status small{font-size:9px;color:#786c53}.earth-build-status em{font-style:normal;font-size:10px;color:#8a5d05}
      .earth-candidate{position:absolute;right:14px;top:58px;width:285px;background:#fffcf1ee;border:1px solid #b4933f;border-radius:9px;padding:12px 14px;display:grid;gap:5px;font-size:11px}.earth-candidate button{position:absolute;right:7px;top:5px;border:0;background:none;font-size:18px}.earth-candidate small{letter-spacing:.12em;color:#80651d;font-weight:800}.earth-candidate strong{font-size:23px;color:#9a7622}.earth-candidate p{margin:4px 0}.earth-candidate em{font-size:9px;color:#8a7d65}
      .earth-help{position:absolute;right:12px;bottom:10px;background:#203744d9;color:#edf4f4;border-radius:6px;padding:6px 9px;font-size:10px}.earth-foot{max-width:1500px;margin:8px auto 0;display:flex;justify-content:space-between;color:#728079;font-size:10px}.earth-loading{min-height:60vh;display:grid;place-items:center;background:#eef0e8;color:#53666e;font:600 14px system-ui}
      @media(max-width:900px){.earth-head{align-items:start;display:block}.earth-actions{margin-top:10px}.earth-stats{display:none}.earth-head h1{font-size:21px}.earth-map{min-height:500px;height:70vh}.earth-map-tools{left:10px;top:10px}.earth-layer-control{right:10px;top:10px}.earth-candidate{top:auto;bottom:58px;right:10px;left:10px;width:auto}.earth-foot{display:block}.earth-foot span{display:block;margin-top:3px}.earth-focus{max-width:120px}}
    `}</style>
  </div>
}