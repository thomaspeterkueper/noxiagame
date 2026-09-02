'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const ROOT = '/assets/environments/earth/sauerland'
const COLS = 32
const ROWS = 24
const TILE_W = 86
const TILE_H = 43
const SCENE_W = 2800
const SCENE_H = 1650
const ORIGIN_X = 1390
const ORIGIN_Y = 120

interface WorldEntity {
  id: string
  entity_id: string
  entity_type: string
  tile_row: number
  tile_col: number
  profile_id?: string | null
  owner_class?: string | null
  locations?: { slug?: string | null; name?: string | null } | null
}

type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'
type Cardinal = 'N' | 'E' | 'S' | 'W'
type Point = { row: number; col: number }

function iso(row: number, col: number) {
  return { x: ORIGIN_X + (col - row) * TILE_W / 2, y: ORIGIN_Y + (col + row) * TILE_H / 2 }
}
function key(row: number, col: number) { return `${row}:${col}` }

function Sprite({ src, frames, frame, size = 104, z = 100, title }: { src: string; frames: number; frame: number; size?: number; z?: number; title?: string }) {
  const safe = Math.max(0, Math.min(frames - 1, frame))
  return <div title={title} style={{ width:size, height:size, backgroundImage:`url(${src})`, backgroundRepeat:'no-repeat', backgroundSize:`${frames * 100}% 100%`, backgroundPosition:`${frames === 1 ? 0 : (safe / (frames - 1)) * 100}% 0`, filter:'drop-shadow(0 7px 5px rgba(34,50,31,.23))', zIndex:z, pointerEvents:title?'auto':'none' }} />
}

const DIR8: Direction[] = ['N','NE','E','SE','S','SW','W','NW']
const CARDINAL: Cardinal[] = ['N','E','S','W']
const DELTA: Record<Cardinal, [number, number]> = { N:[-1,0], E:[0,1], S:[1,0], W:[0,-1] }

function neighbours(set: Set<string>, row: number, col: number): Cardinal[] {
  return CARDINAL.filter(dir => { const [dr,dc]=DELTA[dir]; return set.has(key(row+dr,col+dc)) })
}

function roadGraphic(dirs: Cardinal[]) {
  const has=(d:Cardinal)=>dirs.includes(d)
  if(dirs.length>=4)return{src:`${ROOT}/transport/road_cross_01.svg`,frames:1,frame:0}
  if(dirs.length===3){const missing=CARDINAL.find(d=>!has(d))??'N';return{src:`${ROOT}/transport/road_t_01/orientations_4.svg`,frames:4,frame:CARDINAL.indexOf(missing)}}
  if(dirs.length===2){const opposite=(has('N')&&has('S'))||(has('E')&&has('W'));if(opposite)return{src:`${ROOT}/transport/road_straight_01/orientations_4.svg`,frames:4,frame:has('N')?0:1};const pair=dirs.slice().sort().join('');const curveFrame:Record<string,number>={EN:0,ES:2,SW:4,NW:6};return{src:`${ROOT}/transport/road_curve_01/orientations_8.svg`,frames:8,frame:curveFrame[pair]??0}}
  const dir=dirs[0]??'N';return{src:`${ROOT}/transport/road_straight_01/orientations_4.svg`,frames:4,frame:dir==='E'||dir==='W'?1:0}
}

function riverGraphic(dirs: Cardinal[]) {
  const has=(d:Cardinal)=>dirs.includes(d)
  if(dirs.length>=3){if(dirs.length===3){const missing=CARDINAL.find(d=>!has(d))??'N';return{src:`${ROOT}/water/water_river_t_01/orientations_4.svg`,frames:4,frame:CARDINAL.indexOf(missing)}}return{src:`${ROOT}/water/water_river_y_01/orientations_8.svg`,frames:8,frame:0}}
  if(dirs.length===2){const opposite=(has('N')&&has('S'))||(has('E')&&has('W'));if(opposite)return{src:`${ROOT}/water/water_river_straight_01/orientations_4.svg`,frames:4,frame:has('N')?0:1};const pair=dirs.slice().sort().join('');const curveFrame:Record<string,number>={EN:0,ES:2,SW:4,NW:6};return{src:`${ROOT}/water/water_river_curve_01/orientations_8.svg`,frames:8,frame:curveFrame[pair]??0}}
  return{src:`${ROOT}/water/water_river_straight_01/orientations_4.svg`,frames:4,frame:0}
}

function buildingAsset(id:string){const value=id.toLowerCase();if(value.includes('school')||value.includes('academy'))return['buildings/school_01',0]as const;if(value.includes('admin')||value.includes('town')||value.includes('government'))return['buildings/town_hall_01',1]as const;if(value.includes('factory')||value.includes('smelt')||value.includes('industrial'))return['buildings/factory_small_01',2]as const;if(value.includes('warehouse')||value.includes('storage')||value.includes('depot'))return['buildings/warehouse_01',1]as const;if(value.includes('farm')||value.includes('plant'))return['buildings/farm_01',2]as const;if(value.includes('fire'))return['buildings/fire_station_01',1]as const;if(value.includes('spaceport')||value.includes('control')||value.includes('command'))return['hub/hub_control_01',3]as const;if(value.includes('hangar'))return['hub/hub_hangar_01',3]as const;if(value.includes('tower'))return['hub/hub_tower_01',3]as const;if(value.includes('lab')||value.includes('research')||value.includes('scanner'))return['hub/hub_module_01',0]as const;if(value.includes('habitat')||value.includes('residential')||value.includes('house'))return['buildings/house_01',2]as const;return['hub/hub_module_01',0]as const}

function makeRiver():Point[]{const pts:Point[]=[];for(let r=0;r<ROWS;r++){const c=Math.round(14+Math.sin(r/3.4)*2);pts.push({row:r,col:c})}pts.push({row:10,col:17},{row:10,col:18},{row:9,col:18},{row:8,col:18});return pts}
function makeRoadFallback():Point[]{const pts:Point[]=[];for(let c=21;c<=31;c++)pts.push({row:19,col:c});for(let r=15;r<=23;r++)pts.push({row:r,col:26});for(let c=24;c<=29;c++)pts.push({row:22,col:c});for(let r=6;r<=12;r++)pts.push({row:r,col:28});return pts}

export default function SauerlandIsometricPage(){
 const viewportRef=useRef<HTMLDivElement>(null),dragRef=useRef<{x:number;y:number;left:number;top:number}|null>(null)
 const[zoom,setZoom]=useState(.78),[entities,setEntities]=useState<WorldEntity[]>([]),[status,setStatus]=useState('Weltdaten werden geladen …')
 useEffect(()=>{let alive=true;fetch('/api/game/world').then(r=>r.json()).then(world=>{if(!alive)return;const all=Array.isArray(world.entities)?world.entities as WorldEntity[]:[];const earth=all.filter(e=>{const slug=e.locations?.slug?.toLowerCase()??'',name=e.locations?.name?.toLowerCase()??'';return slug==='earth'||slug==='erde'||slug.includes('sauerland')||name.includes('erde')||name.includes('sauerland')});setEntities(earth);setStatus(`${earth.filter(e=>e.entity_type==='building').length} Gebäude · Sauerland 2086`)}).catch(()=>setStatus('Weltdaten nicht erreichbar · Landschaftsmodell aktiv'));return()=>{alive=false}},[])
 const roads=useMemo(()=>{const fromWorld=entities.filter(e=>e.entity_id==='road'&&Number.isFinite(e.tile_row)&&Number.isFinite(e.tile_col)).map(e=>({row:e.tile_row,col:e.tile_col}));const source=fromWorld.length>=4?fromWorld:makeRoadFallback(),seen=new Map<string,Point>();source.forEach(p=>seen.set(key(p.row,p.col),p));return[...seen.values()]},[entities])
 const roadSet=useMemo(()=>new Set(roads.map(p=>key(p.row,p.col))),[roads]),river=useMemo(()=>makeRiver(),[]),riverSet=useMemo(()=>new Set(river.map(p=>key(p.row,p.col))),[river]),buildings=useMemo(()=>entities.filter(e=>e.entity_type==='building'&&e.entity_id!=='road'&&Number.isFinite(e.tile_row)&&Number.isFinite(e.tile_col)),[entities])
 const setZoomAroundCenter=useCallback((next:number)=>{const viewport=viewportRef.current;if(!viewport){setZoom(next);return}const clamped=Math.max(.32,Math.min(2.1,next)),old=zoom,cx=viewport.scrollLeft+viewport.clientWidth/2,cy=viewport.scrollTop+viewport.clientHeight/2;setZoom(clamped);requestAnimationFrame(()=>{const factor=clamped/old;viewport.scrollLeft=cx*factor-viewport.clientWidth/2;viewport.scrollTop=cy*factor-viewport.clientHeight/2})},[zoom])
 useEffect(()=>{const viewport=viewportRef.current;if(!viewport)return;requestAnimationFrame(()=>{viewport.scrollLeft=Math.max(0,SCENE_W*zoom/2-viewport.clientWidth/2);viewport.scrollTop=40})},[])
 const decorative=[{row:7,col:28,path:'buildings/house_fachwerk_01',frame:2,label:'Siedlungsrand'},{row:8,col:29,path:'buildings/house_02',frame:1,label:'Siedlungsrand'},{row:9,col:27,path:'buildings/barn_01',frame:3,label:'Landwirtschaft'},{row:11,col:6,path:'buildings/farm_01',frame:2,label:'Hof'}]
 const nature=[[2,3,'tree_conifer_01.svg'],[3,4,'tree_conifer_02.svg'],[4,3,'tree_conifer_01.svg'],[5,5,'tree_birch_01.svg'],[2,7,'tree_broadleaf_01.svg'],[3,8,'tree_conifer_02.svg'],[6,2,'tree_conifer_01.svg'],[18,5,'tree_broadleaf_02.svg'],[20,7,'tree_conifer_01.svg'],[21,8,'tree_birch_01.svg'],[5,23,'rock_02.svg'],[17,3,'rock_04.svg'],[12,24,'bush_02.svg']]as const
 const moving=[{row:19,col:24,asset:'car_01',dir:'E'as Direction,size:64},{row:19,col:29,asset:'service_01',dir:'W'as Direction,size:70},{row:17,col:27,asset:'drone_01',dir:'SE'as Direction,size:66},{row:21,col:30,asset:'ship_small_01',dir:'NE'as Direction,size:92}]
 return <main style={{position:'fixed',inset:0,zIndex:10000,background:'#e9eee3',fontFamily:'system-ui, sans-serif',display:'grid',gridTemplateRows:'58px minmax(0,1fr)'}}>
  <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,padding:'0 16px',background:'#fbfaf6',borderBottom:'1px solid #d7d0c4',boxShadow:'0 2px 8px rgba(38,52,44,.08)',zIndex:20}}><div style={{display:'flex',alignItems:'baseline',gap:12}}><strong style={{color:'#23415d',fontSize:15,letterSpacing:'.04em'}}>THARSIS HUB · SAUERLAND</strong><span style={{color:'#7d7467',fontSize:11}}>{status}</span></div><div style={{display:'flex',alignItems:'center',gap:6}}><button onClick={()=>setZoomAroundCenter(zoom-.12)} style={buttonStyle}>−</button><span style={{minWidth:48,textAlign:'center',font:'600 11px ui-monospace, monospace',color:'#596a72'}}>{Math.round(zoom*100)}%</span><button onClick={()=>setZoomAroundCenter(zoom+.12)} style={buttonStyle}>+</button><button onClick={()=>setZoomAroundCenter(1)} style={{...buttonStyle,minWidth:58}}>100%</button><button onClick={()=>history.back()} style={{...buttonStyle,marginLeft:8,minWidth:92}}>← Zurück</button></div></header>
  <div ref={viewportRef} onWheel={e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();setZoomAroundCenter(zoom*(e.deltaY<0?1.12:.89))}} onMouseDown={e=>{const v=viewportRef.current;if(!v)return;dragRef.current={x:e.clientX,y:e.clientY,left:v.scrollLeft,top:v.scrollTop};v.style.cursor='grabbing'}} onMouseMove={e=>{const v=viewportRef.current,d=dragRef.current;if(!v||!d)return;v.scrollLeft=d.left-(e.clientX-d.x);v.scrollTop=d.top-(e.clientY-d.y)}} onMouseUp={()=>{dragRef.current=null;if(viewportRef.current)viewportRef.current.style.cursor='grab'}} onMouseLeave={()=>{dragRef.current=null;if(viewportRef.current)viewportRef.current.style.cursor='grab'}} style={{overflow:'auto',cursor:'grab',background:'linear-gradient(#cfe0e7 0 10%,#dfe8cf 28%,#cad8b1 100%)',overscrollBehavior:'contain'}}>
   <div style={{position:'relative',width:SCENE_W*zoom,height:SCENE_H*zoom}}><div style={{position:'absolute',left:0,top:0,width:SCENE_W,height:SCENE_H,transform:`scale(${zoom})`,transformOrigin:'top left'}}>
    {Array.from({length:ROWS}).flatMap((_,row)=>Array.from({length:COLS}).map((__,col)=>{const p=iso(row,col),inForest=col<10&&row<17,inField=col<18&&row>5&&row<21&&((row+col)%5<3),rocky=(row*31+col*17)%29===0,terrain=rocky?'terrain_rocky_01.svg':inForest?'terrain_grass_dark_01.svg':inField?'terrain_field_01.svg':'terrain_grass_01.webp';return <div key={`t-${row}-${col}`} style={{position:'absolute',left:p.x-TILE_W/2,top:p.y-TILE_H/2,width:TILE_W,height:TILE_H,clipPath:'polygon(50% 0,100% 50%,50% 100%,0 50%)',background:`#88a66f url(${ROOT}/terrain/${terrain}) center/cover no-repeat`,boxShadow:'inset 0 0 0 1px rgba(70,91,56,.10)',zIndex:row+col}}/>}))}
    {river.map((point,i)=>{const p=iso(point.row,point.col),g=riverGraphic(neighbours(riverSet,point.row,point.col));return <div key={`river-${i}`} style={{position:'absolute',left:p.x-54,top:p.y-54,zIndex:90+point.row+point.col}}><Sprite src={g.src} frames={g.frames} frame={g.frame} size={108}/></div>})}
    {river.filter((_,i)=>i%3===0).map((point,i)=>{const p=iso(point.row,point.col+1),frame=(point.row*3)%8;return <div key={`shore-${i}`} style={{position:'absolute',left:p.x-48,top:p.y-48,zIndex:85+point.row+point.col}}><Sprite src={`${ROOT}/water/water_shore_grass_01/edges_8.svg`} frames={8} frame={frame} size={96}/></div>})}
    {roads.map((point,i)=>{const p=iso(point.row,point.col),g=roadGraphic(neighbours(roadSet,point.row,point.col));return <div key={`road-${i}`} style={{position:'absolute',left:p.x-52,top:p.y-52,zIndex:110+point.row+point.col}}><Sprite src={g.src} frames={g.frames} frame={g.frame} size={104}/></div>})}
    {nature.map(([row,col,asset],i)=>{const p=iso(row,col);return <img key={`n-${i}`} src={`${ROOT}/nature/${asset}`} alt="" draggable={false} style={{position:'absolute',left:p.x-44,top:p.y-77,width:88,height:88,objectFit:'contain',zIndex:160+row+col,filter:'drop-shadow(0 8px 5px rgba(40,58,34,.2))',pointerEvents:'none'}}/>})}
    {decorative.map((b,i)=>{const p=iso(b.row,b.col);return <div key={`d-${i}`} style={{position:'absolute',left:p.x-62,top:p.y-108,zIndex:250+b.row+b.col}}><Sprite src={`${ROOT}/${b.path}/turnaround_4.svg`} frames={4} frame={b.frame} size={124} title={b.label}/></div>})}
    {[...buildings].sort((a,b)=>(a.tile_row+a.tile_col)-(b.tile_row+b.tile_col)).map((b,i)=>{const p=iso(b.tile_row+.2,b.tile_col+.2),[asset,frame]=buildingAsset(b.entity_id);return <div key={b.id||`b-${i}`} style={{position:'absolute',left:p.x-70,top:p.y-124,zIndex:320+b.tile_row+b.tile_col}}><Sprite src={`${ROOT}/${asset}/turnaround_4.svg`} frames={4} frame={frame} size={140} title={b.entity_id.replace(/_/g,' ')}/></div>})}
    {moving.map((v,i)=>{const p=iso(v.row,v.col);return <div key={`v-${i}`} style={{position:'absolute',left:p.x-v.size/2,top:p.y-v.size*.72,zIndex:500+v.row+v.col}}><Sprite src={`${ROOT}/vehicles/${v.asset}/turnaround_8.svg`} frames={8} frame={DIR8.indexOf(v.dir)} size={v.size} title={`${v.asset.replace(/_/g,' ')} · ${v.dir}`}/></div>})}
    <div style={{position:'absolute',left:34,top:28,zIndex:1000,padding:'9px 11px',borderRadius:8,background:'rgba(251,250,246,.90)',border:'1px solid #d6cec0',color:'#445867',fontSize:11,lineHeight:1.5,boxShadow:'0 4px 16px rgba(0,0,0,.08)'}}><b>Sauerland 2086</b><br/>Terrain · Wasser · Straßen · Gebäude · Vegetation · Fahrzeuge<br/><span style={{color:'#8d7849'}}>Strg + Mausrad: Zoom · Ziehen: Karte bewegen</span></div>
   </div></div>
  </div>
 </main>
}

const buttonStyle:React.CSSProperties={minWidth:34,height:32,border:'1px solid #d8d0c2',borderRadius:7,background:'#fff',color:'#24415e',fontWeight:700,cursor:'pointer',padding:'0 9px'}
