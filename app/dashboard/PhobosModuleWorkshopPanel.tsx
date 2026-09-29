'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'

type Recipe = {
  equipmentKey:string; label:string; requiredUnlocks:string[]; missingUnlocks:string[]; unlocked:boolean; affordable:boolean;
  metalCost:number; componentCost:number; energyCost:number; durationSeconds:number; recipeVersion:string
}
type Job = { id:string; equipment_key:string; status:string; requested_at:string; completes_at:string; completed_at?:string|null; metadata?:Record<string,unknown>|null }
type Payload = { workshop?:{label?:string}; stock?:Record<string,number>; recipes?:Recipe[]; jobs?:Job[] }

const shortUnlock=(value:string)=>value.replace('UNL:NOX:','').replaceAll(':',' · ')
const duration=(seconds:number)=>seconds>=60?`${Math.round(seconds/60)} min`:`${seconds} s`

export default function PhobosModuleWorkshopPanel(){
  const [open,setOpen]=useState(false),[data,setData]=useState<Payload>({}),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState<string|null>(null),[now,setNow]=useState(()=>Date.now())
  const load=useCallback(async()=>{const token=await getToken();if(!token)return;const r=await fetch('/api/game/vehicles/equipment-manufacturing',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});const p=await r.json();if(!r.ok)throw new Error(p?.error??'Werkstattfertigung nicht verfügbar.');setData(p);setError(null)},[])
  useEffect(()=>{if(!open)return;void load().catch(e=>setError(e instanceof Error?e.message:String(e)));const t=window.setInterval(()=>void load().catch(()=>{}),10000);return()=>window.clearInterval(t)},[open,load])
  useEffect(()=>{if(!open)return;const t=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(t)},[open])
  const running=useMemo(()=>(data.jobs??[]).filter(j=>j.status==='running'),[data.jobs])
  const start=async(recipe:Recipe)=>{setBusy(recipe.equipmentKey);setError(null);try{const token=await getToken();if(!token)throw new Error('Nicht angemeldet');const r=await fetch('/api/game/vehicles/equipment-manufacturing',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({equipmentKey:recipe.equipmentKey})});const p=await r.json();if(!r.ok)throw new Error(p?.error??'Fertigungsauftrag fehlgeschlagen.');setData(p)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(null)}}
  return <aside className={open?'module-workshop open':'module-workshop'}>
    <button className="toggle" onClick={()=>setOpen(v=>!v)}><span>WERKSTATT · MODULFERTIGUNG</span><b>{open?'×':'Öffnen'}</b></button>
    {open&&<div className="body">
      <header><div><small>{data.workshop?.label??'Surface Workshop'}</small><strong>Robotikmodule fertigen</strong></div><div className="stock"><span>Metall <b>{data.stock?.metal??0}</b></span><span>Komponenten <b>{data.stock?.components??0}</b></span><span>Energie <b>{data.stock?.energy??0}</b></span></div></header>
      {error&&<p className="error">{error}</p>}
      {running.length>0&&<section className="jobs"><b>Laufende Fertigung</b>{running.map(job=>{const left=Math.max(0,Math.ceil((new Date(job.completes_at).getTime()-now)/1000));return <div key={job.id}><span>{job.equipment_key.replaceAll('-',' ')}</span><em>{left>0?`noch ${duration(left)}`:'Abschluss wird gebucht …'}</em></div>})}</section>}
      <div className="recipes">{(data.recipes??[]).map(recipe=><article key={recipe.equipmentKey} className={!recipe.unlocked?'locked':''}><div><strong>{recipe.label}</strong><small>{recipe.metalCost} Metall · {recipe.componentCost} Komponenten · {recipe.energyCost} Energie · {duration(recipe.durationSeconds)}</small>{recipe.missingUnlocks.length>0?<p>Technologie fehlt: {recipe.missingUnlocks.map(shortUnlock).join(' / ')}</p>:<p>Technologie verfügbar · serieller Werkstattausstoß</p>}</div><button disabled={busy!==null||!recipe.unlocked||!recipe.affordable} onClick={()=>void start(recipe)}>{busy===recipe.equipmentKey?'Startet …':!recipe.unlocked?'Gesperrt':!recipe.affordable?'Bestand fehlt':'Fertigen'}</button></article>)}</div>
      <footer>Fertigung erzeugt erst nach Ablauf ein serialisiertes Equipment-Objekt. Freischaltungen stammen ausschließlich aus KG/SSF → player_unlocks.</footer>
    </div>}
    <style jsx>{`
      .module-workshop{position:fixed;z-index:4;right:18px;bottom:calc(var(--noxia-cockpit-clearance,76px) + 12px);width:min(640px,calc(100vw - 36px));font:10px/1.3 system-ui;color:#e8ddd0}.toggle{margin-left:auto;display:flex;gap:12px;align-items:center;border:1px solid rgba(204,174,132,.3);border-radius:8px;background:rgba(16,12,8,.9);color:#dfc7a8;padding:8px 10px;font:800 9px/1 ui-monospace;letter-spacing:.08em;cursor:pointer}.body{margin-top:6px;max-height:58vh;overflow:auto;padding:11px;border:1px solid rgba(204,174,132,.25);border-radius:10px;background:rgba(13,10,8,.94);backdrop-filter:blur(10px);box-shadow:0 12px 34px rgba(0,0,0,.35)}header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}header div:first-child{display:grid;gap:2px}header small{color:#b79b79}header strong{font-size:13px}.stock{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.stock span{padding:4px 6px;border-radius:5px;background:rgba(255,255,255,.05);color:#9e9284}.stock b{color:#e8ddd0}.jobs{margin:9px 0;padding:8px;border:1px solid rgba(105,172,151,.22);border-radius:7px;background:rgba(69,121,107,.08)}.jobs>b{display:block;margin-bottom:5px;color:#8fc9b5}.jobs div{display:flex;justify-content:space-between;gap:8px;padding:3px 0}.jobs em{font-style:normal;color:#a6c7ba}.recipes{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:9px}.recipes article{display:flex;justify-content:space-between;gap:8px;padding:8px;border:1px solid rgba(210,190,160,.14);border-radius:7px;background:rgba(255,255,255,.025)}.recipes article.locked{opacity:.64}.recipes article>div{display:grid;gap:3px}.recipes small{color:#a89a88}.recipes p{margin:0;color:#8fae9e;font-size:8px}.recipes .locked p{color:#c49a73}.recipes button{align-self:center;border:1px solid rgba(217,154,78,.42);border-radius:6px;background:rgba(128,86,43,.34);color:#efd5b3;padding:6px 8px;font-size:9px;cursor:pointer}.recipes button:disabled{opacity:.4;cursor:not-allowed}.error{padding:7px;border-radius:6px;background:rgba(130,54,42,.22);color:#e6aa98}footer{margin-top:8px;color:#81776c;font-size:8px}@media(max-width:700px){.module-workshop{right:8px;bottom:calc(var(--noxia-cockpit-clearance,76px) + 8px);width:calc(100vw - 16px)}.recipes{grid-template-columns:1fr}}
    `}</style>
  </aside>
}
