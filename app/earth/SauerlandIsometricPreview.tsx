'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { distanceMeters } from '@/lib/world/spatial/earthScale'

type GeoPoint={lat:number;lon:number}
type Feature={id:string;featureType:string;properties:Record<string,string>;geometry:{kind:'point';coordinates:GeoPoint}|{kind:'line'|'polygon';coordinates:GeoPoint[]}}
type Payload={ok:boolean;region?:{name:string;origin:GeoPoint};bounds?:{south:number;west:number;north:number;east:number};features?:Feature[];error?:string}

const TILE='https://raw.githubusercontent.com/thomaspeterkueper/noxiagame/graphics/earth-raster-foundation/public/images/grid/earth'
const CELL_M=20
const IW=64,IH=32
const texture:Record<string,string>={forest:'tile_forest_dense.webp',farmland:'tile_farmland.webp',industrial:'tile_concrete.webp',public:'tile_grass_2.webp',building:'tile_city.webp'}

function inside(p:GeoPoint,poly:GeoPoint[]){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a.lat>p.lat)!==(b.lat>p.lat))&&(p.lon<(b.lon-a.lon)*(p.lat-a.lat)/(b.lat-a.lat)+a.lon))yes=!yes}return yes}
function iso(eastM:number,northM:number){const c=eastM/CELL_M,r=-northM/CELL_M;return{x:(c-r)*IW/2,y:(c+r)*IH/2}}

export default function SauerlandIsometricPreview(){
 const[data,setData]=useState<Payload|null>(null),[zoom,setZoom]=useState(.72),[pan,setPan]=useState({x:0,y:0})
 const drag=useRef<{x:number;y:number;px:number;py:number}|null>(null)
 useEffect(()=>{fetch('/api/earth/region?radiusKm=1').then(r=>r.json()).then(setData).catch(e=>setData({ok:false,error:String(e)}))},[])
 const scene=useMemo(()=>{if(!data?.ok||!data.region?.origin||!data.features)return null;const o=data.region.origin,latM=distanceMeters(o,{lat:o.lat+.001,lon:o.lon})*1000,lonM=distanceMeters(o,{lat:o.lat,lon:o.lon+.001})*1000;const polygons=data.features.filter(f=>f.geometry.kind==='polygon') as (Feature&{geometry:{kind:'polygon';coordinates:GeoPoint[]}})[];const roads=data.features.filter(f=>f.featureType==='road'&&f.geometry.kind==='line') as (Feature&{geometry:{kind:'line';coordinates:GeoPoint[]}})[];const half=1000,cells=[] as {x:number;y:number;file:string}[];for(let n=-half;n<half;n+=CELL_M)for(let e=-half;e<half;e+=CELL_M){const p={lat:o.lat+n/latM,lon:o.lon+e/lonM};let type='grass';for(const f of polygons){if(inside(p,f.geometry.coordinates)){if(['forest','farmland','industrial','public','building'].includes(f.featureType))type=f.featureType}}const q=iso(e,n);cells.push({x:q.x,y:q.y,file:texture[type]??'tile_grass.webp'})}const roadLines=roads.map(f=>f.geometry.coordinates.map(p=>{const e=(p.lon-o.lon)*lonM,n=(p.lat-o.lat)*latM;return iso(e,n)}));return{cells,roadLines}},[data])
 if(!data)return <div style={{padding:30}}>Isometrisches Sauerland wird geladen …</div>
 if(!data.ok||!scene)return <div style={{padding:30}}>Isometrie derzeit nicht verfügbar: {data.error}</div>
 return <div style={{position:'relative',height:'70vh',minHeight:560,overflow:'hidden',background:'#17251c',borderRadius:12,touchAction:'none'}} onWheel={e=>{e.preventDefault();setZoom(z=>Math.max(.35,Math.min(2,z*(e.deltaY<0?1.12:.89))))}} onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(drag.current)setPan({x:drag.current.px+e.clientX-drag.current.x,y:drag.current.py+e.clientY-drag.current.y})}} onPointerUp={()=>drag.current=null}>
  <div style={{position:'absolute',left:'50%',top:'45%',transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,transformOrigin:'0 0'}}>
   {scene.cells.map((c,i)=><img key={i} src={`${TILE}/${c.file}`} alt="" draggable={false} style={{position:'absolute',left:c.x-IW/2,top:c.y-IH/2,width:IW,height:IW,objectFit:'cover',clipPath:'polygon(50% 0,100% 25%,50% 50%,0 25%)'}}/>)}
   <svg style={{position:'absolute',left:-5000,top:-5000,width:10000,height:10000,overflow:'visible',pointerEvents:'none'}} viewBox="-5000 -5000 10000 10000">{scene.roadLines.map((line,i)=><polyline key={i} points={line.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#5f625d" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>)}</svg>
  </div>
  <div style={{position:'absolute',left:12,top:12,background:'#f7f3e8e8',padding:'9px 11px',borderRadius:8,font:'11px system-ui',color:'#294034'}}><b>Sauerland 2086 · Isometrie</b><br/>1 Rasterzelle = {CELL_M} × {CELL_M} m<br/>Geometrie aus denselben realen Koordinaten wie die 2D-Karte</div>
  <div style={{position:'absolute',right:12,bottom:10,background:'#10231ddd',color:'#eee',padding:'6px 9px',borderRadius:6,font:'10px system-ui'}}>Mausrad: Zoom · Ziehen: Ansicht</div>
 </div>
}
