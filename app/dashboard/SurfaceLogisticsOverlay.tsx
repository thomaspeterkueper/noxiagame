'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import BuildingOverlayShell from './BuildingOverlayShell'

type Inventory={id:string;label:string;inventory_kind:string;subject_type:string;subject_id:string|null}
type TransportJob={id:string;domain:string;source_inventory_id:string;destination_inventory_id:string;vehicle_role:string|null;resource:string;amount:number;status:string}
type Props={locationSlug:string;locationName:string;onClose:()=>void}
const ACTIVE=new Set(['reserved','loading','in_transit','arrived','unloading'])
const statusLabel=(s:string)=>s.replaceAll('_',' ')

export default function SurfaceLogisticsOverlay({locationSlug,locationName,onClose}:Props){
 const [inventories,setInventories]=useState<Inventory[]>([]),[jobs,setJobs]=useState<TransportJob[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null)
 useEffect(()=>{let cancelled=false;(async()=>{try{const token=await getToken();if(!token)throw new Error('Nicht angemeldet');const headers={Authorization:`Bearer ${token}`};const s=await fetch(`/api/game/build/spatial?location=${encodeURIComponent(locationSlug)}`,{headers,cache:'no-store'}),sp=await s.json();if(!s.ok||!sp?.location?.id)throw new Error(sp?.error??'Standort nicht verfügbar');const r=await fetch(`/api/game/logistics?locationId=${encodeURIComponent(sp.location.id)}`,{headers,cache:'no-store'}),lp=await r.json();if(!r.ok)throw new Error(lp?.error??'Logistik nicht verfügbar');if(!cancelled){setInventories(Array.isArray(lp.inventories)?lp.inventories:[]);setJobs(Array.isArray(lp.jobs)?lp.jobs:[]);setError(null)}}catch(e){if(!cancelled)setError(e instanceof Error?e.message:String(e))}finally{if(!cancelled)setLoading(false)}})();return()=>{cancelled=true}},[locationSlug])
 const byId=useMemo(()=>new Map(inventories.map(i=>[i.id,i])),[inventories]),active=useMemo(()=>jobs.filter(j=>j.domain==='surface'&&ACTIVE.has(j.status)),[jobs]),nodes=useMemo(()=>inventories.filter(i=>i.inventory_kind!=='vehicle'),[inventories])
 return <BuildingOverlayShell eyebrow="GEBÄUDE · LOGISTIKZENTRUM" title={locationName} subtitle="Oberflächentransporte, Lager- und Übergabepunkte" onClose={onClose} footer="NOXIA · gemeinsames Gebäude-Overlay für planetare Standorte">
   <div className="summary"><div><b>{active.length}</b><span>aktive Transporte</span></div><div><b>{nodes.length}</b><span>Logistikknoten</span></div><div><b>{jobs.length}</b><span>Aufträge gesamt</span></div></div>
   {loading&&<div className="state">Logistikdaten werden geladen …</div>}{error&&<div className="state error">{error}</div>}
   {!loading&&!error&&<><section><small>TRANSPORTE</small><h3>Aktive Oberflächenlogistik</h3>{!active.length&&<div className="state">Aktuell fährt kein Oberflächentransport.</div>}{active.map(j=><article key={j.id}><div><strong>{j.vehicle_role??'Surface-Fahrzeug'}</strong><span>{statusLabel(j.status)}</span></div><b>{j.amount} {j.resource}</b><p>{byId.get(j.source_inventory_id)?.label??'Quelle'} → {byId.get(j.destination_inventory_id)?.label??'Ziel'}</p></article>)}</section><section><small>KNOTEN</small><h3>Lokale Lager- und Übergabepunkte</h3><div className="nodes">{nodes.map(n=><article key={n.id}><strong>{n.label}</strong><span>{n.subject_type}</span></article>)}</div></section></>}
   <style jsx>{`.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}.summary div,article,.state{padding:11px 12px;border:1px solid #d2d0c4;border-radius:8px;background:#fffdf7}.summary b{display:block;font-size:22px;color:#315968}.summary span,section small,article span{font-size:9px;color:#7b878a}.summary span{text-transform:uppercase}section{margin-top:16px}section small{color:#9a7a26;font-weight:800;letter-spacing:.12em}h3{margin:3px 0 8px;font-size:15px}.state.error{background:#f7e5dc;color:#7f4a35}.nodes{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}article{margin-top:8px}article>div{display:flex;justify-content:space-between;gap:12px}article p{margin:4px 0 0;color:#718085;font-size:10px}@media(max-width:700px){.summary{grid-template-columns:1fr}}`}</style>
 </BuildingOverlayShell>
}
