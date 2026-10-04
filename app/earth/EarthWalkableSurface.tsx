'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import { getSessionInfo } from '@/lib/supabase/auth'
import { deriveEarthSurfaceTheme } from '@/lib/world/render/earthSurfaceTheme'
import { buildEarthLocalScene, type EarthLocalScene, type ScenePoint } from '@/lib/world/spatial/earthLocalScene'

type GeoPoint={lat:number;lon:number}
type Feature={id:string;featureType:string;geometry:{kind:'point'|'line'|'polygon';coordinates:GeoPoint|GeoPoint[]};properties?:Record<string,any>}
type Payload={ok:boolean;region?:{name:string;origin:GeoPoint};bounds?:{south:number;west:number;north:number;east:number};features?:Feature[];error?:string}
type Props={residents:ColonyResident[];onClose:()=>void}
type IsoPoint={x:number;y:number}

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
  const[player,setPlayer]=useState<ScenePoint>({xM:0,yM:0})
  const[selected,setSelected]=useState<ColonyResident|null>(null)
  const[message,setMessage]=useState('')
  const[reply,setReply]=useState('')
  const[sending,setSending]=useState(false)
  const[playerName,setPlayerName]=useState('Du')
  const[motionTime,setMotionTime]=useState(0)

  useEffect(()=>{let live=true;fetch('/api/earth/region?v=walkable-v2',{cache:'no-store'}).then(r=>r.json()).then(json=>{if(live)setData(json)}).catch(()=>{if(live)setData({ok:false,error:'Earth-Region nicht erreichbar'})});return()=>{live=false}},[])
  useEffect(()=>{let live=true;getSessionInfo().then(({token})=>fetch('/api/game/profile',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'})).then(response=>response.ok?response.json():null).then(json=>{const username=String(json?.profile?.username??'').trim();if(live&&username)setPlayerName(username)}).catch(()=>{});return()=>{live=false}},[])
  useEffect(()=>{let frame=0,last=0;const tick=(now:number)=>{if(now-last>=80){setMotionTime(now/1000);last=now}frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[])

  const features=data?.features??[]
  const origin=data?.region?.origin
  const theme=useMemo(()=>deriveEarthSurfaceTheme(Number(origin?.lat??0),features),[origin?.lat,features])
  const scene=useMemo<EarthLocalScene|null>(()=>origin?buildEarthLocalScene({origin,features,radiusM:SCENE_RADIUS_M}):null,[origin,features])
  const localFacts=useMemo(()=>{
    const facts:string[]=[]
    if(data?.region?.name)facts.push(`Ort: ${data.region.name}`)
    if(scene){
      facts.push(`${scene.roadGraph.length} lokale Straßensegmente im aktuellen Ausschnitt`)
      facts.push(`${scene.railGraph.length} lokale Schienensegmente im aktuellen Ausschnitt`)
      facts.push(`${scene.buildings.length} Gebäude/Bebauungsmassen im aktuellen Ausschnitt`)
      if(scene.polygons.some(item=>item.kind==='water')||scene.paths.some(item=>item.kind==='waterway'))facts.push('Wasserlauf oder Wasserfläche im aktuellen Ausschnitt vorhanden')
      if(scene.polygons.some(item=>item.kind==='forest'||item.kind==='vegetation'))facts.push('Vegetations- bzw. Waldflächen im aktuellen Ausschnitt vorhanden')
    }
    const named=features.filter(feature=>feature.geometry.kind==='point'&&feature.properties?.name).slice(0,10)
    for(const feature of named){
      const type=String(feature.properties?.visual_class??feature.featureType)
      facts.push(`${String(feature.properties?.name)} · ${type}`)
    }
    return facts
  },[data?.region?.name,scene,features])

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
    const distance=((phase*total)+(selectedNpc?0:motionTime*speed))%total

    let walked=0
    let position=road.points[0]
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
    return{
      resident,
      xM:Math.max(-SCENE_RADIUS_M,Math.min(SCENE_RADIUS_M,position.xM+((index%3)-1)*2.5)),
      yM:Math.max(-SCENE_RADIUS_M,Math.min(SCENE_RADIUS_M,position.yM+((index%2)?2:-2))),
    }
  }):[],[scene,residents,motionTime,selected?.id])

  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{const target=event.target as HTMLElement|null;if(target?.closest('input,textarea'))return;const step=event.shiftKey?8:4;const key=event.key.toLowerCase();if(!['w','a','s','d'].includes(key))return;event.preventDefault();setPlayer(p=>({xM:Math.max(-SCENE_RADIUS_M,Math.min(SCENE_RADIUS_M,p.xM+(key==='d'?step:key==='a'?-step:0))),yM:Math.max(-SCENE_RADIUS_M,Math.min(SCENE_RADIUS_M,p.yM+(key==='s'?step:key==='w'?-step:0)))}))};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[])

  async function talk(){
    if(!selected||!message.trim()||sending)return
    setSending(true);setReply('')
    try{
      const{token}=await getSessionInfo()
      const response=await fetch('/api/game/npc-conversation',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({player:message.trim().slice(0,120),npcName:selected.displayName,npcRole:role(selected),headline:`Lokales Gespräch in ${data?.region?.name??'der aktuellen Earth-Region'}`,source:'NOXIA Earth local scene',locationName:data?.region?.name??'Erde',localFacts,history:[]})})
      const json=await response.json().catch(()=>({}))
      setReply(response.ok&&json.reply?String(json.reply):'Die Person kann gerade nicht antworten.')
      if(response.ok)setMessage('')
    }catch{setReply('Gespräch derzeit nicht erreichbar.')}finally{setSending(false)}
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

        {scene.buildings.map(building=>{
          const top=buildingPolygon(building.center,building.widthM,building.depthM)
          const side=top.map(point=>({x:point.x,y:point.y+HEIGHT_PX}))
          const facade=[top[1],top[2],side[2],side[1]]
          const front=[top[2],top[3],side[3],side[2]]
          return <g key={building.id} opacity={building.provenance==='observed'?1:.78}>
            <polygon points={pointsAttr(facade)} fill="#6f7776" stroke="#39464b" strokeWidth="1"/>
            <polygon points={pointsAttr(front)} fill="#596466" stroke="#39464b" strokeWidth="1"/>
            <polygon points={pointsAttr(top)} fill={building.provenance==='observed'?'#d7d2c5':'#c8c3b8'} stroke="#4b5759" strokeWidth="1.2"/>
            <title>{building.label??'Gebäude'} · {building.provenance==='observed'?'reale Geometrie':'abgeleitete Bebauungsmasse'}</title>
          </g>
        })}

        {npcPositions.map(({resident,xM,yM})=>{const p=iso({xM,yM});const name=resident.displayName;const selectedNpc=selected?.id===resident.id;const labelWidth=Math.max(42,Math.min(112,name.length*6.1+14));return <g key={resident.id} transform={`translate(${p.x} ${p.y-8})`} onClick={()=>{setSelected(resident);setMessage('');setReply('')}} style={{cursor:'pointer'}}>
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

      <div className="earth-walkable-help"><b>WASD</b> bewegen · <b>Shift</b> schneller · NPC anklicken · lokale 2.5D-Szene aus realer Geographie</div>
      <div className="earth-walkable-provenance">Gebäude ohne reale Footprints werden vorläufig als <b>abgeleitete Bebauungsmasse</b> dargestellt. Straßen, Wasser, Landnutzung und Routen stammen aus dem persistierten Orts-Snapshot.</div>

      {selected&&<aside><div className="head"><div><small>NPC · LOKAL</small><b>{selected.displayName}</b><span>{role(selected)}</span></div><button onClick={()=>setSelected(null)}>×</button></div><div className="facts"><span>Aktivität</span><b>{selected.activityState}</b><span>Letzte Aktion</span><b>{selected.lastAction??'–'}</b></div><div className="chat"><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void talk()}} placeholder="Ansprechen …"/><button disabled={sending||!message.trim()} onClick={()=>void talk()}>{sending?'…':'Sprechen'}</button></div>{reply&&<p>{reply}</p>}</aside>}
    </div>
    <style jsx>{`
      .earth-walkable{position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;z-index:1120;background:#0b1115;color:#e7eef0;font-family:system-ui;overflow:hidden}.earth-walkable header{height:46px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 14px;background:#081723ef;border-bottom:1px solid #38546b;position:relative;z-index:3}.earth-walkable header>div:first-child{display:flex;align-items:baseline;gap:10px;min-width:0}.earth-walkable header small{font:800 8px monospace;letter-spacing:.14em;color:#d7b96e}.earth-walkable header b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.earth-walkable header span{font-size:9px;color:#8ea4af}.earth-walkable header .meta{display:flex;gap:10px;margin-left:auto}.earth-walkable header button,.earth-walkable aside button{border:1px solid #476476;border-radius:6px;background:#102b3c;color:#dce9ee;padding:6px 9px;cursor:pointer}.earth-walkable-stage{position:absolute;inset:46px 0 0;overflow:hidden}.earth-walkable-stage svg{width:100%;height:100%;display:block}.earth-walkable-help,.earth-walkable-provenance{position:absolute;left:12px;padding:6px 8px;border:1px solid #4b6877;border-radius:6px;background:#071521d9;font:9px monospace;color:#b7c8cf}.earth-walkable-help{top:12px}.earth-walkable-provenance{top:44px;max-width:520px;color:#92a9b2}.earth-walkable aside{position:absolute;right:16px;top:16px;width:390px;max-height:calc(100% - 32px);overflow:auto;padding:10px;border:1px solid #617b85;border-radius:9px;background:#071521f2;box-shadow:0 16px 38px #0008;backdrop-filter:blur(8px)}.earth-walkable .head{display:flex;justify-content:space-between;gap:12px}.earth-walkable .head small{display:block;color:#d7b96e;font:800 8px monospace;letter-spacing:.12em}.earth-walkable .head b{display:block;margin-top:3px}.earth-walkable .head span{display:block;margin-top:2px;color:#8ba3ad;font-size:9px}.earth-walkable .facts{display:grid;grid-template-columns:90px 1fr;gap:5px;margin-top:10px;font-size:10px}.earth-walkable .facts span{color:#7e98a3}.earth-walkable .chat{display:flex;gap:6px;margin-top:10px}.earth-walkable .chat input{flex:1;min-width:0;border:1px solid #476476;border-radius:6px;background:#061019;color:#eef5f7;padding:7px 8px}.earth-walkable aside p{margin:9px 0 0;padding-top:8px;border-top:1px solid #314753;color:#d7e4e8;font-size:11px;line-height:1.45}.earth-walkable-loading{position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;z-index:1120;display:grid;place-items:center;background:#07111b;color:#bcd2dc;font-family:monospace}
      @media(max-width:760px){.earth-walkable header .meta{display:none}.earth-walkable-provenance{max-width:calc(100% - 24px)}.earth-walkable aside{left:12px;right:12px;top:auto;bottom:92px;width:auto;max-height:42vh}}
    `}</style>
  </section>
}
