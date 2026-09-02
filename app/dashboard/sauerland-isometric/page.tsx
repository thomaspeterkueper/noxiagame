'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LOCATION_MAPS, terrainCodeToType } from '@/lib/grid/locationMaps'
import { isBuildable } from '@/lib/grid/generateGrid'
import { getToken } from '@/lib/supabase/auth'

const ROOT = '/assets/environments/earth/sauerland'
const TILE_W = 86
const TILE_H = 43
const SCENE_W = 2800
const SCENE_H = 1650
const ORIGIN_X = 1390
const ORIGIN_Y = 120

type Cardinal = 'N' | 'E' | 'S' | 'W'
type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'
type Point = { row:number; col:number }

type WorldEntity = {
  id:string
  entity_id:string
  entity_type:string
  tile_row:number
  tile_col:number
  profile_id?:string|null
  owner_class?:string|null
  locations?:{ slug?:string|null; name?:string|null }|null
}

type BuildOption = {
  key:string
  name:string
  displayCost:number
  knowledgeLocked:boolean
  siteBlocked:boolean
  learningUrl?:string|null
  requiredLabel?:string|null
}

const EARTH = LOCATION_MAPS.earth
const ROWS = EARTH.length
const COLS = EARTH[0]?.length ?? 32
const CARDINAL:Cardinal[] = ['N','E','S','W']
const DELTA:Record<Cardinal,[number,number]> = {N:[-1,0],E:[0,1],S:[1,0],W:[0,-1]}
const DIR8:Direction[] = ['N','NE','E','SE','S','SW','W','NW']
const buttonStyle:React.CSSProperties = {height:32,minWidth:34,border:'1px solid #d8d0c2',borderRadius:7,background:'#fff',color:'#24415e',fontWeight:700,cursor:'pointer',padding:'0 10px'}

function iso(row:number,col:number){return{x:ORIGIN_X+(col-row)*TILE_W/2,y:ORIGIN_Y+(col+row)*TILE_H/2}}
function key(row:number,col:number){return`${row}:${col}`}
function neighbours(set:Set<string>,row:number,col:number):Cardinal[]{return CARDINAL.filter(dir=>{const[dr,dc]=DELTA[dir];return set.has(key(row+dr,col+dc))})}
function terrainBuildable(row:number,col:number){return isBuildable(terrainCodeToType(EARTH[row]?.[col]??'g'))}

function Sprite({src,frames,frame,size=104,title}:{src:string;frames:number;frame:number;size?:number;title?:string}){
 const safe=Math.max(0,Math.min(frames-1,frame))
 return <div title={title} style={{width:size,height:size,backgroundImage:`url(${src})`,backgroundRepeat:'no-repeat',backgroundSize:`${frames*100}% 100%`,backgroundPosition:`${frames===1?0:(safe/(frames-1))*100}% 0`,filter:'drop-shadow(0 7px 5px rgba(34,50,31,.23))',pointerEvents:title?'auto':'none'}}/>
}

function roadGraphic(dirs:Cardinal[]){
 const has=(d:Cardinal)=>dirs.includes(d)
 if(dirs.length>=4)return{src:`${ROOT}/transport/road_cross_01.svg`,frames:1,frame:0}
 if(dirs.length===3){const missing=CARDINAL.find(d=>!has(d))??'N';return{src:`${ROOT}/transport/road_t_01/orientations_4.svg`,frames:4,frame:CARDINAL.indexOf(missing)}}
 if(dirs.length===2){const opposite=(has('N')&&has('S'))||(has('E')&&has('W'));if(opposite)return{src:`${ROOT}/transport/road_straight_01/orientations_4.svg`,frames:4,frame:has('N')?0:1};const pair=dirs.slice().sort().join('');const curve:Record<string,number>={EN:0,ES:2,SW:4,NW:6};return{src:`${ROOT}/transport/road_curve_01/orientations_8.svg`,frames:8,frame:curve[pair]??0}}
 const dir=dirs[0]??'N';return{src:`${ROOT}/transport/road_straight_01/orientations_4.svg`,frames:4,frame:dir==='E'||dir==='W'?1:0}
}

function riverGraphic(dirs:Cardinal[]){
 const has=(d:Cardinal)=>dirs.includes(d)
 if(dirs.length>=3){const missing=CARDINAL.find(d=>!has(d))??'N';return dirs.length===3?{src:`${ROOT}/water/water_river_t_01/orientations_4.svg`,frames:4,frame:CARDINAL.indexOf(missing)}:{src:`${ROOT}/water/water_river_y_01/orientations_8.svg`,frames:8,frame:0}}
 if(dirs.length===2){const opposite=(has('N')&&has('S'))||(has('E')&&has('W'));if(opposite)return{src:`${ROOT}/water/water_river_straight_01/orientations_4.svg`,frames:4,frame:has('N')?2:3};const pair=dirs.slice().sort().join('');const curve:Record<string,number>={EN:0,ES:2,SW:4,NW:6};return{src:`${ROOT}/water/water_river_curve_01/orientations_8.svg`,frames:8,frame:curve[pair]??0}}
 return{src:`${ROOT}/water/water_river_straight_01/orientations_4.svg`,frames:4,frame:0}
}

function buildingAsset(id:string){
 const value=id.toLowerCase()
 if(value.includes('school')||value.includes('academy'))return['buildings/school_01',0]as const
 if(value.includes('admin')||value.includes('town')||value.includes('government'))return['buildings/town_hall_01',1]as const
 if(value.includes('factory')||value.includes('smelt')||value.includes('industrial'))return['buildings/factory_small_01',2]as const
 if(value.includes('spaceport')){
  if(value.includes('pad_mini'))return['hub/hub_pad_mini_01',0]as const
  if(value.includes('pad'))return['hub/hub_pad_standard_01',0]as const
  if(value.includes('storage'))return['hub/hub_storage_01',0]as const
  if(value.includes('service'))return['hub/hub_service_01',0]as const
  return['hub/hub_control_01',3]as const
 }
 if(value.includes('landing')&&value.includes('pad'))return['hub/hub_pad_standard_01',0]as const
 if(value.includes('warehouse')||value.includes('storage')||value.includes('depot'))return['buildings/warehouse_01',1]as const
 if(value.includes('farm')||value.includes('plant'))return['buildings/farm_01',2]as const
 if(value.includes('control')||value.includes('command'))return['hub/hub_control_01',3]as const
 if(value.includes('hangar'))return['hub/hub_hangar_01',3]as const
 if(value.includes('tower'))return['hub/hub_tower_01',3]as const
 if(value.includes('lab')||value.includes('research')||value.includes('scanner'))return['hub/hub_module_01',0]as const
 if(value.includes('habitat')||value.includes('residential')||value.includes('house'))return['buildings/house_01',2]as const
 return['hub/hub_module_01',0]as const
}

function terrainBackground(code:string,row:number,col:number){
 const type=terrainCodeToType(code)
 if(type==='tile_farmland')return `#b98f54 url(${ROOT}/terrain/terrain_field_01.svg) center/cover no-repeat`
 if(type==='tile_city')return `#9ba4a4 url(/images/grid/earth/tile_city.webp) center/cover no-repeat`
 if(type==='tile_concrete')return `#aab1b2 url(/images/grid/earth/tile_concrete.webp) center/cover no-repeat`
 if(type==='tile_forest_dense')return '#587a45'
 if(type==='tile_forest_edge')return '#70915a'
 if(type==='river')return '#6f955b'
 const variant=(row*17+col*29)%17===0?'terrain_grass_dark_01.svg':'terrain_grass_01.webp'
 return `#86a76d url(${ROOT}/terrain/${variant}) center/cover no-repeat`
}

export default function SauerlandIsometricPage(){
 const viewportRef=useRef<HTMLDivElement>(null)
 const dragRef=useRef<{x:number;y:number;left:number;top:number;moved:boolean}|null>(null)
 const[zoom,setZoom]=useState(.72)
 const[entities,setEntities]=useState<WorldEntity[]>([])
 const[status,setStatus]=useState('Weltdaten werden geladen …')
 const[buildMode,setBuildMode]=useState(false)
 const[selected,setSelected]=useState<Point|null>(null)
 const[buildOptions,setBuildOptions]=useState<BuildOption[]>([])
 const[building,setBuilding]=useState(false)
 const[message,setMessage]=useState('')

 const loadWorld=useCallback(async()=>{
  try{
   const world=await fetch('/api/game/world').then(r=>r.json())
   const all=Array.isArray(world.entities)?world.entities as WorldEntity[]:[]
   const earth=all.filter(e=>{const slug=e.locations?.slug?.toLowerCase()??'',name=e.locations?.name?.toLowerCase()??'';return slug==='earth'||slug==='erde'||slug.includes('sauerland')||name.includes('erde')||name.includes('sauerland')})
   setEntities(earth);setStatus(`${earth.filter(e=>e.entity_type==='building').length} Gebäude · Sauerland 2086`)
  }catch{setStatus('Weltdaten nicht erreichbar')}
 },[])
 useEffect(()=>{void loadWorld()},[loadWorld])

 const roads=useMemo(()=>entities.filter(e=>e.entity_id==='road'&&Number.isFinite(e.tile_row)&&Number.isFinite(e.tile_col)).map(e=>({row:e.tile_row,col:e.tile_col})),[entities])
 const roadSet=useMemo(()=>new Set(roads.map(p=>key(p.row,p.col))),[roads])
 const river=useMemo(()=>{const out:Point[]=[];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(EARTH[r]?.[c]==='r')out.push({row:r,col:c});return out},[])
 const riverSet=useMemo(()=>new Set(river.map(p=>key(p.row,p.col))),[river])
 const buildings=useMemo(()=>entities.filter(e=>e.entity_type==='building'&&e.entity_id!=='road'&&Number.isFinite(e.tile_row)&&Number.isFinite(e.tile_col)),[entities])
 const occupied=useMemo(()=>new Set(buildings.map(b=>key(b.tile_row,b.tile_col))),[buildings])

 const setZoomAroundCenter=useCallback((next:number)=>{const viewport=viewportRef.current;const clamped=Math.max(.34,Math.min(2.1,next));if(!viewport){setZoom(clamped);return}const old=zoom,cx=viewport.scrollLeft+viewport.clientWidth/2,cy=viewport.scrollTop+viewport.clientHeight/2;setZoom(clamped);requestAnimationFrame(()=>{const factor=clamped/old;viewport.scrollLeft=cx*factor-viewport.clientWidth/2;viewport.scrollTop=cy*factor-viewport.clientHeight/2})},[zoom])
 // React attaches wheel as passive, so preventDefault only works on a native non-passive listener.
 useEffect(()=>{const viewport=viewportRef.current;if(!viewport)return;const onWheel=(e:WheelEvent)=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();setZoomAroundCenter(zoom*(e.deltaY<0?1.12:.89))};viewport.addEventListener('wheel',onWheel,{passive:false});return()=>viewport.removeEventListener('wheel',onWheel)},[zoom,setZoomAroundCenter])
 useEffect(()=>{const viewport=viewportRef.current;if(!viewport)return;requestAnimationFrame(()=>{viewport.scrollLeft=Math.max(0,SCENE_W*zoom/2-viewport.clientWidth/2);viewport.scrollTop=20})},[])

 const chooseTile=useCallback(async(row:number,col:number)=>{
  if(!buildMode||occupied.has(key(row,col)))return
  if(!terrainBuildable(row,col))return
  setSelected({row,col});setMessage('Lade Baumöglichkeiten …');setBuildOptions([])
  try{
   const token=await getToken();const type=terrainCodeToType(EARTH[row]?.[col]??'g')
   const res=await fetch(`/api/game/build/options?location=earth&tileType=${encodeURIComponent(type)}&tileRow=${row}&tileCol=${col}`,{headers:token?{Authorization:`Bearer ${token}`}:{}})
   const data=await res.json();setBuildOptions(Array.isArray(data.buildable)?data.buildable:[]);setMessage('')
  }catch{setMessage('Baumöglichkeiten konnten nicht geladen werden.')}
 },[buildMode,occupied])

 const startBuild=useCallback(async(option:BuildOption)=>{
  if(!selected||option.knowledgeLocked||option.siteBlocked||building)return
  setBuilding(true);setMessage('Bau wird gestartet …')
  try{
   const token=await getToken();const params=new URLSearchParams({action:'start',buildableId:option.key,location:'earth',tileRow:String(selected.row),tileCol:String(selected.col),tileLevel:'0'})
   const res=await fetch(`/api/game/build?${params}`,{headers:token?{Authorization:`Bearer ${token}`}:{}});const data=await res.json()
   if(!res.ok)throw new Error(data.error||'Bau fehlgeschlagen')
   setMessage(`${option.name.replace(/^🔒 /,'')} wurde beauftragt.`);setSelected(null);setBuildOptions([]);await loadWorld()
  }catch(error){setMessage(error instanceof Error?error.message:'Bau fehlgeschlagen')}
  finally{setBuilding(false)}
 },[selected,building,loadWorld])

 const forest=[] as Array<{row:number;col:number;asset:string}>
 for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const code=EARTH[r]?.[c];if(code!=='f'&&code!=='F')continue;if(code==='f'&&(r*13+c*7)%4===0)continue;const assets=code==='F'?['tree_conifer_01.svg','tree_conifer_02.svg','tree_broadleaf_01.svg']:['tree_birch_01.svg','tree_broadleaf_02.svg','tree_conifer_01.svg'];forest.push({row:r,col:c,asset:assets[(r*5+c*11)%assets.length]})}
 const moving=[{row:19,col:24,asset:'car_01',dir:'E'as Direction,size:64},{row:19,col:29,asset:'service_01',dir:'W'as Direction,size:70},{row:17,col:27,asset:'drone_01',dir:'SE'as Direction,size:66},{row:21,col:30,asset:'ship_small_01',dir:'NE'as Direction,size:92}]

 return <main style={{position:'fixed',inset:0,zIndex:10000,background:'#e9eee3',fontFamily:'system-ui,sans-serif',display:'grid',gridTemplateRows:'58px minmax(0,1fr)'}}>
  <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,padding:'0 16px',background:'#fbfaf6',borderBottom:'1px solid #d7d0c4',zIndex:20}}>
   <div style={{display:'flex',alignItems:'baseline',gap:12}}><strong style={{color:'#23415d',fontSize:15,letterSpacing:'.04em'}}>THARSIS HUB · SAUERLAND</strong><span style={{color:'#7d7467',fontSize:11}}>{status}</span></div>
   <div style={{display:'flex',alignItems:'center',gap:6}}><button onClick={()=>setBuildMode(v=>!v)} style={{...buttonStyle,background:buildMode?'#23415d':'#fff',color:buildMode?'#fff':'#24415e',minWidth:100}}>🏗 {buildMode?'Bauen aktiv':'Bauen'}</button><button onClick={()=>setZoomAroundCenter(zoom-.12)} style={buttonStyle}>−</button><span style={{minWidth:48,textAlign:'center',font:'600 11px ui-monospace,monospace',color:'#596a72'}}>{Math.round(zoom*100)}%</span><button onClick={()=>setZoomAroundCenter(zoom+.12)} style={buttonStyle}>+</button><button onClick={()=>setZoomAroundCenter(1)} style={{...buttonStyle,minWidth:58}}>100%</button><button onClick={()=>history.back()} style={{...buttonStyle,minWidth:92}}>← Zurück</button></div>
  </header>

  <div ref={viewportRef} onMouseDown={e=>{const v=viewportRef.current;if(!v)return;dragRef.current={x:e.clientX,y:e.clientY,left:v.scrollLeft,top:v.scrollTop,moved:false};v.style.cursor='grabbing'}} onMouseMove={e=>{const v=viewportRef.current,d=dragRef.current;if(!v||!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>4)d.moved=true;v.scrollLeft=d.left-dx;v.scrollTop=d.top-dy}} onMouseUp={()=>{dragRef.current=null;if(viewportRef.current)viewportRef.current.style.cursor=buildMode?'crosshair':'grab'}} onMouseLeave={()=>{dragRef.current=null;if(viewportRef.current)viewportRef.current.style.cursor=buildMode?'crosshair':'grab'}} style={{overflow:'auto',cursor:buildMode?'crosshair':'grab',background:'linear-gradient(#cfe0e7 0 10%,#dfe8cf 28%,#cad8b1 100%)',overscrollBehavior:'contain'}}>
   <div style={{position:'relative',width:SCENE_W*zoom,height:SCENE_H*zoom}}><div style={{position:'absolute',left:0,top:0,width:SCENE_W,height:SCENE_H,transform:`scale(${zoom})`,transformOrigin:'top left'}}>
    {Array.from({length:ROWS}).flatMap((_,row)=>Array.from({length:COLS}).map((__,col)=>{const p=iso(row,col),code=EARTH[row]?.[col]??'g';return <div key={`terrain-${row}-${col}`} style={{position:'absolute',left:p.x-TILE_W/2,top:p.y-TILE_H/2,width:TILE_W+.6,height:TILE_H+.6,clipPath:'polygon(50% 0,100% 50%,50% 100%,0 50%)',background:terrainBackground(code,row,col),zIndex:row+col}}/>}))}
    {river.map((point,i)=>{const p=iso(point.row,point.col),g=riverGraphic(neighbours(riverSet,point.row,point.col));return <div key={`river-${i}`} style={{position:'absolute',left:p.x-54,top:p.y-54,zIndex:90+point.row+point.col}}><Sprite src={g.src} frames={g.frames} frame={g.frame} size={108}/></div>})}
    {roads.map((point,i)=>{const p=iso(point.row,point.col),g=roadGraphic(neighbours(roadSet,point.row,point.col));return <div key={`road-${i}`} style={{position:'absolute',left:p.x-52,top:p.y-52,zIndex:110+point.row+point.col}}><Sprite src={g.src} frames={g.frames} frame={g.frame} size={104}/></div>})}
    {forest.map((item,i)=>{const p=iso(item.row,item.col);return <img key={`forest-${i}`} src={`${ROOT}/nature/${item.asset}`} alt="" style={{position:'absolute',left:p.x-34,top:p.y-58,width:68,height:68,objectFit:'contain',zIndex:140+item.row+item.col,pointerEvents:'none'}}/>})}
    {buildings.sort((a,b)=>(a.tile_row+a.tile_col)-(b.tile_row+b.tile_col)).map(entity=>{const p=iso(entity.tile_row,entity.tile_col),[path,frame]=buildingAsset(entity.entity_id);return <div key={entity.id} style={{position:'absolute',left:p.x-58,top:p.y-98,zIndex:300+entity.tile_row+entity.tile_col}}><Sprite src={`${ROOT}/${path}/turnaround_4.svg`} frames={4} frame={frame} size={116} title={entity.entity_id.replace(/_/g,' ')}/></div>})}
    {moving.map((item,i)=>{const p=iso(item.row,item.col),frame=DIR8.indexOf(item.dir);return <div key={`vehicle-${i}`} style={{position:'absolute',left:p.x-item.size/2,top:p.y-item.size*.72,zIndex:420+item.row+item.col}}><Sprite src={`${ROOT}/vehicles/${item.asset}/turnaround_8.svg`} frames={8} frame={frame} size={item.size}/></div>})}

    {buildMode&&Array.from({length:ROWS}).flatMap((_,row)=>Array.from({length:COLS}).map((__,col)=>{const p=iso(row,col),blocked=occupied.has(key(row,col))||!terrainBuildable(row,col),active=selected?.row===row&&selected?.col===col;return <button key={`hit-${row}-${col}`} aria-label={`Baufeld ${row}, ${col}`} disabled={blocked} onClick={e=>{e.stopPropagation();if(!dragRef.current?.moved)void chooseTile(row,col)}} style={{position:'absolute',left:p.x-TILE_W/2,top:p.y-TILE_H/2,width:TILE_W,height:TILE_H,clipPath:'polygon(50% 0,100% 50%,50% 100%,0 50%)',background:active?'rgba(236,191,76,.48)':'rgba(255,255,255,.01)',border:0,outline:active?'2px solid #d3a72e':'none',cursor:blocked?'not-allowed':'crosshair',zIndex:700+row+col}}/>}))}
   </div></div>
  </div>

  {buildMode&&<aside style={{position:'fixed',right:18,top:76,width:340,maxHeight:'calc(100vh - 96px)',overflow:'auto',zIndex:12000,background:'rgba(251,250,246,.97)',border:'1px solid #d7d0c4',borderRadius:12,boxShadow:'0 12px 34px rgba(40,55,46,.22)',padding:14}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><strong style={{color:'#23415d'}}>Planen & Bauen</strong><button onClick={()=>{setBuildMode(false);setSelected(null);setBuildOptions([])}} style={{...buttonStyle,minWidth:32}}>×</button></div>
   {!selected&&<p style={{fontSize:12,color:'#6e746d',lineHeight:1.5}}>Klicke direkt in der isometrischen Landschaft auf einen freien, bebaubaren Bauplatz (Wald und Fluss sind ausgenommen). Das logische 32×24-Raster bleibt nur intern für Regeln und Speicherung bestehen; es wird nicht mehr als Planungsraster angezeigt.</p>}
   {selected&&<div style={{fontSize:11,color:'#7d7467',marginBottom:10}}>Position {selected.row}/{selected.col} · {terrainCodeToType(EARTH[selected.row]?.[selected.col]??'g')}</div>}
   {message&&<div style={{padding:'8px 10px',background:'#f0eee7',borderRadius:7,fontSize:11,color:'#59646a',marginBottom:10}}>{message}</div>}
   {buildOptions.map(option=>{const locked=option.knowledgeLocked||option.siteBlocked;return <div key={option.key} style={{padding:'10px 0',borderTop:'1px solid #e1ddd4'}}><div style={{fontSize:12,fontWeight:700,color:locked?'#8a8175':'#2c465c'}}>{option.name}</div><div style={{fontSize:11,color:'#7d7467',margin:'3px 0 7px'}}>{option.displayCost.toLocaleString('de-DE')} Cr</div>{option.knowledgeLocked&&option.learningUrl?<a href={option.learningUrl} style={{fontSize:11,color:'#2a5d8c'}}>Wissen lernen →</a>:<button disabled={locked||building} onClick={()=>void startBuild(option)} style={{...buttonStyle,height:28,fontSize:11,opacity:locked?.45:1}}>Bauen</button>}</div>})}
  </aside>}
 </main>
}
