'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import { getSessionInfo } from '@/lib/supabase/auth'
import { deriveEarthSurfaceTheme } from '@/lib/world/render/earthSurfaceTheme'

type GeoPoint={lat:number;lon:number}
type Feature={id:string;featureType:string;geometry:{kind:'point'|'line'|'polygon';coordinates:GeoPoint|GeoPoint[]};properties?:Record<string,any>}
type Payload={ok:boolean;region?:{name:string;origin:GeoPoint};bounds?:{south:number;west:number;north:number;east:number};features?:Feature[];error?:string}
type Props={residents:ColonyResident[];onClose:()=>void}

function role(resident:ColonyResident){return resident.assignments.find(item=>item.type==='work')?.roleCode??resident.activityState??'general'}
function hash(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}

export default function EarthWalkableSurface({residents,onClose}:Props){
  const[data,setData]=useState<Payload|null>(null)
  const[player,setPlayer]=useState({x:500,y:520})
  const[selected,setSelected]=useState<ColonyResident|null>(null)
  const[message,setMessage]=useState('')
  const[reply,setReply]=useState('')
  const[sending,setSending]=useState(false)

  useEffect(()=>{let live=true;fetch('/api/earth/region?v=walkable-v1',{cache:'no-store'}).then(r=>r.json()).then(json=>{if(live)setData(json)}).catch(()=>{if(live)setData({ok:false,error:'Earth-Region nicht erreichbar'})});return()=>{live=false}},[])

  const features=data?.features??[]
  const bounds=data?.bounds
  const project=useMemo(()=>{
    if(!bounds)return null
    const lonSpan=Math.max(1e-9,bounds.east-bounds.west),latSpan=Math.max(1e-9,bounds.north-bounds.south)
    return (point:GeoPoint)=>({x:(point.lon-bounds.west)/lonSpan*1000,y:(bounds.north-point.lat)/latSpan*1000})
  },[bounds])
  const theme=useMemo(()=>deriveEarthSurfaceTheme(Number(data?.region?.origin?.lat??0),features),[data?.region?.origin?.lat,features])
  const lines=useMemo(()=>features.filter(f=>f.geometry.kind!=='point'&&(f.featureType==='road'||f.featureType==='rail'||f.featureType==='waterway'||f.featureType==='water'||f.featureType==='forest'||f.featureType==='vegetation'||f.featureType==='farmland'||f.featureType==='urban')), [features])
  const npcPositions=useMemo(()=>residents.slice(0,18).map((resident,index)=>{const h=hash(resident.id);return{resident,x:350+(h%300),y:350+((h>>>8)%260)+(index%3)*10}}),[residents])

  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{const target=event.target as HTMLElement|null;if(target?.closest('input,textarea'))return;const step=event.shiftKey?14:8;const key=event.key.toLowerCase();if(!['w','a','s','d'].includes(key))return;event.preventDefault();setPlayer(p=>({x:Math.max(20,Math.min(980,p.x+(key==='d'?step:key==='a'?-step:0))),y:Math.max(20,Math.min(980,p.y+(key==='s'?step:key==='w'?-step:0)))}))};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[])

  async function talk(){
    if(!selected||!message.trim()||sending)return
    setSending(true);setReply('')
    try{
      const{token}=await getSessionInfo()
      const response=await fetch('/api/game/npc-conversation',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({player:message.trim().slice(0,120),npcName:selected.displayName,npcRole:role(selected),headline:`Lokales Gespräch in ${data?.region?.name??'der aktuellen Earth-Region'}`,source:'NOXIA Earth local context',history:[]})})
      const json=await response.json().catch(()=>({}))
      setReply(response.ok&&json.reply?String(json.reply):'Die Person kann gerade nicht antworten.')
    }catch{setReply('Gespräch derzeit nicht erreichbar.')}finally{setSending(false)}
  }

  if(!data)return <div className="earth-walkable-loading">Begehbare Earth-Ansicht wird geladen …</div>
  if(!data.ok||!project)return <div className="earth-walkable-loading">Earth-Ansicht nicht verfügbar: {data.error??'keine Region'}</div>

  return <section className="earth-walkable" aria-label={`Begehbare Ansicht ${data.region?.name??'Erde'}`}>
    <header><div><small>EARTH · BEGEHBAR</small><b>{data.region?.name??'Aktueller Ort'}</b><span>{theme.label}</span></div><button onClick={onClose}>← Karte</button></header>
    <div className="earth-walkable-stage">
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        <rect width="1000" height="1000" fill={theme.background}/>
        {lines.map(feature=>{const pts=feature.geometry.coordinates as GeoPoint[];if(!Array.isArray(pts)||pts.length<2)return null;const d=pts.map((point,index)=>{const p=project(point);return `${index?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`}).join(' ');const polygon=feature.geometry.kind==='polygon';const fill=feature.featureType==='forest'?theme.vegetation:feature.featureType==='vegetation'?theme.backgroundAlt:feature.featureType==='farmland'?'#c6b87c':feature.featureType==='urban'?'#b8b5ac':feature.featureType==='water'?'#77b3cf':'none';const stroke=feature.featureType==='road'?'#e0c06a':feature.featureType==='rail'?'#5b5d5b':feature.featureType==='waterway'?'#5ba8ca':polygon?'#69745d':'#cfd4cf';return <path key={feature.id} d={d+(polygon?' Z':'')} fill={polygon?fill:'none'} stroke={stroke} strokeWidth={feature.featureType==='road'?2.2:1.1} opacity={polygon?.72:.9}/>})}
        {npcPositions.map(({resident,x,y})=><g key={resident.id} transform={`translate(${x} ${y})`} onClick={()=>setSelected(resident)} style={{cursor:'pointer'}}><circle r="10" fill={selected?.id===resident.id?'#e8c75c':'#244d5c'} stroke="#f2efe0" strokeWidth="2"/><circle cy="-4" r="3.2" fill="#f0c5a0"/><path d="M-4 6 Q0 0 4 6" fill="#9db6c0"/><title>{resident.displayName} · {role(resident)}</title></g>)}
        <g transform={`translate(${player.x} ${player.y})`}><circle r="12" fill="#d4ad43" stroke="#fff6c8" strokeWidth="2.5"/><circle cy="-4" r="3.5" fill="#f2c9a4"/><path d="M-5 7 Q0 0 5 7" fill="#173f49"/></g>
      </svg>
      <div className="earth-walkable-help">WASD · bewegen · NPC anklicken · Karte bleibt dieselbe reale Geographie</div>
      {selected&&<aside><div className="head"><div><small>NPC · LOKAL</small><b>{selected.displayName}</b><span>{role(selected)}</span></div><button onClick={()=>setSelected(null)}>×</button></div><div className="facts"><span>Aktivität</span><b>{selected.activityState}</b><span>Letzte Aktion</span><b>{selected.lastAction??'–'}</b></div><div className="chat"><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void talk()}} placeholder="Ansprechen …"/><button disabled={sending||!message.trim()} onClick={()=>void talk()}>{sending?'…':'Sprechen'}</button></div>{reply&&<p>{reply}</p>}</aside>}
    </div>
    <style jsx>{`
      .earth-walkable{position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;z-index:1120;background:#0b1115;color:#e7eef0;font-family:system-ui;overflow:hidden}.earth-walkable header{height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;background:#081723eb;border-bottom:1px solid #38546b;position:relative;z-index:3}.earth-walkable header>div{display:flex;align-items:baseline;gap:10px}.earth-walkable header small{font:800 8px monospace;letter-spacing:.14em;color:#d7b96e}.earth-walkable header b{font-size:13px}.earth-walkable header span{font-size:9px;color:#8ea4af}.earth-walkable header button,.earth-walkable aside button{border:1px solid #476476;border-radius:6px;background:#102b3c;color:#dce9ee;padding:6px 9px;cursor:pointer}.earth-walkable-stage{position:absolute;inset:44px 0 0;overflow:hidden}.earth-walkable-stage svg{width:100%;height:100%;display:block}.earth-walkable-help{position:absolute;left:12px;top:12px;padding:6px 8px;border:1px solid #4b6877;border-radius:6px;background:#071521cc;font:9px monospace;color:#b7c8cf}.earth-walkable aside{position:absolute;right:16px;bottom:82px;width:310px;padding:12px;border:1px solid #617b85;border-radius:9px;background:#071521ec;box-shadow:0 16px 38px #0008}.earth-walkable .head{display:flex;justify-content:space-between;gap:12px}.earth-walkable .head small{display:block;color:#d7b96e;font:800 8px monospace;letter-spacing:.12em}.earth-walkable .head b{display:block;margin-top:3px}.earth-walkable .head span{display:block;margin-top:2px;color:#8ba3ad;font-size:9px}.earth-walkable .facts{display:grid;grid-template-columns:90px 1fr;gap:5px;margin-top:10px;font-size:10px}.earth-walkable .facts span{color:#7e98a3}.earth-walkable .chat{display:flex;gap:6px;margin-top:10px}.earth-walkable .chat input{flex:1;min-width:0;border:1px solid #476476;border-radius:6px;background:#061019;color:#eef5f7;padding:7px 8px}.earth-walkable aside p{margin:9px 0 0;padding-top:8px;border-top:1px solid #314753;color:#d7e4e8;font-size:11px;line-height:1.45}.earth-walkable-loading{position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;z-index:1120;display:grid;place-items:center;background:#07111b;color:#bcd2dc;font-family:monospace}
    `}</style>
  </section>
}
