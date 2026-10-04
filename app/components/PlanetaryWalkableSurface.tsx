'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { buildPlanetaryLocalScene } from '@/lib/game/spatial/planetaryLocalScene'
import type { PreparedCorridor, PlanetarySurfaceEntity, MobileSurfaceObject } from '@/app/components/PlanetarySurfaceMap'

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
  onClose:()=>void
}
type Point={xM:number;yM:number}

const VIEW_W=1200
const VIEW_H=760
const ISO_X=.95
const ISO_Y=.48
const BUILDING_H=16

function iso(point:Point){return{x:VIEW_W/2+(point.xM-point.yM)*ISO_X,y:VIEW_H/2+(point.xM+point.yM)*ISO_Y}}
function pathD(points:Point[]){return points.map((point,index)=>{const p=iso(point);return (index?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)}).join(' ')}
function buildingTop(center:Point,widthM:number,depthM:number){return[
  {xM:center.xM-widthM/2,yM:center.yM-depthM/2},
  {xM:center.xM+widthM/2,yM:center.yM-depthM/2},
  {xM:center.xM+widthM/2,yM:center.yM+depthM/2},
  {xM:center.xM-widthM/2,yM:center.yM+depthM/2},
].map(iso)}
function attrs(points:Array<{x:number;y:number}>,dy=0){return points.map(p=>p.x+','+(p.y+dy)).join(' ')}

export default function PlanetaryWalkableSurface({locationSlug,body,title,corridors=[],mobileObjects=[],onClose}:Props){
  const[spatial,setSpatial]=useState<SpatialPayload|null>(null)
  const[error,setError]=useState<string|null>(null)
  const[player,setPlayer]=useState<Point>({xM:0,yM:0})

  useEffect(()=>{let live=true;(async()=>{try{const token=await getToken();if(!token)throw new Error('Nicht angemeldet');const response=await fetch('/api/game/build/spatial?location='+encodeURIComponent(locationSlug),{headers:{Authorization:'Bearer '+token},cache:'no-store'});const payload=await response.json();if(!response.ok)throw new Error(payload?.error??'Surface-Daten nicht verfügbar');if(live)setSpatial(payload)}catch(err){if(live)setError(err instanceof Error?err.message:String(err))}})();return()=>{live=false}},[locationSlug])

  const scene=useMemo(()=>spatial?buildPlanetaryLocalScene({
    body,
    frameId:String(spatial.frame?.terrain_dataset_id??(body+'-local-frame')),
    radiusM:300,
    entities:[...(spatial.entities??[]),...(spatial.builds??[])],
    corridors,
    mobileObjects,
  }):null,[spatial,body,corridors,mobileObjects])

  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{const target=event.target as HTMLElement|null;if(target?.closest('input,textarea'))return;if(event.key==='Escape'){event.preventDefault();onClose();return}const key=event.key.toLowerCase();if(!['w','a','s','d'].includes(key))return;event.preventDefault();const step=event.shiftKey?8:4;setPlayer(current=>({xM:Math.max(-300,Math.min(300,current.xM+(key==='d'?step:key==='a'?-step:0))),yM:Math.max(-300,Math.min(300,current.yM+(key==='s'?step:key==='w'?-step:0))) }))};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[onClose])

  if(error)return <div className="planetary-walkable-loading">{error}</div>
  if(!scene)return <div className="planetary-walkable-loading">Lokale Surface-Szene wird aufgebaut …</div>

  const playerIso=iso(player)
  const isMoon=body==='moon'
  return <section className={'planetary-walkable '+body}>
    <header><div><small>{body.toUpperCase()} · LOCAL SCENE</small><b>{title}</b><span>{scene.frameId}</span></div><div className="stats"><span>{scene.buildings.length} Gebäude</span><span>{scene.paths.length} Wege/Korridore</span></div><button onClick={onClose}>← Karte</button></header>
    <div className="stage">
      <svg viewBox={'0 0 '+VIEW_W+' '+VIEW_H} preserveAspectRatio="xMidYMid slice">
        <defs><radialGradient id={'ground-'+body} cx="45%" cy="38%"><stop offset="0%" stopColor={isMoon?'#777872':'#795b50'}/><stop offset="100%" stopColor={isMoon?'#343735':'#3e2f2b'}/></radialGradient></defs>
        <rect width={VIEW_W} height={VIEW_H} fill={'url(#ground-'+body+')'}/>
        {scene.paths.map(path=><g key={path.id}><path d={pathD(path.points)} fill="none" stroke="#20231f" strokeWidth="13" strokeLinecap="round" opacity=".45"/><path d={pathD(path.points)} fill="none" stroke={path.kind==='road'?'#aaa28f':'#8d887a'} strokeWidth={path.kind==='road'?8:5} strokeLinecap="round"/></g>)}
        {scene.buildings.map(building=>{const top=buildingTop(building.center,building.widthM,building.depthM);const right=[top[1],top[2],{x:top[2].x,y:top[2].y+BUILDING_H},{x:top[1].x,y:top[1].y+BUILDING_H}];const front=[top[2],top[3],{x:top[3].x,y:top[3].y+BUILDING_H},{x:top[2].x,y:top[2].y+BUILDING_H}];return <g key={building.id}><polygon points={attrs(right)} fill="#59615f" stroke="#272d2d"/><polygon points={attrs(front)} fill="#444d4d" stroke="#272d2d"/><polygon points={attrs(top)} fill={isMoon?'#b6b4a9':'#a88c7c'} stroke="#2d3535" strokeWidth="1.4"/><title>{building.label??building.entityId??'Gebäude'}</title></g>})}
        {scene.mobileObjects.map(object=>{const p=iso(object.point);return <g key={object.id} transform={'translate('+p.x+' '+p.y+')'}><ellipse cy="8" rx="8" ry="3" fill="#000" opacity=".28"/><rect x="-6" y="-4" width="12" height="9" rx="2" fill="#d3ad45" stroke="#4f411b"/><circle cx="-5" cy="6" r="2" fill="#242b2b"/><circle cx="5" cy="6" r="2" fill="#242b2b"/><title>{object.label}</title></g>})}
        <g transform={'translate('+playerIso.x+' '+(playerIso.y-9)+')'}><ellipse cy="11" rx="8" ry="3.5" fill="#000" opacity=".3"/><circle cy="-4" r="4.5" fill="#e8c39e" stroke="#283133"/><path d="M-6 12 Q0 0 6 12 L5 20 L-5 20 Z" fill="#d4ad43" stroke="#4b3b17"/></g>
      </svg>
      <div className="hint"><b>WASD</b> bewegen · <b>Shift</b> schneller · dieselbe Surface-Geometrie wie die Karte</div>
    </div>
    <style jsx>{`
      .planetary-walkable{position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;z-index:1500;background:#090b0c;color:#e8eef0;font-family:system-ui;overflow:hidden}.planetary-walkable header{height:46px;display:flex;align-items:center;gap:14px;padding:0 14px;background:#07131dec;border-bottom:1px solid #394d59;position:relative;z-index:2}.planetary-walkable header>div:first-child{display:flex;align-items:baseline;gap:9px}.planetary-walkable header small{font:800 8px monospace;letter-spacing:.14em;color:#d7b96e}.planetary-walkable header b{font-size:13px}.planetary-walkable header span{font-size:9px;color:#869ca7}.planetary-walkable .stats{display:flex;gap:10px;margin-left:auto;color:#8ba0aa;font-size:9px}.planetary-walkable header button{border:1px solid #466578;border-radius:6px;background:#102b3c;color:#e1edf1;padding:6px 9px;cursor:pointer}.planetary-walkable .stage{position:absolute;inset:46px 0 0}.planetary-walkable svg{width:100%;height:100%;display:block}.planetary-walkable .hint{position:absolute;left:12px;top:12px;padding:6px 8px;border:1px solid #536973;border-radius:6px;background:#071521d9;color:#bdccd2;font:9px monospace}.planetary-walkable-loading{position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;z-index:1500;display:grid;place-items:center;background:#080c0f;color:#c4d4da;font-family:monospace}
    `}</style>
  </section>
}