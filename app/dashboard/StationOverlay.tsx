'use client'

// StationOverlay.tsx
// Aktualisiert: 01.09.2026 — Stationsmodule aus gemeinsamem NOXIA-Katalog
// Version:      0.4.0
//
// Raumstations-Ansicht für L4/L5-Stationen und Orbit-Stationen.

import { useState, useEffect, useCallback } from 'react'
import { useGameStore } from '@/lib/store/gameStore'
import { STATION_MODULE_DEFS as MODULE_DEFS, BUILDABLE_STATION_MODULES as BUILDABLE_MODULES } from '@/lib/game/stationModules'

interface StationModule {
  id: string
  entity_id: string
  slot: number
  condition: number
  status: string
  is_state_owned: boolean
  profile_id: string | null
  actor_id: string | null
}

interface LocationResource {
  resource: string
  stock: number
  production: number
  consumption: number
}

interface StationOverlayProps {
  slug: string
  name: string
  population: number
  populationMax: number
  userId: string
  locationId: string
  locationResources: LocationResource[]
  credits: number
  entities: StationModule[]
  onChanged: () => void
  onOpenWarehouse?: () => void
  onOpenMarket?: () => void
  allLocations?: any[]
  cargo?: any
  shipRange?: number
  currentTick?: number
  inTransit?: boolean
  onTravel?: (dest: string) => void
}

const MONO = "'Courier Prime', monospace"
const DARK = '#0d1a26'
const RES_ICON: Record<string, string> = { water: '💧', energy: '⚡', metal: '⛏️' }
const RES_LABEL: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }

function stockColor(stock: number, consumption: number): string {
  if (consumption === 0) return '#6fcf97'
  const ticks = stock / consumption
  if (ticks < 2) return '#e74c3c'
  if (ticks < 5) return '#f5d742'
  return '#6fcf97'
}

function ModuleRing({ modules, selected, onSelect, userId, onOpenWarehouse }: {
  modules: StationModule[]
  selected: string | null
  onSelect: (id: string) => void
  userId: string
  onOpenWarehouse?: () => void
}) {
  const W = 440, H = 380
  const CX = W / 2, CY = H / 2
  const R_OUTER = 140, R_INNER = 55
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {[...Array(24)].map((_, i) => { const s = (i * 6577 + 1234) % 10000; return <circle key={i} cx={(s % W).toFixed(1)} cy={((s * 3) % H).toFixed(1)} r={(0.5 + (s % 10) / 20).toFixed(2)} fill="#aab8cc" opacity={(0.1 + (s % 5) / 15).toFixed(2)} /> })}
      {modules.map((m, i) => { const a=(i/modules.length)*Math.PI*2-Math.PI/2, mx=CX+Math.cos(a)*R_OUTER, my=CY+Math.sin(a)*R_OUTER, ix=CX+Math.cos(a)*R_INNER, iy=CY+Math.sin(a)*R_INNER; return <line key={m.id} x1={ix.toFixed(1)} y1={iy.toFixed(1)} x2={mx.toFixed(1)} y2={my.toFixed(1)} stroke="#1a2a3a" strokeWidth="1.5" /> })}
      <circle cx={CX} cy={CY} r={R_INNER + 8} fill="#0a1520" stroke="#2a4e7a" strokeWidth="1" />
      <circle cx={CX} cy={CY} r={R_INNER} fill="#0d1a26" stroke="#c9a961" strokeWidth="1.5" />
      <text x={CX} y={CY - 6} textAnchor="middle" fill="#c9a961" fontSize="9" fontFamily={MONO} fontWeight="700">PROMETHEUS</text>
      <text x={CX} y={CY + 8} textAnchor="middle" fill="#5a7a9a" fontSize="7" fontFamily={MONO}>L5 · STATION</text>
      {modules.map((m, i) => {
        const angle=(i/modules.length)*Math.PI*2-Math.PI/2, mx=CX+Math.cos(angle)*R_OUTER, my=CY+Math.sin(angle)*R_OUTER
        const def=MODULE_DEFS[m.entity_id], isSelected=selected===m.id, isOwn=m.profile_id===userId, color=def?.color??'#5a7a9a', inactive=m.status!=='active'||m.condition<20
        return <g key={m.id} onClick={() => { if (m.entity_id === 'warehouse') { onOpenWarehouse?.(); return } onSelect(m.id) }} style={{cursor:'pointer'}}>
          {isSelected && <circle cx={mx} cy={my} r="26" fill={color} opacity="0.12" />}
          <circle cx={mx} cy={my} r="22" fill={inactive?'#0a1520':'#0d1a26'} stroke={isSelected?color:isOwn?'#c9a961':m.is_state_owned?'#5aaeff':'#2a4e7a'} strokeWidth={isSelected?2.5:1.5} opacity={inactive?0.5:1}/>
          <text x={mx} y={my+1} textAnchor="middle" dominantBaseline="middle" fontSize="14" style={{userSelect:'none'}}>{inactive?'⚠️':(def?.icon??'⬡')}</text>
          <text x={mx} y={my+32} textAnchor="middle" fill={isSelected?'#c9a961':'#5a7a9a'} fontSize="7" fontFamily={MONO}>{def?.label.split(' ')[0]??m.entity_id}</text>
        </g>
      })}
    </svg>
  )
}

function ModuleDetail({ module, userId, onClose, onSell }: { module: StationModule; userId: string; onClose: () => void; credits: number; onSell: (id: string) => void }) {
  const def=MODULE_DEFS[module.entity_id], isOwn=module.profile_id===userId, isState=module.is_state_owned
  const condColor=module.condition>60?'#6fcf97':module.condition>30?'#f5d742':'#e74c3c'
  return <div style={{background:'#0a1520',border:'1px solid #1e3a52',borderRadius:8,padding:16}}>
    <div style={{display:'flex',justifyContent:'space-between'}}><strong style={{color:'#c9a961'}}>{def?.icon} {def?.label??module.entity_id}</strong><button onClick={onClose}>×</button></div>
    <p style={{color:'#8aa0b5',fontSize:12}}>{def?.description}</p>
    <div style={{color:condColor,fontFamily:MONO,fontSize:12}}>Zustand: {module.condition}% · {module.status}</div>
    <div style={{color:'#64788a',fontSize:11,marginTop:8}}>{isState?'Staatseigentum':isOwn?'Dein Modul':'Fremdeigentum'}</div>
    {isOwn && !isState && <button onClick={()=>onSell(module.id)} style={{marginTop:12}}>Verkaufen</button>}
  </div>
}

export default function StationOverlay(props: StationOverlayProps) {
  const { slug,name,population,populationMax,userId,locationId,locationResources,credits,entities,onChanged,onOpenWarehouse,onOpenMarket }=props
  const [selected,setSelected]=useState<string|null>(null), [building,setBuilding]=useState(false), [msg,setMsg]=useState('')
  const { setCredits }=useGameStore()
  useEffect(()=>{ if(selected && !entities.some(e=>e.id===selected)) setSelected(null) },[entities,selected])
  const build=useCallback(async(moduleId:string)=>{ setBuilding(true);setMsg(''); try { const r=await fetch('/api/game/build',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({locationId,entityType:'module',entityId:moduleId})}); const d=await r.json(); if(!r.ok) throw new Error(d.error??'Bau fehlgeschlagen'); if(typeof d.credits==='number')setCredits(d.credits); setMsg('Modulbau gestartet.');onChanged() } catch(e:any){setMsg(e.message)} finally{setBuilding(false)} },[locationId,onChanged,setCredits])
  const sell=useCallback(async(id:string)=>{ const r=await fetch('/api/game/build',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({entityId:id})}); const d=await r.json(); if(!r.ok){setMsg(d.error??'Verkauf fehlgeschlagen');return} if(typeof d.credits==='number')setCredits(d.credits);setSelected(null);onChanged() },[onChanged,setCredits])
  const selectedModule=entities.find(e=>e.id===selected)
  return <div style={{color:'#d6e2ec',background:DARK,minHeight:'100%',padding:20}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><h2 style={{margin:0,color:'#c9a961'}}>{name}</h2><small>{slug.toUpperCase()} · RAUMSTATION · {population}/{populationMax}</small></div><div style={{display:'flex',gap:8}}>{onOpenWarehouse&&<button onClick={onOpenWarehouse}>Lager</button>}{onOpenMarket&&<button onClick={onOpenMarket}>Handel</button>}<strong>{credits.toLocaleString('de-DE')} Cr</strong></div></div>
    <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 300px',gap:20,marginTop:16}}>
      <div><ModuleRing modules={entities} selected={selected} onSelect={setSelected} userId={userId} onOpenWarehouse={onOpenWarehouse}/><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{locationResources.map(r=><span key={r.resource} style={{color:stockColor(r.stock,r.consumption)}}>{RES_ICON[r.resource]??'◆'} {RES_LABEL[r.resource]??r.resource}: {r.stock.toFixed(0)}</span>)}</div></div>
      <div>{selectedModule?<ModuleDetail module={selectedModule} userId={userId} onClose={()=>setSelected(null)} credits={credits} onSell={sell}/>:<div><h3>Stationsmodule</h3>{BUILDABLE_MODULES.map(([id,def])=><button key={id} disabled={building||credits<def.cost} onClick={()=>build(id)} style={{display:'block',width:'100%',marginBottom:6,textAlign:'left'}}>{def.icon} {def.label} · {def.cost.toLocaleString('de-DE')} Cr</button>)}{msg&&<p>{msg}</p>}</div>}</div>
    </div>
  </div>
}
