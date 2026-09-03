'use client'

import React,{useCallback,useEffect,useMemo,useRef,useState}from'react'
import{LOCATION_MAPS,terrainCodeToType}from'@/lib/grid/locationMaps'
import{isBuildable}from'@/lib/grid/generateGrid'
import{getToken}from'@/lib/supabase/auth'

const TW=96,TH=48,SW=3000,SH=1750,OX=1500,OY=95
const EARTH=LOCATION_MAPS.earth,ROWS=EARTH.length,COLS=EARTH[0]?.length??32
const GRID='/images/grid/earth',BUILDINGS='/assets/buildings',VEHICLES='/assets/vehicles'
type Point={row:number;col:number}
type Entity={id:string;entity_id:string;entity_type:string;tile_row:number;tile_col:number;locations?:{slug?:string|null;name?:string|null}|null}
type BuildOption={key:string;name:string;displayCost:number;knowledgeLocked:boolean;siteBlocked:boolean;learningUrl?:string|null}
const btn:React.CSSProperties={height:32,minWidth:34,border:'1px solid #d8d0c2',borderRadius:7,background:'#fff',color:'#24415e',fontWeight:700,cursor:'pointer',padding:'0 10px'}
const iso=(r:number,c:number)=>({x:OX+(c-r)*TW/2,y:OY+(c+r)*TH/2}),key=(r:number,c:number)=>`${r}:${c}`
const buildable=(r:number,c:number)=>isBuildable(terrainCodeToType(EARTH[r]?.[c]??'g'))

function terrainRaster(code:string,r:number,c:number){
 const type=terrainCodeToType(code)
 if(type==='tile_farmland')return`${GRID}/tile_farmland.webp`
 if(type==='tile_city')return`${GRID}/tile_city.webp`
 if(type==='tile_concrete')return`${GRID}/tile_concrete.webp`
 if(type==='tile_forest_dense')return`${GRID}/tile_forest_dense.webp`
 if(type==='tile_forest_edge')return`${GRID}/tile_forest_edge.webp`
 if(type==='river')return`${GRID}/tile_grass.webp`
 if((r*17+c*29)%19===0)return`${GRID}/tile_grass_rocky.webp`
 return(r+c)%5===0?`${GRID}/tile_grass_2.webp`:`${GRID}/tile_grass.webp`
}
function roadMask(set:Set<string>,r:number,c:number){let m=0;if(set.has(key(r-1,c)))m|=1;if(set.has(key(r,c+1)))m|=2;if(set.has(key(r+1,c)))m|=4;if(set.has(key(r,c-1)))m|=8;return m}
function riverStyle(set:Set<string>,r:number,c:number):React.CSSProperties{
 const n=set.has(key(r-1,c)),e=set.has(key(r,c+1)),s=set.has(key(r+1,c)),w=set.has(key(r,c-1))
 const count=[n,e,s,w].filter(Boolean).length
 if(count>=3)return{background:'radial-gradient(ellipse at center,#4a9bc0 0 26%,#76bdd5 27% 35%,transparent 36%)'}
 if((n&&s)||(e&&w))return{background:`linear-gradient(${n&&s?'135deg':'45deg'},transparent 0 38%,#76bdd5 39% 43%,#4a9bc0 44% 57%,#76bdd5 58% 62%,transparent 63%)`}
 return{background:'radial-gradient(ellipse at center,#4a9bc0 0 23%,#76bdd5 24% 31%,transparent 32%)'}
}
function buildingRaster(id:string){const v=id.toLowerCase()
 if(v.includes('school')||v.includes('academy'))return`${BUILDINGS}/school/earth/exterior-isometric.webp`
 if(v.includes('admin')||v.includes('town')||v.includes('government'))return`${BUILDINGS}/admin/earth/exterior-isometric.webp`
 if(v.includes('warehouse')||v.includes('storage')||v.includes('depot'))return`${BUILDINGS}/warehouse/earth/exterior-isometric.webp`
 if(v.includes('spaceport')||v.includes('landing')){
  if(v.includes('mini'))return`${BUILDINGS}/spaceport_pad_mini/earth/exterior-isometric.webp`
  if(v.includes('cargo'))return`${BUILDINGS}/spaceport_pad_cargo/earth/exterior-isometric.webp`
  if(v.includes('passenger'))return`${BUILDINGS}/spaceport_pad_passenger/earth/exterior-isometric.webp`
  if(v.includes('heavy'))return`${BUILDINGS}/spaceport_pad_heavy/earth/exterior-isometric.webp`
  if(v.includes('service'))return`${BUILDINGS}/spaceport_service/earth/exterior-isometric.webp`
  if(v.includes('storage'))return`${BUILDINGS}/spaceport_storage/earth/exterior-isometric.webp`
  if(v.includes('pad'))return`${BUILDINGS}/spaceport_pad_standard/earth/exterior-isometric.webp`
  return`${BUILDINGS}/spaceport_core/earth/exterior-isometric.webp`
 }
 return`${BUILDINGS}/warehouse_storage/earth/exterior-isometric.webp`
}

export default function Page(){
 const view=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;l:number;t:number;m:boolean}|null>(null)
 const[zoom,setZoom]=useState(.72),[entities,setEntities]=useState<Entity[]>([]),[status,setStatus]=useState('Weltdaten werden geladen …'),[buildMode,setBuildMode]=useState(false),[selected,setSelected]=useState<Point|null>(null),[options,setOptions]=useState<BuildOption[]>([]),[building,setBuilding]=useState(false),[message,setMessage]=useState('')
 const load=useCallback(async()=>{try{const res=await fetch('/api/game/world');if(!res.ok)throw new Error();const w=await res.json(),all=Array.isArray(w.entities)?w.entities as Entity[]:[],earth=all.filter(e=>{const s=e.locations?.slug?.toLowerCase()??'',n=e.locations?.name?.toLowerCase()??'';return s==='earth'||s==='erde'||s.includes('sauerland')||n.includes('erde')||n.includes('sauerland')});setEntities(earth);setStatus(`${earth.filter(e=>e.entity_type==='building').length} Gebäude · Sauerland 2086`)}catch{setStatus('Weltdaten nicht erreichbar')}},[])
 useEffect(()=>{void load()},[load])
 const roads=useMemo(()=>entities.filter(e=>(e.entity_type==='road'||e.entity_id==='road')&&Number.isFinite(e.tile_row)&&Number.isFinite(e.tile_col)).map(e=>({row:e.tile_row,col:e.tile_col})),[entities])
 const roadSet=useMemo(()=>new Set(roads.map(p=>key(p.row,p.col))),[roads])
 const river=useMemo(()=>{const a:Point[]=[];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(EARTH[r]?.[c]==='r')a.push({row:r,col:c});return a},[])
 const riverSet=useMemo(()=>new Set(river.map(p=>key(p.row,p.col))),[river])
 const buildings=useMemo(()=>entities.filter(e=>e.entity_type==='building'&&Number.isFinite(e.tile_row)&&Number.isFinite(e.tile_col)),[entities])
 const occupied=useMemo(()=>new Set(buildings.map(e=>key(e.tile_row,e.tile_col))),[buildings])
 const setZ=useCallback((n:number)=>{const v=view.current,z=Math.max(.34,Math.min(2.1,n));if(!v){setZoom(z);return}const old=zoom,cx=v.scrollLeft+v.clientWidth/2,cy=v.scrollTop+v.clientHeight/2;setZoom(z);requestAnimationFrame(()=>{v.scrollLeft=cx*z/old-v.clientWidth/2;v.scrollTop=cy*z/old-v.clientHeight/2})},[zoom])
 useEffect(()=>{const v=view.current;if(!v)return;const wh=(e:WheelEvent)=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();setZ(zoom*(e.deltaY<0?1.12:.89))};v.addEventListener('wheel',wh,{passive:false});return()=>v.removeEventListener('wheel',wh)},[zoom,setZ])
 useEffect(()=>{const v=view.current;if(v)requestAnimationFrame(()=>{v.scrollLeft=Math.max(0,SW*zoom/2-v.clientWidth/2);v.scrollTop=20})},[])
 const choose=useCallback(async(r:number,c:number)=>{if(!buildMode||occupied.has(key(r,c))||!buildable(r,c))return;setSelected({row:r,col:c});setOptions([]);setMessage('Lade Baumöglichkeiten …');try{const token=await getToken(),type=terrainCodeToType(EARTH[r]?.[c]??'g'),res=await fetch(`/api/game/build/options?location=earth&tileType=${encodeURIComponent(type)}&tileRow=${r}&tileCol=${c}`,{headers:token?{Authorization:`Bearer ${token}`}:{}}),d=await res.json();setOptions(Array.isArray(d.buildable)?d.buildable:[]);setMessage('')}catch{setMessage('Baumöglichkeiten konnten nicht geladen werden.')}},[buildMode,occupied])
 const start=useCallback(async(o:BuildOption)=>{if(!selected||o.knowledgeLocked||o.siteBlocked||building)return;setBuilding(true);try{const token=await getToken(),p=new URLSearchParams({action:'start',buildableId:o.key,location:'earth',tileRow:String(selected.row),tileCol:String(selected.col),tileLevel:'0'}),res=await fetch(`/api/game/build?${p}`,{headers:token?{Authorization:`Bearer ${token}`}:{}}),d=await res.json();if(!res.ok)throw new Error(d.error||'Bau fehlgeschlagen');setMessage(`${o.name.replace(/^🔒 /,'')} wurde beauftragt.`);setSelected(null);setOptions([]);await load()}catch(e){setMessage(e instanceof Error?e.message:'Bau fehlgeschlagen')}finally{setBuilding(false)}},[selected,building,load])
 const movers=[{row:19,col:24,src:`${VEHICLES}/car_small/earth/isometric.webp`,s:62},{row:19,col:29,src:`${VEHICLES}/service_van/earth/isometric.webp`,s:70},{row:21,col:29,src:`${VEHICLES}/ship_shuttle/earth/isometric.webp`,s:96}]
 return <main style={{position:'fixed',inset:0,zIndex:10000,background:'#e9eee3',fontFamily:'system-ui',display:'grid',gridTemplateRows:'58px 1fr'}}>
  <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',background:'#fbfaf6',borderBottom:'1px solid #d7d0c4',zIndex:20}}><div><strong style={{color:'#23415d'}}>THARSIS HUB · SAUERLAND</strong><span style={{marginLeft:12,color:'#7d7467',fontSize:11}}>{status}</span></div><div style={{display:'flex',gap:6,alignItems:'center'}}><button onClick={()=>setBuildMode(v=>!v)} style={{...btn,background:buildMode?'#23415d':'#fff',color:buildMode?'#fff':'#24415e'}}>🏗 Bauen</button><button onClick={()=>setZ(zoom-.12)} style={btn}>−</button><small>{Math.round(zoom*100)}%</small><button onClick={()=>setZ(zoom+.12)} style={btn}>+</button><button onClick={()=>setZ(1)} style={btn}>100%</button><button onClick={()=>history.back()} style={btn}>← Zurück</button></div></header>
  <div ref={view} onMouseDown={e=>{const v=view.current;if(v){drag.current={x:e.clientX,y:e.clientY,l:v.scrollLeft,t:v.scrollTop,m:false};v.style.cursor='grabbing'}}} onMouseMove={e=>{const v=view.current,d=drag.current;if(v&&d){const x=e.clientX-d.x,y=e.clientY-d.y;if(Math.abs(x)+Math.abs(y)>4)d.m=true;v.scrollLeft=d.l-x;v.scrollTop=d.t-y}}} onMouseUp={()=>{drag.current=null;if(view.current)view.current.style.cursor=buildMode?'crosshair':'grab'}} style={{overflow:'auto',cursor:buildMode?'crosshair':'grab',background:'linear-gradient(#c9dce4 0 10%,#dce7cd 30%,#c7d6af)',overscrollBehavior:'contain'}}>
   <div style={{position:'relative',width:SW*zoom,height:SH*zoom}}><div style={{position:'absolute',width:SW,height:SH,transform:`scale(${zoom})`,transformOrigin:'top left'}}>
    {Array.from({length:ROWS}).flatMap((_,r)=>Array.from({length:COLS}).map((__,c)=>{const p=iso(r,c),src=terrainRaster(EARTH[r]?.[c]??'g',r,c);return <div key={`t${r}-${c}`} style={{position:'absolute',left:p.x-TW/2,top:p.y-TH/2,width:TW+1,height:TH+1,clipPath:'polygon(50% 0,100% 50%,50% 100%,0 50%)',backgroundImage:`url(${src})`,backgroundSize:'cover',backgroundPosition:'center',zIndex:r+c,filter:'saturate(.9) contrast(1.03)'}}/>}))}
    {river.map((q,i)=>{const p=iso(q.row,q.col);return <div key={`w${i}`} style={{position:'absolute',left:p.x-TW/2,top:p.y-TH/2,width:TW,height:TH,clipPath:'polygon(50% 0,100% 50%,50% 100%,0 50%)',zIndex:80+q.row+q.col,...riverStyle(riverSet,q.row,q.col)}}/>})}
    {roads.map((q,i)=>{const p=iso(q.row,q.col),mask=roadMask(roadSet,q.row,q.col);return <div key={`r${i}`} style={{position:'absolute',left:p.x-TW/2,top:p.y-TH/2,width:TW,height:TH,clipPath:'polygon(50% 0,100% 50%,50% 100%,0 50%)',backgroundImage:`url(${GRID}/road_${mask}.webp)`,backgroundSize:'cover',backgroundPosition:'center',zIndex:100+q.row+q.col}}/>})}
    {buildings.slice().sort((a,b)=>a.tile_row+a.tile_col-b.tile_row-b.tile_col).map(e=>{const p=iso(e.tile_row,e.tile_col);return <img key={e.id} src={buildingRaster(e.entity_id)} title={e.entity_id.replace(/_/g,' ')} alt="" style={{position:'absolute',left:p.x-62,top:p.y-104,width:124,height:124,objectFit:'contain',zIndex:300+e.tile_row+e.tile_col,filter:'drop-shadow(0 8px 6px #25332655)'}}/>})}
    {movers.map((o,i)=>{const p=iso(o.row,o.col);return <img key={`m${i}`} src={o.src} alt="" style={{position:'absolute',left:p.x-o.s/2,top:p.y-o.s*.72,width:o.s,height:o.s,objectFit:'contain',zIndex:420+o.row+o.col,filter:'drop-shadow(0 5px 4px #25332644)'}}/>})}
    {buildMode&&Array.from({length:ROWS}).flatMap((_,r)=>Array.from({length:COLS}).map((__,c)=>{const p=iso(r,c),blocked=occupied.has(key(r,c))||!buildable(r,c),active=selected?.row===r&&selected?.col===c;return <button key={`h${r}-${c}`} disabled={blocked} onClick={e=>{e.stopPropagation();if(!drag.current?.m)void choose(r,c)}} style={{position:'absolute',left:p.x-TW/2,top:p.y-TH/2,width:TW,height:TH,clipPath:'polygon(50% 0,100% 50%,50% 100%,0 50%)',background:active?'#ecbf4c77':'#fff0',border:0,cursor:blocked?'not-allowed':'crosshair',zIndex:700+r+c}}/>}))}
   </div></div>
  </div>
  {buildMode&&<aside style={{position:'fixed',right:18,top:76,width:330,maxHeight:'calc(100vh - 96px)',overflow:'auto',zIndex:12000,background:'#fbfaf6f8',border:'1px solid #d7d0c4',borderRadius:12,padding:14,boxShadow:'0 12px 34px #28372e38'}}><div style={{display:'flex',justifyContent:'space-between'}}><strong>Planen & Bauen</strong><button onClick={()=>{setBuildMode(false);setSelected(null);setOptions([])}} style={btn}>×</button></div>{!selected&&<p style={{fontSize:12,color:'#6e746d'}}>Freien Platz direkt in der Landschaft wählen. Das logische Raster bleibt unsichtbar.</p>}{selected&&<small>Position {selected.row}/{selected.col}</small>}{message&&<p style={{fontSize:11}}>{message}</p>}{options.map(o=><div key={o.key} style={{padding:'10px 0',borderTop:'1px solid #ddd'}}><b style={{fontSize:12}}>{o.name}</b><div style={{fontSize:11,color:'#777'}}>{o.displayCost.toLocaleString('de-DE')} Cr</div>{o.knowledgeLocked&&o.learningUrl?<a href={o.learningUrl}>Wissen lernen →</a>:<button disabled={o.knowledgeLocked||o.siteBlocked||building} onClick={()=>void start(o)} style={{...btn,height:28}}>Bauen</button>}</div>)}</aside>}
 </main>
}
