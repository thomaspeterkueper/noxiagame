'use client'

import { useEffect, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'

type ShuttlePayload={
  shuttle?:{
    ship?:{id:string;name:string;ship_type_id:string;location:string;status:string;cargo_max:number}
    article?:{
      engineering_frame_id:string
      engineering_authority_ref:string
      state_status:string
      actual_start_mass_kg:number|null
      crew_cargo_mission_equipment_kg:number|null
      usable_ascent_propellant_kg:number|null
      crew_mass_resolved:boolean
      cargo_mass_resolved:boolean
      mission_equipment_mass_resolved:boolean
      target_plane_resolved:boolean
    }
    inventory?:{id:string;label:string;capacity:number|null}
  }|null
  error?:string
}
type ReadinessPayload={
  ok?:boolean
  assessment?:{ready?:boolean;blockers?:string[]}
  evidence?:Record<string,string>
  engineeringAssessment?:{result?:string;details?:string[]}|null
  crew?:{boarded?:boolean;role?:string|null}
  cargo?:{empty?:boolean;rationale?:string}
  error?:string
}

export default function MoonAscentShuttlePanel(){
  const [shuttle,setShuttle]=useState<ShuttlePayload['shuttle']>(null)
  const [readiness,setReadiness]=useState<ReadinessPayload|null>(null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState<string|null>(null)

  async function authHeaders(){
    const token=await getToken()
    if(!token) throw new Error('Nicht angemeldet')
    return {Authorization:`Bearer ${token}`}
  }

  async function load(){
    try{
      const headers=await authHeaders()
      const r=await fetch('/api/game/moon/ascent-shuttle',{headers,cache:'no-store'})
      const p=await r.json() as ShuttlePayload
      if(!r.ok) throw new Error(p.error??'Shuttle konnte nicht geladen werden')
      setShuttle(p.shuttle??null)
      const shipId=p.shuttle?.ship?.id
      if(shipId){
        const rr=await fetch('/api/game/ascent/readiness',{
          method:'POST',headers:{...headers,'Content-Type':'application/json'},
          body:JSON.stringify({shipId,departureSurfaceSlug:'moon',targetOrbitNodeSlug:'moon-llo-100'}),
          cache:'no-store',
        })
        const rp=await rr.json() as ReadinessPayload
        setReadiness(rp)
      }else setReadiness(null)
    }catch(error){setMessage(error instanceof Error?error.message:String(error))}
  }

  useEffect(()=>{void load()},[])

  async function action(kind:'provision'|'board'){
    setBusy(true);setMessage(null)
    try{
      const headers=await authHeaders()
      const shipId=shuttle?.ship?.id
      const url=kind==='provision'?'/api/game/moon/ascent-shuttle':'/api/game/ascent/crew'
      const body=kind==='provision'?{action:'provision'}:{action:'board-self',shipId}
      const r=await fetch(url,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)})
      const p=await r.json() as {ok?:boolean;error?:string}
      if(!r.ok||!p.ok) throw new Error(p.error??'Aktion fehlgeschlagen')
      setMessage(kind==='provision'?'Lunar Ascent Shuttle Mk.I wurde als reales Flight Article angelegt.':'Du bist als Commander/Pilot an Bord.')
      await load()
    }catch(error){setMessage(error instanceof Error?error.message:String(error))}
    finally{setBusy(false)}
  }

  const article=shuttle?.article
  const evidence=readiness?.evidence??{}
  const unresolved=[
    article?.actual_start_mass_kg==null?'Startmasse':null,
    article?.crew_cargo_mission_equipment_kg==null?'Crew/Cargo/Equipment-Masse':null,
    article?.usable_ascent_propellant_kg==null?'nutzbarer Aufstiegstreibstoff':null,
    article&&!article.target_plane_resolved?'Zielbahnebene':null,
  ].filter(Boolean)

  return <section className="ascent">
    <header><div><small>MOON ASCENT · ENG-LUNAR-ASCENT-r1</small><h2>Lunar Ascent Shuttle</h2></div><button onClick={()=>void load()} disabled={busy}>Aktualisieren</button></header>
    {!shuttle?<div className="provision"><div><strong>ENG-SCV-0002 noch nicht instanziiert</strong><p>Erzeugt genau ein reales Shuttle samt Ship-Cargo und Flight Article. Unbekannte physische Missionswerte bleiben bewusst unresolved.</p></div><button className="primary" onClick={()=>void action('provision')} disabled={busy}>{busy?'…':'Shuttle provisionieren'}</button></div>:<>
      <div className="grid">
        <div><b>{shuttle.ship?.name}</b><span>{shuttle.ship?.location?.toUpperCase()} · {shuttle.ship?.status}</span></div>
        <div><b>{article?.engineering_frame_id}</b><span>{article?.engineering_authority_ref}</span></div>
        <div><b>{readiness?.assessment?.ready?'STARTBEREIT':'FAIL-CLOSED'}</b><span>100 km LLO · moon-llo-100</span></div>
        <div><b>{readiness?.crew?.boarded?'Crew an Bord':'Crew nicht an Bord'}</b><span>{readiness?.crew?.role??'—'}</span></div>
      </div>
      {!readiness?.crew?.boarded&&<button onClick={()=>void action('board')} disabled={busy}>Als Commander an Bord gehen</button>}
      <div className="facts">
        <span>Startmasse: {article?.actual_start_mass_kg??'unresolved'} kg</span>
        <span>Crew/Cargo/Equipment: {article?.crew_cargo_mission_equipment_kg??'unresolved'} kg</span>
        <span>Propellant: {article?.usable_ascent_propellant_kg??'unresolved'} kg</span>
        <span>Cargo: {readiness?.cargo?.empty?'leer / 0 kg':'nicht leer'}</span>
      </div>
      {unresolved.length>0&&<div className="warning"><b>Physischer Missionszustand fehlt</b><span>{unresolved.join(' · ')}</span><p>Engineering ist freigegeben; NOXIA erfindet diese Werte nicht. Erst ein konkreter Mass-/Propellant-/Plane-Resolver darf den Flight Article auf startbereit setzen.</p></div>}
      <div className="evidence">{Object.entries(evidence).map(([key,value])=><span key={key} data-state={value}>{key}: {value}</span>)}</div>
    </>}
    {message&&<p className="message">{message}</p>}
    <style jsx>{`
      .ascent{max-width:1400px;margin:0 auto 18px;background:#0d161d;border:1px solid #2d3d48;border-radius:16px;padding:16px;color:#e7edf0;font-family:system-ui,sans-serif}
      header,.provision{display:flex;justify-content:space-between;gap:16px;align-items:center}small{color:#c8a75a;font-size:10px;letter-spacing:.15em;font-weight:800}h2{margin:2px 0;font:400 24px Georgia,serif}
      button{border:1px solid #465b66;background:#13222a;color:#dbe5e9;padding:8px 12px;border-radius:8px;cursor:pointer}.primary{background:#5d4d2b;border-color:#8b7340;color:#f4dfaa}button:disabled{opacity:.45}
      .provision{margin-top:12px;padding:12px;background:#151f24;border:1px dashed #45545d;border-radius:10px}.provision p,.warning p{margin:4px 0 0;color:#929fa6;font-size:11px}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.grid div,.facts{background:#101e26;border:1px solid #2a3c46;border-radius:9px;padding:9px}.grid b{display:block;font-size:12px}.grid span,.facts span{font-size:10px;color:#93a2aa}
      .facts{display:flex;gap:16px;flex-wrap:wrap;margin-top:10px}.warning{margin-top:10px;padding:10px;border:1px solid #665938;background:#221f16;border-radius:9px}.warning span{display:block;color:#d7bd7a;font-size:11px;margin-top:4px}
      .evidence{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.evidence span{font:10px monospace;padding:3px 6px;border:1px solid #40505a;border-radius:12px}.evidence span[data-state="ready"]{color:#83c99a;border-color:#315a4a}.evidence span[data-state="blocked"]{color:#e38b83;border-color:#684247}.message{color:#cbd8de;font-size:11px}
      @media(max-width:800px){.grid{grid-template-columns:1fr 1fr}.provision{align-items:start;flex-direction:column}}
    `}</style>
  </section>
}
